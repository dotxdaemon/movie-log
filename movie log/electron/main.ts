// ABOUTME: Runs the Electron desktop shell, local JSON store, and watched-folder integrations.
// ABOUTME: Bridges native dialogs and file watching to the React renderer through a small IPC surface.
import { Menu, Tray, app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, screen, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createFolderMonitor } from './folder-monitor.js';
import { addWatchedFolderPath, logPathsFromDrop } from './main-actions.js';
import { prepareAppRuntime } from './runtime.js';
import { scanFolderContents } from './folder-scan.js';
import { createStatusItem } from './status-item.js';
import { createHistoryStore } from './store.js';
import { createWatchedFolderSync } from './watched-folder-sync.js';
import { revealWindow } from './window-visibility.js';
import { closeMovieLog, handleWindowCloseRequest, handleWindowsClosed } from './window-close.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryKind, MovieLogState, WatchEntry } from '../shared/types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
prepareAppRuntime(app);
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
let watchedFolderSync: ReturnType<typeof createWatchedFolderSync>;
const folderMonitor = createFolderMonitor({
  loadKnownPaths: historyStore.readKnownPaths,
  saveKnownPaths: historyStore.writeKnownPaths,
  onChange: async (folderPath) => {
    await watchedFolderSync.queueRefresh(folderPath);
  }
});

let mainWindow: BrowserWindow | null = null;
let backgroundWorkRunning = false;
let isQuitting = false;
let statusItem: Tray | null = null;

async function createEntryForPath(itemPath: string, source: 'drop' | 'watch'): Promise<WatchEntry | null> {
  const itemStats = await stat(itemPath);
  const sourceKind: EntryKind = itemStats.isDirectory() ? 'directory' : 'file';

  if (!isTrackableMediaItem(itemPath, sourceKind)) {
    return null;
  }

  return createEntryFromPath(itemPath, source, new Date().toISOString(), sourceKind);
}

async function readState(): Promise<MovieLogState> {
  return historyStore.readState();
}

async function broadcastState(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send('movie-log:state-changed', await readState());
}

async function openPath(itemPath: string): Promise<void> {
  const errorMessage = await shell.openPath(itemPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function captureIfRequested(): Promise<void> {
  if (!mainWindow || !process.env.MOVIE_LOG_CAPTURE_PATH) {
    return;
  }

  let isReady = false;
  let latestText = '';

  for (let attempt = 0; attempt < 40; attempt += 1) {
    latestText = await mainWindow.webContents.executeJavaScript(`
      document.body ? document.body.innerText.toLowerCase() : ''
    `);
    isReady =
      latestText.includes('movie log') &&
      latestText.includes('watched folders') &&
      latestText.includes('history');

    if (isReady) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!isReady) {
    throw new Error(`Renderer content never became ready for capture. Latest body text: ${latestText || '[empty]'}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await mainWindow.webContents.capturePage();
  await mkdir(dirname(process.env.MOVIE_LOG_CAPTURE_PATH), { recursive: true });
  await writeFile(process.env.MOVIE_LOG_CAPTURE_PATH, image.toPNG());
  app.quit();
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#121212',
    title: 'Movie Log',
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs')
    }
  });

  if (process.env.MOVIE_LOG_CAPTURE_PATH) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.error(`renderer: ${message}`);
    });

    mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error(`preload-error: ${preloadPath} ${error.message}`);
    });
  }

  mainWindow.webContents.once('did-finish-load', () => {
    void broadcastState();
    void captureIfRequested().catch((error) => {
      console.error(error);
      app.exit(1);
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(currentDirectory, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    handleWindowCloseRequest({
      closeWindow: () => {
        mainWindow?.destroy();
      },
      hideWindow: () => {
        mainWindow?.hide();
      },
      isCaptureRun: Boolean(process.env.MOVIE_LOG_CAPTURE_PATH),
      isQuitting,
      preventDefault: () => event.preventDefault()
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function showMainWindow(): Promise<void> {
  await startBackgroundWork();

  if (!mainWindow) {
    await createWindow();
    return;
  }

  const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  revealWindow(mainWindow, activeDisplay.workArea);
}

function registerIpcHandlers(): void {
  ipcMain.handle('movie-log:add-watched-folders', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    const folders = [];

    for (const selectedPath of result.filePaths) {
      const folder = await addWatchedFolderPath(selectedPath, {
        queueFolderRefresh: async (folderPath) => {
          await watchedFolderSync.queueRefresh(folderPath);
        },
        removeWatchedFolder: async (folderId) => historyStore.removeWatchedFolder(folderId),
        saveWatchedFolder: async (folderPath) => historyStore.addWatchedFolder(folderPath),
        unwatchFolder: async (folderPath) => {
          await folderMonitor.unwatchFolder(folderPath);
        },
        watchFolder: async (folderPath) => {
          await folderMonitor.watchFolder(folderPath);
        }
      });
      folders.push(folder);
    }

    await broadcastState();
    return folders;
  });

  ipcMain.handle('movie-log:copy-path', async (_event, itemPath: string) => {
    clipboard.writeText(itemPath);
  });

  ipcMain.handle('movie-log:get-data-file-path', async () => historyStore.getDataFilePath());

  ipcMain.handle('movie-log:get-note-file-path', async () => historyStore.getNoteFilePath());

  ipcMain.handle('movie-log:get-state', async () => readState());

  ipcMain.handle('movie-log:log-paths', async (_event, paths: string[]) => {
    return logPathsFromDrop(paths, {
      addHistoryEntries: async (entries) => historyStore.addHistoryEntries(entries),
      broadcastState,
      createEntryForPath: async (itemPath) => createEntryForPath(itemPath, 'drop')
    });
  });

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath);
  });

  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => {
    await openPath(itemPath);
  });

  ipcMain.handle('movie-log:scan-now', async () => {
    await watchedFolderSync.refreshWatchedFolders();
  });

  ipcMain.handle('movie-log:remove-watched-folder', async (_event, folderId: string) => {
    const removedFolder = await historyStore.removeWatchedFolder(folderId);

    if (removedFolder) {
      watchedFolderSync.forgetFolder(removedFolder.path);
      await folderMonitor.unwatchFolder(removedFolder.path);
      await broadcastState();
    }
  });
}

async function startExistingWatchers(): Promise<void> {
  await watchedFolderSync.catchUpWatchedFolders();
}

async function startBackgroundWork(): Promise<void> {
  if (backgroundWorkRunning) {
    return;
  }

  await startExistingWatchers();
  backgroundWorkRunning = true;
}

async function pauseBackgroundWork(): Promise<void> {
  if (!backgroundWorkRunning) {
    return;
  }

  await folderMonitor.dispose();
  backgroundWorkRunning = false;
}

app.whenReady().then(async () => {
  watchedFolderSync = createWatchedFolderSync({
    broadcastState,
    listWatchedFolders: async () => (await readState()).watchedFolders,
    now: () => new Date().toISOString(),
    saveFolderContents: async (folderPath, items, scannedAt) => {
      await historyStore.syncWatchedFolderContents(folderPath, items, scannedAt);
    },
    scanFolder: scanFolderContents,
    watchFolder: async (folderPath) => {
      await folderMonitor.watchFolder(folderPath);
    }
  });
  registerIpcHandlers();
  await startBackgroundWork();
  statusItem = createStatusItem({
    TrayConstructor: Tray,
    imageFactory: nativeImage,
    menu: Menu,
    quitApp: () => app.quit(),
    showWindow: () => {
      void showMainWindow();
    }
  });
  await createWindow();
});

app.on('activate', () => {
  void showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  statusItem?.destroy();
  statusItem = null;
});

app.on('window-all-closed', () => {
  void handleWindowsClosed({
    closeMovieLog: () =>
      closeMovieLog({
        disposeFolderMonitor: () => folderMonitor.dispose(),
        quitApp: () => app.quit()
      }),
    hasStatusItem: statusItem !== null,
    isQuitting,
    pauseBackgroundWork
  });
});

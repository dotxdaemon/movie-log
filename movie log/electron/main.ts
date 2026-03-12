// ABOUTME: Runs the Electron desktop shell, local JSON store, and watched-folder integrations.
// ABOUTME: Bridges native dialogs and file watching to the React renderer through a small IPC surface.
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createFolderMonitor } from './folder-monitor.js';
import { automaticScanIntervalMs } from './scan-interval.js';
import { scanFolderContents } from './folder-scan.js';
import { createHistoryStore } from './store.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryKind, MovieLogState, WatchEntry } from '../shared/types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
app.setName('Movie Log');
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
const folderMonitor = createFolderMonitor({
  loadKnownPaths: historyStore.readKnownPaths,
  saveKnownPaths: historyStore.writeKnownPaths,
  onDiscover: async (itemPath) => {
    await syncWatchedFolder(dirname(itemPath), 'new-only');
    await broadcastState();
  }
});

let mainWindow: BrowserWindow | null = null;
let dailyScanTimer: NodeJS.Timeout | null = null;

type HistoryMode = 'all-current' | 'new-only' | 'none';

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

async function syncWatchedFolder(folderPath: string, historyMode: HistoryMode): Promise<void> {
  const scannedAt = new Date().toISOString();
  const currentItems = await scanFolderContents(folderPath);
  const newItems = await historyStore.syncWatchedFolderContents(folderPath, currentItems, scannedAt);

  if (historyMode === 'all-current') {
    await historyStore.recordWatchedFolderContents(folderPath, scannedAt);
    return;
  }

  if (historyMode === 'new-only' && newItems.length > 0) {
    await historyStore.addHistoryEntries(
      newItems.map((item) => createEntryFromPath(item.sourcePath, 'watch', scannedAt, item.sourceKind))
    );
  }
}

async function syncAllWatchedFolders(historyMode: HistoryMode): Promise<void> {
  const state = await readState();

  for (const folder of state.watchedFolders) {
    await syncWatchedFolder(folder.path, historyMode);
  }
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
    isReady = latestText.includes('recent history') && latestText.includes('settings');

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
      const folder = await historyStore.addWatchedFolder(selectedPath);
      await syncWatchedFolder(folder.path, 'none');
      await folderMonitor.watchFolder(folder.path);
      folders.push(folder);
    }

    await broadcastState();
    return folders;
  });

  ipcMain.handle('movie-log:clear-history', async () => {
    await historyStore.clearHistory();
    await broadcastState();
  });

  ipcMain.handle('movie-log:copy-path', async (_event, itemPath: string) => {
    clipboard.writeText(itemPath);
  });

  ipcMain.handle('movie-log:get-data-file-path', async () => historyStore.getDataFilePath());

  ipcMain.handle('movie-log:get-note-file-path', async () => historyStore.getNoteFilePath());

  ipcMain.handle('movie-log:get-state', async () => readState());

  ipcMain.handle('movie-log:log-paths', async (_event, paths: string[]) => {
    const entries = (await Promise.all(paths.map((itemPath) => createEntryForPath(itemPath, 'drop')))).filter(
      (entry): entry is WatchEntry => entry !== null
    );
    await historyStore.addHistoryEntries(entries);
    await broadcastState();
    return entries;
  });

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath);
  });

  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => {
    await openPath(itemPath);
  });

  ipcMain.handle('movie-log:scan-now', async () => {
    await syncAllWatchedFolders('all-current');
    await broadcastState();
  });

  ipcMain.handle('movie-log:remove-watched-folder', async (_event, folderId: string) => {
    const removedFolder = await historyStore.removeWatchedFolder(folderId);

    if (removedFolder) {
      await folderMonitor.unwatchFolder(removedFolder.path);
      await broadcastState();
    }
  });
}

async function startExistingWatchers(): Promise<void> {
  await syncAllWatchedFolders('none');

  const state = await readState();
  for (const folder of state.watchedFolders) {
    await folderMonitor.watchFolder(folder.path);
  }
}

function startDailyScanLoop(): void {
  if (dailyScanTimer) {
    clearInterval(dailyScanTimer);
  }

  dailyScanTimer = setInterval(() => {
    void syncAllWatchedFolders('new-only').then(() => broadcastState());
  }, automaticScanIntervalMs);
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await startExistingWatchers();
  startDailyScanLoop();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (dailyScanTimer) {
    clearInterval(dailyScanTimer);
    dailyScanTimer = null;
  }

  void folderMonitor.dispose();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await startExistingWatchers();
    startDailyScanLoop();
    await createWindow();
  }
});

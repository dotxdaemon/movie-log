// ABOUTME: Runs the Electron desktop shell, local JSON store, and watched-folder integrations.
// ABOUTME: Bridges native dialogs and file watching to the React renderer through a small IPC surface.
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createFolderMonitor } from './folder-monitor.js';
import { createHistoryStore } from './store.js';
import { createEntryFromPath } from '../shared/history.js';
import type { EntryKind, MovieLogState, WatchEntry } from '../shared/types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
const folderMonitor = createFolderMonitor({
  loadKnownPaths: historyStore.readKnownPaths,
  saveKnownPaths: historyStore.writeKnownPaths,
  onDiscover: async (itemPath) => {
    const entry = await createEntryForPath(itemPath, 'watch');
    await historyStore.addHistoryEntry(entry);
    await broadcastState();
  }
});

let mainWindow: BrowserWindow | null = null;

async function createEntryForPath(itemPath: string, source: 'drop' | 'watch'): Promise<WatchEntry> {
  const itemStats = await stat(itemPath);
  const sourceKind: EntryKind = itemStats.isDirectory() ? 'directory' : 'file';
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
    isReady = latestText.includes('recent history') && latestText.includes('watched inbox folders');

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
  ipcMain.handle('movie-log:get-state', async () => readState());

  ipcMain.handle('movie-log:log-paths', async (_event, paths: string[]) => {
    const entries = await Promise.all(paths.map((itemPath) => createEntryForPath(itemPath, 'drop')));
    await historyStore.addHistoryEntries(entries);
    await broadcastState();
    return entries;
  });

  ipcMain.handle('movie-log:pick-watched-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      return null;
    }

    const folder = await historyStore.addWatchedFolder(selectedPath);
    await folderMonitor.watchFolder(folder.path);
    await broadcastState();
    return folder;
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
  const state = await readState();

  for (const folder of state.watchedFolders) {
    await folderMonitor.watchFolder(folder.path);
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await startExistingWatchers();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void folderMonitor.dispose().finally(() => app.quit());
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

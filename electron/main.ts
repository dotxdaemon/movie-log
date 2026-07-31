// ABOUTME: Coordinates Movie Log's Electron lifecycle while delegating windows, IPC, folders, and catalog work.
// ABOUTME: Keeps the executable entrypoint small enough to audit as wiring rather than a second application layer.
import { BrowserWindow, Menu, Tray, app, nativeImage, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MovieLogState } from '../shared/types.js';
import { handleMovieLogWindowsClosed, showMovieLog, type WindowActivation } from './app-lifecycle.js';
import { createCaptureController } from './capture.js';
import { createCatalogOrchestrator } from './catalog-orchestrator.js';
import { createFilmCatalog } from './film-catalog.js';
import { createFilmIndex } from './film-index.js';
import { createFolderMonitor } from './folder-monitor.js';
import { scanFolderContents } from './folder-scan.js';
import { registerMovieLogIpcHandlers } from './ipc-handlers.js';
import { createMovieLogWindow } from './main-window.js';
import { prepareAppRuntime } from './runtime.js';
import { createStatusItem } from './status-item.js';
import { createHistoryStore } from './store.js';
import { createWatchedFolderSync, type WatchedFolderSync } from './watched-folder-sync.js';
import { revealWindow } from './window-visibility.js';
import { closeMovieLog } from './window-close.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
const filmCatalog = createFilmCatalog();
const filmIndex = createFilmIndex({ catalog: filmCatalog, dataDirectory, deferDetails: true });
let watchedFolderSync: WatchedFolderSync;
let mainWindow: BrowserWindow | null = null;
let backgroundWorkRunning = false;
let isQuitting = false;
let statusItem: Tray | null = null;

const folderMonitor = createFolderMonitor({
  loadKnownPaths: historyStore.readKnownPaths,
  saveKnownPaths: historyStore.writeKnownPaths,
  onChange: async (folderPath) => watchedFolderSync.queueRefresh(folderPath)
});
const capture = createCaptureController({
  dataDirectory,
  historyStore,
  quitApp: () => app.quit(),
  readState
});
const catalogOrchestrator = createCatalogOrchestrator({
  broadcastState,
  filmIndex,
  readSourceState: historyStore.readState
});

prepareAppRuntime(app, {
  showWindow: () => {
    void showMainWindow('active');
  }
});

async function readState(): Promise<MovieLogState> {
  const [state, films] = await Promise.all([historyStore.readState(), filmIndex.readFilms()]);
  return { ...state, films };
}

async function broadcastState(): Promise<void> {
  const windowToNotify = mainWindow;

  if (!windowToNotify) {
    return;
  }

  const state = capture.transformReadState(await readState());

  if (!windowToNotify.isDestroyed() && !windowToNotify.webContents.isDestroyed()) {
    windowToNotify.webContents.send('movie-log:state-changed', state);
  }
}

async function createWindow(activation: WindowActivation = 'active'): Promise<void> {
  await createMovieLogWindow({
    activation,
    broadcastState,
    capture,
    currentDirectory,
    enrichCatalog: catalogOrchestrator.enrich,
    exitWithFailure: () => app.exit(1),
    isQuitting: () => isQuitting,
    onClosed: () => {
      mainWindow = null;
    },
    onCreated: (window) => {
      mainWindow = window;
    }
  });

  if (activation === 'inactive' && mainWindow) {
    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    revealWindow(mainWindow, activeDisplay.workArea, activation);
  }
}

async function startBackgroundWork(): Promise<void> {
  if (backgroundWorkRunning || capture.isRequested) {
    return;
  }

  await watchedFolderSync.catchUpWatchedFolders();
  backgroundWorkRunning = true;
}

async function pauseBackgroundWork(): Promise<void> {
  if (!backgroundWorkRunning) {
    return;
  }

  await folderMonitor.dispose();
  catalogOrchestrator.cancel();
  backgroundWorkRunning = false;
}

async function showMainWindow(activation: WindowActivation): Promise<void> {
  await showMovieLog({
    activation,
    createWindow,
    hasWindow: mainWindow !== null,
    revealWindow: () => {
      if (mainWindow) {
        const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        revealWindow(mainWindow, activeDisplay.workArea, activation);
      }
    },
    startBackgroundWork
  });
}

app.whenReady().then(async () => {
  watchedFolderSync = createWatchedFolderSync({
    broadcastState: async () => {
      await broadcastState();
      void catalogOrchestrator.enrich();
    },
    listWatchedFolders: async () => (await readState()).watchedFolders,
    now: () => new Date().toISOString(),
    saveFolderContents: async (folderPath, items, scannedAt) => {
      await historyStore.syncWatchedFolderContents(folderPath, items, scannedAt);
    },
    scanFolder: scanFolderContents,
    watchFolder: folderMonitor.watchFolder
  });
  registerMovieLogIpcHandlers({
    broadcastState,
    capture,
    catalogOrchestrator,
    filmCatalog,
    filmIndex,
    folderMonitor,
    getWatchedFolderSync: () => watchedFolderSync,
    historyStore,
    readState
  });
  if (!capture.isRequested) {
    statusItem = createStatusItem({
      TrayConstructor: Tray,
      imageFactory: nativeImage,
      menu: Menu,
      quitApp: () => app.quit(),
      showWindow: () => {
        void showMainWindow('inactive');
      }
    });
  }

  await createWindow('active');
  void startBackgroundWork().catch((error: unknown) => {
    console.error('Movie Log background startup failed.', error);
  });
});

app.on('activate', () => {
  void showMainWindow('active');
});

app.on('before-quit', () => {
  isQuitting = true;
  catalogOrchestrator.cancel();
  statusItem?.destroy();
  statusItem = null;
});

app.on('window-all-closed', () => {
  void handleMovieLogWindowsClosed({
    closeMovieLog: () =>
      closeMovieLog({
        disposeFolderMonitor: folderMonitor.dispose,
        quitApp: () => app.quit()
      }),
    hasStatusItem: statusItem !== null,
    isQuitting,
    pauseBackgroundWork
  });
});

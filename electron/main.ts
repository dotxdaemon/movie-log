// ABOUTME: Runs the Electron desktop shell, local JSON store, and watched-folder integrations.
// ABOUTME: Bridges native dialogs and file watching to the React renderer through a small IPC surface.
import { Menu, Tray, app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, screen, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createFilmCatalog } from './film-catalog.js';
import { createFilmIndex, type FilmEnrichmentRequest } from './film-index.js';
import { createFolderMonitor } from './folder-monitor.js';
import { addWatchedFolderPath, logPathsFromDrop } from './main-actions.js';
import { handleMovieLogWindowsClosed, showMovieLog } from './app-lifecycle.js';
import { prepareAppRuntime } from './runtime.js';
import { scanFolderContents } from './folder-scan.js';
import { createStatusItem } from './status-item.js';
import { createHistoryStore } from './store.js';
import { createWatchedFolderSync } from './watched-folder-sync.js';
import { revealWindow } from './window-visibility.js';
import { closeMovieLog, handleWindowCloseRequest } from './window-close.js';
import { buildFilmSourcePath, parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryDetails, EntryKind, LogEntryDetails, LogFilmRequest, MovieLogState, WatchEntry } from '../shared/types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
prepareAppRuntime(app, {
  showWindow: () => {
    void showMainWindow();
  }
});
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
const filmCatalog = createFilmCatalog();
const filmIndex = createFilmIndex({ catalog: filmCatalog, dataDirectory });
let filmEnrichmentRunning = false;
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
const captureRequested = Boolean(process.env.MOVIE_LOG_CAPTURE_PATH);
const captureWidth = Number(process.env.MOVIE_LOG_CAPTURE_WIDTH ?? 1180);
const captureHeight = Number(process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? 788);
const captureRequestedView = process.env.MOVIE_LOG_CAPTURE_VIEW ?? 'diary';
const captureViews = new Set(['diary', 'library', 'search', 'statistics', 'settings', 'detail', 'log']);

if (captureRequested && (!Number.isInteger(captureWidth) || !Number.isInteger(captureHeight) || captureWidth < 320 || captureHeight < 640)) {
  throw new Error(`Capture dimensions must be whole numbers at least 320x640. Received ${captureWidth}x${captureHeight}.`);
}

if (captureRequested && !captureViews.has(captureRequestedView)) {
  throw new Error(`Unknown capture view: ${captureRequestedView}.`);
}

async function createEntryForPath(
  itemPath: string,
  source: 'drop' | 'watch',
  details: LogEntryDetails = {}
): Promise<WatchEntry | null> {
  const itemStats = await stat(itemPath);
  const sourceKind: EntryKind = itemStats.isDirectory() ? 'directory' : 'file';

  if (!isTrackableMediaItem(itemPath, sourceKind)) {
    return null;
  }

  const { watchedAt = new Date().toISOString(), ...annotations } = details;
  return {
    ...createEntryFromPath(itemPath, source, watchedAt, sourceKind),
    ...annotations,
    tags: annotations.tags ? [...annotations.tags] : undefined
  };
}

async function readState(): Promise<MovieLogState> {
  const [state, films] = await Promise.all([historyStore.readState(), filmIndex.readFilms()]);
  return { ...state, films };
}

function collectFilmRequests(state: MovieLogState): FilmEnrichmentRequest[] {
  const requests = new Map<string, FilmEnrichmentRequest>();
  const titles = [
    ...state.history.map((entry) => entry.title),
    ...state.libraryItems.map((item) => item.title)
  ];

  for (const stem of titles) {
    const parsed = parseFilmTitle(stem);

    if (!parsed.title) {
      continue;
    }

    const key = readFilmKey(parsed);

    if (!requests.has(key)) {
      requests.set(key, { key, title: parsed.title, year: parsed.year });
    }
  }

  return [...requests.values()];
}

async function enrichFilms(): Promise<void> {
  if (filmEnrichmentRunning) {
    return;
  }

  filmEnrichmentRunning = true;

  try {
    const state = await historyStore.readState();
    const changed = await filmIndex.enrichFilms(collectFilmRequests({ ...state, films: {} }));

    if (changed) {
      await broadcastState();
    }
  } catch {
    return;
  } finally {
    filmEnrichmentRunning = false;
  }
}

async function broadcastState(): Promise<void> {
  const windowToNotify = mainWindow;

  if (!windowToNotify) {
    return;
  }

  const state = await readState();

  if (windowToNotify.isDestroyed() || windowToNotify.webContents.isDestroyed()) {
    return;
  }

  windowToNotify.webContents.send('movie-log:state-changed', state);
}

async function openPath(itemPath: string): Promise<void> {
  const errorMessage = await shell.openPath(itemPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function selectCaptureView(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const selected = (await mainWindow.webContents.executeJavaScript(`
    (() => {
      const requestedView = ${JSON.stringify(captureRequestedView)};
      const readLabel = (element) => element.textContent?.trim().toLowerCase() ?? '';
      const navigationItems = [...document.querySelectorAll('.nav-item')];

      if (requestedView === 'log') {
        document.querySelector('.log-action')?.click();
        return true;
      }

      if (requestedView === 'detail') {
        navigationItems.find((item) => readLabel(item).includes('library'))?.click();
        return true;
      }

      if (requestedView !== 'diary') {
        navigationItems.find((item) => readLabel(item).includes(requestedView))?.click();
      }

      return true;
    })()
  `)) as boolean;

  if (!selected) {
    throw new Error(`Capture view did not render: ${captureRequestedView}.`);
  }

  await new Promise((resolve) => setTimeout(resolve, 180));

  if (captureRequestedView === 'detail') {
    const selectedMovie = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const face = document.querySelector('.movie-card .movie-card-face');
        face?.click();
        return Boolean(face);
      })()
    `)) as boolean;

    if (!selectedMovie) {
      throw new Error('Capture view did not render: detail has no movie card to select.');
    }

    await new Promise((resolve) => setTimeout(resolve, 180));
    await mainWindow.webContents.executeJavaScript(`
      document.querySelector('.movie-card-selected .movie-card-face')?.click()
    `);
    await new Promise((resolve) => setTimeout(resolve, 180));
  }

  const viewSelector = {
    detail: '.movie-dossier',
    diary: '.diary-view',
    library: '.library-view',
    log: '.log-sheet',
    search: '.search-view',
    settings: '.settings-view',
    statistics: '.statistics-view'
  }[captureRequestedView];
  const viewRendered = (await mainWindow.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(viewSelector)}))`)) as boolean;

  if (!viewRendered) {
    throw new Error(`Capture view did not render: ${captureRequestedView}.`);
  }
}

async function captureIfRequested(): Promise<void> {
  if (!mainWindow || !process.env.MOVIE_LOG_CAPTURE_PATH) {
    return;
  }

  let isReady = false;
  let latestReadyState = '';
  let latestText = '';

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = (await mainWindow.webContents.executeJavaScript(`
      ({
        bodyText: document.body ? document.body.innerText.toLowerCase() : '',
        readyState: document.documentElement?.dataset?.movieLogCaptureReady ?? ''
      })
    `)) as { bodyText: string; readyState: string };
    latestText = snapshot.bodyText;
    latestReadyState = snapshot.readyState;
    isReady = latestReadyState === 'true';

    if (isReady) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!isReady) {
    throw new Error(
      `Renderer content never became ready for capture. Ready state: ${latestReadyState || '[unset]'} Latest body text: ${latestText || '[empty]'}`
    );
  }

  await selectCaptureView();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const layout = (await mainWindow.webContents.executeJavaScript(`
    (() => {
      const root = document.documentElement;
      const body = document.body;
      const archiveSpine = document.querySelector('.archive-spine');
      const mobileNavigation = document.querySelector('.mobile-nav');
      return {
        archiveSpineDisplay: archiveSpine ? getComputedStyle(archiveSpine).display : '',
        clientWidth: root.clientWidth,
        mobileNavigationDisplay: mobileNavigation ? getComputedStyle(mobileNavigation).display : '',
        scrollWidth: Math.max(root.scrollWidth, body ? body.scrollWidth : 0)
      };
    })()
  `)) as {
    archiveSpineDisplay: string;
    clientWidth: number;
    mobileNavigationDisplay: string;
    scrollWidth: number;
  };

  if (layout.scrollWidth > layout.clientWidth) {
    throw new Error(`Capture has horizontal overflow: ${layout.scrollWidth}px content in a ${layout.clientWidth}px viewport.`);
  }

  if (captureWidth <= 700 && (layout.archiveSpineDisplay !== 'none' || layout.mobileNavigationDisplay === 'none')) {
    throw new Error('Mobile capture did not replace the desktop spine with the mobile navigation.');
  }

  if (captureWidth > 700 && (layout.archiveSpineDisplay === 'none' || layout.mobileNavigationDisplay !== 'none')) {
    throw new Error('Desktop capture did not keep the structural spine visible and mobile navigation hidden.');
  }

  const image = await mainWindow.webContents.capturePage();
  const imageSize = image.getSize();

  if (imageSize.width !== captureWidth || imageSize.height !== captureHeight) {
    throw new Error(
      `Capture dimensions ${imageSize.width}x${imageSize.height} did not match ${captureWidth}x${captureHeight}.`
    );
  }

  await mkdir(dirname(process.env.MOVIE_LOG_CAPTURE_PATH), { recursive: true });
  await writeFile(process.env.MOVIE_LOG_CAPTURE_PATH, image.toPNG());
  app.quit();
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: captureRequested ? captureWidth : 1180,
    height: captureRequested ? captureHeight : 820,
    minWidth: 390,
    minHeight: 640,
    useContentSize: captureRequested,
    backgroundColor: '#f5f3f6',
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
    void enrichFilms();
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
  await showMovieLog({
    createWindow,
    hasWindow: mainWindow !== null,
    revealWindow: () => {
      if (!mainWindow) {
        return;
      }

      const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      revealWindow(mainWindow, activeDisplay.workArea);
    },
    startBackgroundWork
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
    void enrichFilms();
    return folders;
  });

  ipcMain.handle('movie-log:copy-path', async (_event, itemPath: string) => {
    clipboard.writeText(itemPath);
  });

  ipcMain.handle('movie-log:choose-log-paths', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory', 'multiSelections']
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('movie-log:get-data-file-path', async () => historyStore.getDataFilePath());

  ipcMain.handle('movie-log:get-note-file-path', async () => historyStore.getNoteFilePath());

  ipcMain.handle('movie-log:get-state', async () => readState());

  ipcMain.handle('movie-log:log-paths', async (_event, paths: string[], details?: LogEntryDetails) => {
    const result = await logPathsFromDrop(paths, {
      addHistoryEntries: async (entries) => historyStore.addHistoryEntries(entries),
      broadcastState,
      createEntryForPath: async (itemPath) => createEntryForPath(itemPath, 'drop', details)
    });
    void enrichFilms();
    return result;
  });

  ipcMain.handle('movie-log:log-film', async (_event, film: LogFilmRequest, details?: LogEntryDetails) => {
    const { watchedAt = new Date().toISOString(), ...annotations } = details ?? {};
    const sourcePath = buildFilmSourcePath({ title: film.title, year: film.year }, film.pageId);
    const entry: WatchEntry = {
      ...createEntryFromPath(sourcePath, 'drop', watchedAt, 'directory'),
      ...annotations,
      tags: annotations.tags ? [...annotations.tags] : undefined
    };
    await historyStore.addHistoryEntry(entry);

    try {
      await filmIndex.matchFilm(readFilmKey({ title: film.title, year: film.year }), film, film.pageId);
    } catch {
      // The diary entry is saved even when the catalog is unreachable; metadata fills in on the next enrichment.
    }

    await broadcastState();
  });

  ipcMain.handle('movie-log:search-catalog', async (_event, query: string) => {
    return filmCatalog.searchFilms(query);
  });

  ipcMain.handle(
    'movie-log:match-film',
    async (_event, filmKey: string, film: { title: string; year: number | null }, pageId: number | null) => {
      await filmIndex.matchFilm(filmKey, film, pageId);
      await broadcastState();
    }
  );

  ipcMain.handle('movie-log:update-entry', async (_event, entryId: string, details: EntryDetails) => {
    const entry = await historyStore.updateHistoryEntry(entryId, details);

    if (entry) {
      await broadcastState();
    }

    return entry;
  });

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath);
  });

  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => {
    await openPath(itemPath);
  });

  ipcMain.handle('movie-log:scan-now', async () => {
    await watchedFolderSync.refreshWatchedFolders();
    void enrichFilms();
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
    broadcastState: async () => {
      await broadcastState();
      void enrichFilms();
    },
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
  void handleMovieLogWindowsClosed({
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

// ABOUTME: Registers Movie Log's native IPC surface away from Electron lifecycle and window setup.
// ABOUTME: Keeps logging, catalog, folder, and file actions explicit through injected collaborators.
import { clipboard, dialog, ipcMain, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { buildFilmSourcePath, parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type {
  EntryDetails,
  EntryKind,
  LogEntryDetails,
  LogFilmRequest,
  MovieLogState,
  WatchEntry
} from '../shared/types.js';
import type { CaptureController } from './capture.js';
import type { CatalogOrchestrator } from './catalog-orchestrator.js';
import type { FilmCatalog } from './film-catalog.js';
import type { FilmIndex } from './film-index.js';
import type { FolderMonitor } from './folder-monitor.js';
import {
  addWatchedFolderPath,
  logCatalogFilmEntry,
  logPathsFromDrop,
  searchCatalogWithFallback
} from './main-actions.js';
import type { HistoryStore } from './store.js';
import type { WatchedFolderSync } from './watched-folder-sync.js';

interface RegisterMovieLogIpcOptions {
  broadcastState(): Promise<void>;
  capture: CaptureController;
  catalogOrchestrator: CatalogOrchestrator;
  filmCatalog: FilmCatalog;
  filmIndex: FilmIndex;
  folderMonitor: FolderMonitor;
  getWatchedFolderSync(): WatchedFolderSync;
  historyStore: HistoryStore;
  readState(): Promise<MovieLogState>;
}

async function createEntryForPath(itemPath: string, details: LogEntryDetails = {}): Promise<WatchEntry | null> {
  const itemStats = await stat(itemPath);
  const sourceKind: EntryKind = itemStats.isDirectory() ? 'directory' : 'file';

  if (!isTrackableMediaItem(itemPath, sourceKind)) {
    return null;
  }

  const { watchedAt = new Date().toISOString(), ...annotations } = details;
  return {
    ...createEntryFromPath(itemPath, 'drop', watchedAt, sourceKind),
    ...annotations,
    tags: annotations.tags ? [...annotations.tags] : undefined
  };
}

async function openPath(itemPath: string): Promise<void> {
  const errorMessage = await shell.openPath(itemPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

export function registerMovieLogIpcHandlers(options: RegisterMovieLogIpcOptions): void {
  const {
    broadcastState,
    capture,
    catalogOrchestrator,
    filmCatalog,
    filmIndex,
    folderMonitor,
    historyStore,
    readState
  } = options;

  ipcMain.handle('movie-log:add-watched-folders', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    const folders = [];

    for (const selectedPath of result.filePaths) {
      const folder = await addWatchedFolderPath(selectedPath, {
        queueFolderRefresh: async (folderPath) => options.getWatchedFolderSync().queueRefresh(folderPath),
        removeWatchedFolder: async (folderId) => historyStore.removeWatchedFolder(folderId),
        saveWatchedFolder: async (folderPath) => historyStore.addWatchedFolder(folderPath),
        unwatchFolder: async (folderPath) => folderMonitor.unwatchFolder(folderPath),
        watchFolder: async (folderPath) => folderMonitor.watchFolder(folderPath)
      });
      folders.push(folder);
    }

    await broadcastState();
    void catalogOrchestrator.enrich();
    return folders;
  });

  ipcMain.handle('movie-log:copy-path', async (_event, itemPath: string) => clipboard.writeText(itemPath));

  ipcMain.handle('movie-log:choose-log-paths', async () => {
    const capturePaths = await capture.readLogPathOverride();

    if (capturePaths) {
      return capturePaths;
    }

    const result = await dialog.showOpenDialog({ properties: ['openFile', 'openDirectory', 'multiSelections'] });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('movie-log:get-data-file-path', async () => historyStore.getDataFilePath());
  ipcMain.handle('movie-log:get-note-file-path', async () => historyStore.getNoteFilePath());
  ipcMain.handle('movie-log:get-state', async () => {
    await capture.beforeReadState();
    return readState();
  });

  ipcMain.handle(
    'movie-log:log-paths',
    async (_event, paths: string[], details?: LogEntryDetails, selectedFilm?: LogFilmRequest) => {
      const result = await logPathsFromDrop(
        paths,
        {
          addHistoryEntries: historyStore.addHistoryEntries,
          broadcastState,
          createEntryForPath: async (itemPath) => createEntryForPath(itemPath, details),
          matchFilmForEntry: async (entry, film) => {
            const key = readFilmKey(parseFilmTitle(entry.title));
            await filmIndex.attachFilm(key, {
              catalogId: film.catalogId,
              catalogSource: film.catalogSource,
              description: 'Selected catalog match',
              director: film.director,
              pageId: film.pageId,
              posterUrl: film.posterUrl ?? null,
              title: film.title,
              year: film.year
            });
          },
          reportError: (error, phase) => console.error(`Path logging ${phase} failed.`, error)
        },
        selectedFilm
      );
      void catalogOrchestrator.enrich();
      return result;
    }
  );

  ipcMain.handle('movie-log:log-film', async (_event, film: LogFilmRequest, details?: LogEntryDetails) => {
    const { watchedAt = new Date().toISOString(), ...annotations } = details ?? {};
    const sourcePath = buildFilmSourcePath(
      { title: film.title, year: film.year },
      film.pageId,
      film.catalogSource,
      film.catalogId
    );
    const entry: WatchEntry = {
      ...createEntryFromPath(sourcePath, 'drop', watchedAt, 'directory'),
      ...annotations,
      tags: annotations.tags ? [...annotations.tags] : undefined
    };
    const result = await logCatalogFilmEntry(entry, film, {
      addHistoryEntry: historyStore.addHistoryEntry,
      attachFilm: async (_entry, selectedFilm) => {
        await filmIndex.attachFilm(readFilmKey({ title: selectedFilm.title, year: selectedFilm.year }), {
          catalogId: selectedFilm.catalogId,
          catalogSource: selectedFilm.catalogSource,
          description: 'Selected catalog match',
          director: selectedFilm.director,
          pageId: selectedFilm.pageId,
          posterUrl: selectedFilm.posterUrl ?? null,
          title: selectedFilm.title,
          year: selectedFilm.year
        });
      },
      broadcastState,
      reportError: (error, phase) => console.error(`Catalog-only logging ${phase} failed.`, error)
    });
    void catalogOrchestrator.enrich();
    return result;
  });

  ipcMain.handle('movie-log:search-catalog', async (_event, query: string) =>
    searchCatalogWithFallback(query, {
      searchCachedFilms: capture.forceCatalogOutage ? async () => [] : filmIndex.searchFilms,
      searchLiveFilms: capture.forceCatalogOutage
        ? async () => {
            throw new Error('Catalog connection unavailable.');
          }
        : (searchQuery, signal) => filmCatalog.searchFilms(searchQuery, { signal })
    })
  );

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

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => shell.showItemInFolder(itemPath));
  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => openPath(itemPath));
  ipcMain.handle('movie-log:scan-now', async () => {
    await options.getWatchedFolderSync().refreshWatchedFolders();
    void catalogOrchestrator.enrich();
  });
  ipcMain.handle('movie-log:remove-watched-folder', async (_event, folderId: string) => {
    const removedFolder = await historyStore.removeWatchedFolder(folderId);

    if (removedFolder) {
      options.getWatchedFolderSync().forgetFolder(removedFolder.path);
      await folderMonitor.unwatchFolder(removedFolder.path);
      await broadcastState();
    }
  });
  ipcMain.handle('movie-log:retry-film-enrichment', async () => {
    await catalogOrchestrator.retry();
  });
}

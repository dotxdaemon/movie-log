// ABOUTME: Registers Movie Log's native IPC surface away from Electron lifecycle and window setup.
// ABOUTME: Keeps logging, catalog, folder, and file actions explicit through injected collaborators.
import { clipboard, dialog, ipcMain, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { buildFilmSourcePath, parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type {
  CatalogSearchResult,
  EntryDetails,
  EntryKind,
  LogEntryDetails,
  LogFilmRequest,
  MovieLogState,
  WatchEntry
} from '../shared/types.js';
import type { CaptureController } from './capture.js';
import type { CatalogOrchestrator } from './catalog-orchestrator.js';
import { searchCatalogProviders, type FilmCatalog } from './film-catalog.js';
import type { FilmIndex } from './film-index.js';
import type { FolderMonitor } from './folder-monitor.js';
import {
  addWatchedFolderPath,
  createAttachedCatalogSelection,
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
    capture.assertWritable('add watched folders');
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
    return capture.transformReadState(await readState());
  });

  ipcMain.handle(
    'movie-log:log-paths',
    async (_event, paths: string[], details?: LogEntryDetails, selectedFilm?: LogFilmRequest) => {
      capture.assertWritable('log paths');
      const result = await logPathsFromDrop(
        paths,
        {
          addHistoryEntries: historyStore.addHistoryEntries,
          broadcastState,
          createEntryForPath: async (itemPath) => createEntryForPath(itemPath, details),
          matchFilmForEntry: async (entry, film) => {
            const key = readFilmKey(parseFilmTitle(entry.title));
            await filmIndex.attachFilm(key, createAttachedCatalogSelection(film));
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
    capture.assertWritable('log film');
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
        await filmIndex.attachFilm(
          readFilmKey({ title: selectedFilm.title, year: selectedFilm.year }),
          createAttachedCatalogSelection(selectedFilm)
        );
      },
      broadcastState,
      reportError: (error, phase) => console.error(`Catalog-only logging ${phase} failed.`, error)
    });
    void catalogOrchestrator.enrich();
    return result;
  });

  ipcMain.handle('movie-log:search-catalog', async (_event, query: string) => {
    await capture.beforeCatalogSearch();
    if (capture.requireLiveCatalogSuccess) {
      return searchCatalogProviders(
        capture.forceCatalogPrimaryFailure
          ? {
              searchFilms: async () => {
                throw new Error('Capture-only primary catalog failure.');
              },
              searchPosterFallback: (searchQuery, options) =>
                filmCatalog.searchPosterFallback?.(searchQuery, options) ?? Promise.resolve([])
            }
          : filmCatalog,
        query
      );
    }

    return searchCatalogWithFallback(query, {
      searchCachedFilms: capture.forceCatalogOutage ? async () => [] : filmIndex.searchFilms,
      searchLiveFilms: capture.forceCatalogOutage
        ? async () => {
            throw new Error('Catalog connection unavailable.');
          }
        : (searchQuery, signal) => searchCatalogProviders(filmCatalog, searchQuery, { signal })
    });
  });

  ipcMain.handle(
    'movie-log:match-film',
    async (
      _event,
      filmKey: string,
      film: { title: string; year: number | null },
      selection: CatalogSearchResult | null
    ) => {
      capture.assertWritable('match film');
      await filmIndex.matchFilm(filmKey, film, selection);
      await broadcastState();
    }
  );

  ipcMain.handle('movie-log:update-entry', async (_event, entryId: string, details: EntryDetails) => {
    capture.assertWritable('update entry');
    const entry = await historyStore.updateHistoryEntry(entryId, details);

    if (entry) {
      await broadcastState();
    }

    return entry;
  });

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => shell.showItemInFolder(itemPath));
  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => openPath(itemPath));
  ipcMain.handle('movie-log:scan-now', async () => {
    capture.assertWritable('scan watched folders');
    await options.getWatchedFolderSync().refreshWatchedFolders();
    void catalogOrchestrator.enrich();
  });
  ipcMain.handle('movie-log:remove-watched-folder', async (_event, folderId: string) => {
    capture.assertWritable('remove watched folder');
    const removedFolder = await historyStore.removeWatchedFolder(folderId);

    if (removedFolder) {
      options.getWatchedFolderSync().forgetFolder(removedFolder.path);
      await folderMonitor.unwatchFolder(removedFolder.path);
      await broadcastState();
    }
  });
  ipcMain.handle('movie-log:retry-film-enrichment', async () => {
    capture.assertWritable('retry film enrichment');
    await catalogOrchestrator.retry();
  });
}

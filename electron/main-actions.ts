// ABOUTME: Coordinates main-process watched-folder setup and dropped-path logging without importing Electron globals.
// ABOUTME: Keeps rollback and partial-failure behavior testable while the BrowserWindow shell stays thin.
import type {
  CatalogSearchResult,
  LogFilmRequest,
  LogPathsResult,
  WatchEntry,
  WatchedFolder
} from '../shared/types.js';

interface AddWatchedFolderPathOptions {
  queueFolderRefresh(folderPath: string): Promise<void>;
  removeWatchedFolder(folderId: string): Promise<WatchedFolder | null>;
  saveWatchedFolder(folderPath: string): Promise<WatchedFolder>;
  unwatchFolder(folderPath: string): Promise<void>;
  watchFolder(folderPath: string): Promise<void>;
}

interface LogPathsFromDropOptions {
  addHistoryEntries(entries: WatchEntry[]): Promise<WatchEntry[]>;
  broadcastState(): Promise<void>;
  createEntryForPath(itemPath: string): Promise<WatchEntry | null>;
  matchFilmForEntry?(entry: WatchEntry, film: LogFilmRequest): Promise<void>;
}

interface SearchCatalogOptions {
  liveSearchTimeoutMs?: number;
  searchCachedFilms(query: string): Promise<CatalogSearchResult[]>;
  searchLiveFilms(query: string, signal: AbortSignal): Promise<CatalogSearchResult[]>;
}

export async function addWatchedFolderPath(
  folderPath: string,
  options: AddWatchedFolderPathOptions
): Promise<WatchedFolder> {
  await options.watchFolder(folderPath);

  let folder: WatchedFolder | null = null;

  try {
    folder = await options.saveWatchedFolder(folderPath);
    await options.queueFolderRefresh(folderPath);
    return folder;
  } catch (error) {
    if (folder) {
      await options.removeWatchedFolder(folder.id);
    }

    await options.unwatchFolder(folderPath);
    throw error;
  }
}

export async function logPathsFromDrop(
  paths: string[],
  options: LogPathsFromDropOptions,
  selectedFilm?: LogFilmRequest
): Promise<LogPathsResult> {
  if (selectedFilm && paths.length !== 1) {
    throw new Error(
      'Attach one media item for this catalog film, or clear the selected catalog film before logging multiple items.'
    );
  }

  const entries: WatchEntry[] = [];
  const skippedPaths: string[] = [];

  for (const itemPath of paths) {
    try {
      const entry = await options.createEntryForPath(itemPath);

      if (entry) {
        entries.push(entry);
      } else {
        skippedPaths.push(itemPath);
      }
    } catch {
      skippedPaths.push(itemPath);
    }
  }

  if (entries.length > 0) {
    await options.addHistoryEntries(entries);

    if (selectedFilm) {
      const acceptedEntry = entries[0] as WatchEntry;

      if (!options.matchFilmForEntry) {
        throw new Error('The selected film could not be attached to this media item.');
      }

      await options.matchFilmForEntry(acceptedEntry, selectedFilm);
    }

    await options.broadcastState();
  }

  return {
    addedCount: entries.length,
    skippedPaths
  };
}

export async function searchCatalogWithFallback(
  query: string,
  options: SearchCatalogOptions
): Promise<CatalogSearchResult[]> {
  const liveSearchTimeoutMs = options.liveSearchTimeoutMs ?? 8000;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const liveFilms = await Promise.race([
      options.searchLiveFilms(query, controller.signal),
      new Promise<CatalogSearchResult[]>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Catalog request timed out.'));
        }, liveSearchTimeoutMs);
      })
    ]);

    if (liveFilms.length > 0) {
      return liveFilms;
    }

    return options.searchCachedFilms(query);
  } catch (error) {
    const cachedFilms = await options.searchCachedFilms(query);

    if (cachedFilms.length > 0) {
      return cachedFilms;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

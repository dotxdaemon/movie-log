// ABOUTME: Persists watch history and watched folders as local JSON in the desktop app data directory.
// ABOUTME: Provides the minimal read and write operations needed by the Electron process and tests.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { sortEntriesByWatchedAt } from '../shared/history.js';
import type { MovieLogState, WatchEntry, WatchedFolder } from '../shared/types.js';

interface PersistedState extends MovieLogState {
  knownPathsByFolder: Record<string, string[]>;
}

const EMPTY_STATE: PersistedState = {
  history: [],
  knownPathsByFolder: {},
  watchedFolders: []
};

function cloneState(state: PersistedState): PersistedState {
  return {
    history: [...state.history],
    knownPathsByFolder: { ...state.knownPathsByFolder },
    watchedFolders: [...state.watchedFolders]
  };
}

export function createHistoryStore(dataDirectory: string) {
  const dataFilePath = join(dataDirectory, 'movie-log.json');

  async function readPersistedState(): Promise<PersistedState> {
    await mkdir(dataDirectory, { recursive: true });

    try {
      const stored = await readFile(dataFilePath, 'utf8');
      const parsed = JSON.parse(stored) as Partial<PersistedState>;

      return {
        history: sortEntriesByWatchedAt(parsed.history ?? []),
        knownPathsByFolder: parsed.knownPathsByFolder ?? {},
        watchedFolders: parsed.watchedFolders ?? []
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        return cloneState(EMPTY_STATE);
      }

      throw error;
    }
  }

  async function writePersistedState(state: PersistedState): Promise<void> {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  return {
    async readState(): Promise<MovieLogState> {
      const state = await readPersistedState();

      return {
        history: sortEntriesByWatchedAt(state.history),
        watchedFolders: [...state.watchedFolders]
      };
    },

    async addHistoryEntry(entry: WatchEntry): Promise<WatchEntry> {
      const state = await readPersistedState();
      state.history = sortEntriesByWatchedAt([entry, ...state.history]);
      await writePersistedState(state);
      return entry;
    },

    async addHistoryEntries(entries: WatchEntry[]): Promise<WatchEntry[]> {
      const state = await readPersistedState();
      state.history = sortEntriesByWatchedAt([...entries, ...state.history]);
      await writePersistedState(state);
      return entries;
    },

    async addWatchedFolder(folderPath: string): Promise<WatchedFolder> {
      const state = await readPersistedState();
      const existing = state.watchedFolders.find((folder) => folder.path === folderPath);

      if (existing) {
        return existing;
      }

      const folder: WatchedFolder = {
        id: folderPath,
        addedAt: new Date().toISOString(),
        name: basename(folderPath) || folderPath,
        path: folderPath
      };

      state.watchedFolders = [...state.watchedFolders, folder];
      state.knownPathsByFolder[folderPath] = state.knownPathsByFolder[folderPath] ?? [];
      await writePersistedState(state);
      return folder;
    },

    async removeWatchedFolder(folderId: string): Promise<WatchedFolder | null> {
      const state = await readPersistedState();
      const folder = state.watchedFolders.find((item) => item.id === folderId) ?? null;

      if (!folder) {
        return null;
      }

      state.watchedFolders = state.watchedFolders.filter((item) => item.id !== folderId);
      delete state.knownPathsByFolder[folder.path];
      await writePersistedState(state);
      return folder;
    },

    async readKnownPaths(folderPath: string): Promise<string[]> {
      const state = await readPersistedState();
      return [...(state.knownPathsByFolder[folderPath] ?? [])];
    },

    async writeKnownPaths(folderPath: string, knownPaths: string[]): Promise<void> {
      const state = await readPersistedState();
      state.knownPathsByFolder[folderPath] = [...knownPaths];
      await writePersistedState(state);
    }
  };
}

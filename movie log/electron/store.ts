// ABOUTME: Persists watch history and watched folders as local JSON in the desktop app data directory.
// ABOUTME: Provides the minimal read and write operations needed by the Electron process and tests.
import { access, mkdir, open, readFile, rename } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ScannedFolderItem } from './folder-scan.js';
import { createEntryFromPath, sortEntriesByWatchedAt } from '../shared/history.js';
import type { LibraryItem, MovieLogState, WatchEntry, WatchedFolder } from '../shared/types.js';

const HISTORY_POLICY = 'append-only';

interface PersistedState extends MovieLogState {
  historyPolicy: typeof HISTORY_POLICY;
  knownPathsByFolder: Record<string, string[]>;
  seenKeysByFolder: Record<string, string[]>;
}

const EMPTY_STATE: PersistedState = {
  history: [],
  historyPolicy: HISTORY_POLICY,
  libraryItems: [],
  knownPathsByFolder: {},
  seenKeysByFolder: {},
  watchedFolders: []
};

function mergeHistoryEntries(existingEntries: WatchEntry[], incomingEntries: WatchEntry[]): WatchEntry[] {
  const knownEntryIds = new Set(existingEntries.map((entry) => entry.id));
  const addedEntryIds = new Set<string>();
  const uniqueIncomingEntries = incomingEntries.filter((entry) => {
    if (knownEntryIds.has(entry.id) || addedEntryIds.has(entry.id)) {
      return false;
    }

    addedEntryIds.add(entry.id);
    return true;
  });

  return sortEntriesByWatchedAt([...uniqueIncomingEntries, ...existingEntries]);
}

function sortLibraryItems(items: LibraryItem[]): LibraryItem[] {
  return [...items].sort((left, right) => left.title.localeCompare(right.title) || left.sourcePath.localeCompare(right.sourcePath));
}

function cloneState(state: PersistedState): PersistedState {
  return {
    history: [...state.history],
    historyPolicy: state.historyPolicy,
    libraryItems: [...state.libraryItems],
    knownPathsByFolder: { ...state.knownPathsByFolder },
    seenKeysByFolder: { ...state.seenKeysByFolder },
    watchedFolders: [...state.watchedFolders]
  };
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasStoredFolderValues(valuesByFolder: Record<string, string[]>, folderPath: string): boolean {
  return Object.hasOwn(valuesByFolder, folderPath);
}

function buildWatchEntries(items: ScannedFolderItem[], watchedAt: string): WatchEntry[] {
  return items.map((item) => createEntryFromPath(item.sourcePath, 'watch', watchedAt, item.sourceKind));
}

function buildHistoryFromLibraryItems(items: LibraryItem[]): WatchEntry[] {
  return sortEntriesByWatchedAt(
    items.map((item) => createEntryFromPath(item.sourcePath, 'watch', item.firstSeenAt, item.sourceKind))
  );
}

function replaceHistoryEntryPath(
  history: WatchEntry[],
  previousItem: LibraryItem,
  nextItem: LibraryItem
): WatchEntry[] {
  return sortEntriesByWatchedAt(
    history.map((entry) => {
      if (
        entry.source !== 'watch' ||
        entry.watchedAt !== previousItem.firstSeenAt ||
        entry.sourcePath !== previousItem.sourcePath
      ) {
        return entry;
      }

      return createEntryFromPath(nextItem.sourcePath, 'watch', previousItem.firstSeenAt, nextItem.sourceKind);
    })
  );
}

export function createHistoryStore(dataDirectory: string) {
  const dataFilePath = join(dataDirectory, 'movie-log.json');
  const noteFilePath = join(dataDirectory, 'movie-log-note.md');
  let stateQueue = Promise.resolve();

  function renderNote(state: PersistedState): string {
    const lines = ['# Movie Log', '', '## Recent History', ''];

    if (state.history.length === 0) {
      lines.push('- Nothing logged yet.');
    } else {
      for (const entry of sortEntriesByWatchedAt(state.history)) {
        lines.push(
          `- ${entry.watchedAt} | ${entry.title} | ${entry.sourceKind === 'file' ? 'File' : 'Folder'} | ${
            entry.source === 'drop' ? 'Manual Drop' : 'Watched Folder'
          } | ${entry.sourcePath}`
        );
      }
    }

    lines.push('', '## Watched Folders', '');

    if (state.watchedFolders.length === 0) {
      lines.push('- None');
    } else {
      for (const folder of state.watchedFolders) {
        lines.push(
          `- ${folder.name} | ${folder.path}${folder.lastScannedAt ? ` | Last scanned ${folder.lastScannedAt}` : ''}`
        );
      }
    }

    return `${lines.join('\n')}\n`;
  }

  function normalizeState(state: PersistedState): PersistedState {
    return {
      history: sortEntriesByWatchedAt(state.history),
      historyPolicy: HISTORY_POLICY,
      libraryItems: sortLibraryItems(state.libraryItems),
      knownPathsByFolder: { ...state.knownPathsByFolder },
      seenKeysByFolder: { ...state.seenKeysByFolder },
      watchedFolders: [...state.watchedFolders]
    };
  }

  async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
    const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const fileHandle = await open(temporaryPath, 'w');

    try {
      await fileHandle.writeFile(contents, 'utf8');
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }

    await rename(temporaryPath, filePath);
  }

  async function preserveUnreadableDataFile(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const invalidDataFilePath = join(dataDirectory, `movie-log.invalid.${timestamp}.json`);
    await rename(dataFilePath, invalidDataFilePath);
  }

  async function runSerialized<T>(work: () => Promise<T>): Promise<T> {
    const nextTask = stateQueue.catch(() => undefined).then(work);
    stateQueue = nextTask.then(() => undefined, () => undefined);
    return nextTask;
  }

  async function ensureNoteFile(state: PersistedState): Promise<void> {
    try {
      await access(noteFilePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        await writeFileAtomically(noteFilePath, renderNote(state));
        return;
      }

      throw error;
    }
  }

  async function readPersistedState(): Promise<PersistedState> {
    await mkdir(dataDirectory, { recursive: true });

    try {
      const stored = await readFile(dataFilePath, 'utf8');
      const parsed = JSON.parse(stored) as Partial<PersistedState>;
      const state: PersistedState = {
        history: sortEntriesByWatchedAt(parsed.history ?? []),
        historyPolicy: HISTORY_POLICY,
        libraryItems: sortLibraryItems(parsed.libraryItems ?? []),
        knownPathsByFolder: parsed.knownPathsByFolder ?? {},
        seenKeysByFolder: parsed.seenKeysByFolder ?? {},
        watchedFolders: parsed.watchedFolders ?? []
      };

      if (parsed.historyPolicy !== HISTORY_POLICY && state.history.length === 0 && state.libraryItems.length > 0) {
        state.history = buildHistoryFromLibraryItems(state.libraryItems);
        await writePersistedState(state);
        return state;
      }

      if (parsed.historyPolicy !== HISTORY_POLICY) {
        await writePersistedState(state);
        return state;
      }

      await ensureNoteFile(state);
      return state;
    } catch (error) {
      if (error instanceof SyntaxError) {
        const emptyState = cloneState(EMPTY_STATE);
        await preserveUnreadableDataFile();
        await writePersistedState(emptyState);
        return emptyState;
      }

      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        const emptyState = cloneState(EMPTY_STATE);
        await writePersistedState(emptyState);
        return emptyState;
      }

      throw error;
    }
  }

  async function writePersistedState(state: PersistedState): Promise<void> {
    const normalizedState = normalizeState(state);
    await mkdir(dataDirectory, { recursive: true });
    await writeFileAtomically(dataFilePath, `${JSON.stringify(normalizedState, null, 2)}\n`);
    await writeFileAtomically(noteFilePath, renderNote(normalizedState));
  }

  return {
    async readState(): Promise<MovieLogState> {
      return runSerialized(async () => {
        const state = await readPersistedState();

        return {
          history: sortEntriesByWatchedAt(state.history),
          libraryItems: sortLibraryItems(state.libraryItems),
          watchedFolders: [...state.watchedFolders]
        };
      });
    },

    async addHistoryEntry(entry: WatchEntry): Promise<WatchEntry> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        state.history = mergeHistoryEntries(state.history, [entry]);
        await writePersistedState(state);
        return entry;
      });
    },

    async addHistoryEntries(entries: WatchEntry[]): Promise<WatchEntry[]> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        state.history = mergeHistoryEntries(state.history, entries);
        await writePersistedState(state);
        return entries;
      });
    },

    async addWatchedFolder(folderPath: string): Promise<WatchedFolder> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        const existing = state.watchedFolders.find((folder) => folder.path === folderPath);

        if (existing) {
          return existing;
        }

        const folder: WatchedFolder = {
          id: folderPath,
          addedAt: new Date().toISOString(),
          lastScannedAt: null,
          name: basename(folderPath) || folderPath,
          path: folderPath
        };

        state.watchedFolders = [...state.watchedFolders, folder];
        state.knownPathsByFolder[folderPath] = state.knownPathsByFolder[folderPath] ?? [];
        await writePersistedState(state);
        return folder;
      });
    },

    async removeWatchedFolder(folderId: string): Promise<WatchedFolder | null> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        const folder = state.watchedFolders.find((item) => item.id === folderId) ?? null;

        if (!folder) {
          return null;
        }

        state.watchedFolders = state.watchedFolders.filter((item) => item.id !== folderId);
        state.libraryItems = state.libraryItems.filter((item) => item.folderId !== folder.id);
        delete state.knownPathsByFolder[folder.path];
        delete state.seenKeysByFolder[folder.path];
        await writePersistedState(state);
        return folder;
      });
    },

    async syncWatchedFolderContents(
      folderPath: string,
      items: ScannedFolderItem[],
      scannedAt = new Date().toISOString()
    ): Promise<WatchEntry[]> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        const folder = state.watchedFolders.find((item) => item.path === folderPath);

        if (!folder) {
          return [];
        }

        const currentFolderItems = state.libraryItems.filter((item) => item.folderPath === folderPath);
        const existingItemsById = new Map(currentFolderItems.map((item) => [item.id, item]));
        const existingItemsByPath = new Map(currentFolderItems.map((item) => [item.sourcePath, item]));
        const existingSeenKeys = state.seenKeysByFolder[folderPath] ?? [];
        const hasSeenKeys = hasStoredFolderValues(state.seenKeysByFolder, folderPath);
        const seenKeys = new Set(existingSeenKeys);
        const historyPaths = new Set(state.history.map((entry) => entry.sourcePath));
        const nextItems: LibraryItem[] = items.map((item) => {
          const existing = existingItemsById.get(item.itemKey) ?? existingItemsByPath.get(item.sourcePath);

          return {
            firstSeenAt: existing?.firstSeenAt ?? scannedAt,
            folderId: folder.id,
            folderPath,
            id: item.itemKey,
            lastSeenAt: scannedAt,
            sourceKind: item.sourceKind,
            sourcePath: item.sourcePath,
            title: item.title
          };
        });
        const nextPaths = items.map((item) => item.sourcePath);
        const nextKeys = items.map((item) => item.itemKey);
        const existingPaths = state.knownPathsByFolder[folderPath] ?? [];
        const hasSamePaths = sameValues(existingPaths, nextPaths);
        const hasSameKeys = sameValues(existingSeenKeys, nextKeys);
        const entriesToAdd = !hasSeenKeys
          ? buildWatchEntries(
              items.filter((item) => !historyPaths.has(item.sourcePath)),
              scannedAt
            )
          : buildWatchEntries(
              items.filter((item) => !seenKeys.has(item.itemKey)),
              scannedAt
            );

        if (hasSeenKeys && entriesToAdd.length === 0 && hasSamePaths && hasSameKeys && currentFolderItems.length === nextItems.length) {
          return [];
        }

        let nextHistory = state.history;

        for (const nextItem of nextItems) {
          const previousItem = existingItemsById.get(nextItem.id);

          if (!previousItem || previousItem.sourcePath === nextItem.sourcePath) {
            continue;
          }

          nextHistory = replaceHistoryEntryPath(nextHistory, previousItem, nextItem);
        }

        state.history = entriesToAdd.length === 0 ? nextHistory : mergeHistoryEntries(nextHistory, entriesToAdd);
        state.libraryItems = sortLibraryItems([
          ...state.libraryItems.filter((item) => item.folderPath !== folderPath),
          ...nextItems
        ]);
        state.knownPathsByFolder[folderPath] = nextPaths;
        state.seenKeysByFolder[folderPath] = nextKeys;
        state.watchedFolders = state.watchedFolders.map((item) =>
          item.path === folderPath ? { ...item, lastScannedAt: scannedAt } : item
        );
        await writePersistedState(state);

        return entriesToAdd;
      });
    },

    async readKnownPaths(folderPath: string): Promise<string[]> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        return [...(state.knownPathsByFolder[folderPath] ?? [])];
      });
    },

    async writeKnownPaths(folderPath: string, knownPaths: string[]): Promise<void> {
      return runSerialized(async () => {
        const state = await readPersistedState();
        const existingPaths = state.knownPathsByFolder[folderPath] ?? [];

        if (sameValues(existingPaths, knownPaths)) {
          return;
        }

        state.knownPathsByFolder[folderPath] = [...knownPaths];
        await writePersistedState(state);
      });
    },

    getDataFilePath(): string {
      return dataFilePath;
    },

    getNoteFilePath(): string {
      return noteFilePath;
    }
  };
}

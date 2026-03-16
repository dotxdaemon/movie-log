// ABOUTME: Verifies that the desktop app persists watch history and watched folders on disk.
// ABOUTME: Uses real temporary files so the store behavior matches the local desktop runtime.
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryStore } from '../electron/store.js';
import { createEntryFromPath } from '../shared/history.js';

function scannedItem(
  sourcePath: string,
  itemKey: string,
  sourceKind: 'file' | 'directory' = 'file'
) {
  return {
    itemKey,
    sourceKind,
    sourcePath,
    title: createEntryFromPath(sourcePath, 'watch', '1970-01-01T00:00:00.000Z', sourceKind).title
  };
}

describe('createHistoryStore', () => {
  let dataDirectory = '';

  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), 'movie-log-store-'));
  });

  afterEach(async () => {
    await rm(dataDirectory, { recursive: true, force: true });
  });

  it('creates the local json file and note file on first read', async () => {
    const store = createHistoryStore(dataDirectory);

    const state = await store.readState();
    const storedJson = await readFile(join(dataDirectory, 'movie-log.json'), 'utf8');
    const storedNote = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');

    expect(state).toEqual({
      history: [],
      libraryItems: [],
      watchedFolders: []
    });
    expect(JSON.parse(storedJson)).toEqual({
      history: [],
      historyPolicy: 'append-only',
      knownPathsByFolder: {},
      libraryItems: [],
      seenKeysByFolder: {},
      watchedFolders: []
    });
    expect(storedNote).toContain('# Movie Log');
    expect(storedNote).toContain('Nothing logged yet');
  });

  it('persists history and watched folders across reloads', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Media Inbox/Flow', 'drop', '2026-03-12T08:00:00.000Z')
    );
    await store.addWatchedFolder('/Users/seankim/Media Inbox');

    const reloaded = createHistoryStore(dataDirectory);
    const state = await reloaded.readState();

    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.title).toBe('Flow');
    expect(state.watchedFolders).toHaveLength(1);
    expect(state.watchedFolders[0]?.path).toBe('/Users/seankim/Media Inbox');
  });

  it('does not rewrite the readable note when state is only being read', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-12T08:00:00.000Z', 'file')
    );

    const notePath = join(dataDirectory, 'movie-log-note.md');
    const firstStats = await stat(notePath);

    await delay(20);
    await store.readState();

    const secondStats = await stat(notePath);

    expect(secondStats.mtimeMs).toBe(firstStats.mtimeMs);
  });

  it('does not add duplicate history entries for the same source path', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-12T08:00:00.000Z', 'file')
    );
    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-13T08:00:00.000Z', 'file')
    );

    const state = await store.readState();

    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.watchedAt).toBe('2026-03-12T08:00:00.000Z');
  });

  it('persists the current contents of a watched folder after a scan', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Severance', 'dev:1', 'directory'),
        scannedItem('/Users/seankim/Movies/The Brutalist.mkv', 'dev:2')
      ],
      '2026-03-12T09:00:00.000Z'
    );

    const reloaded = createHistoryStore(dataDirectory);
    const state = await reloaded.readState();

    expect(state.libraryItems.map((item) => item.title)).toEqual(['Severance', 'The Brutalist']);
    expect(state.watchedFolders[0]?.lastScannedAt).toBe('2026-03-12T09:00:00.000Z');
  });

  it('replaces removed items when a later folder scan updates the snapshot', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Severance', 'dev:1', 'directory'),
        scannedItem('/Users/seankim/Movies/The Brutalist.mkv', 'dev:2')
      ],
      '2026-03-12T09:00:00.000Z'
    );

    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Severance', 'dev:1', 'directory'),
        scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:3')
      ],
      '2026-03-13T09:00:00.000Z'
    );

    const state = await store.readState();
    const severance = state.libraryItems.find((item) => item.title === 'Severance');

    expect(state.libraryItems.map((item) => item.title)).toEqual(['Flow', 'Severance']);
    expect(severance?.firstSeenAt).toBe('2026-03-12T09:00:00.000Z');
    expect(severance?.lastSeenAt).toBe('2026-03-13T09:00:00.000Z');
  });

  it('does not return repeated items when the same folder contents are scanned again', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');

    const firstScan = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
      '2026-03-12T09:00:00.000Z'
    );
    const secondScan = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
      '2026-03-13T09:00:00.000Z'
    );

    expect(firstScan.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
    expect(secondScan).toEqual([]);
  });

  it('does not rewrite persisted files when a watched-folder scan finds no changes', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
      '2026-03-12T09:00:00.000Z'
    );

    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const firstDataStats = await stat(dataPath);
    const firstNoteStats = await stat(notePath);

    await delay(20);
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
      '2026-03-13T09:00:00.000Z'
    );

    const secondDataStats = await stat(dataPath);
    const secondNoteStats = await stat(notePath);

    expect(secondDataStats.mtimeMs).toBe(firstDataStats.mtimeMs);
    expect(secondNoteStats.mtimeMs).toBe(firstNoteStats.mtimeMs);
  });

  it('imports current watched-folder items into history on the first scan', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    const recordedEntries = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Severance', 'dev:1', 'directory'),
        scannedItem('/Users/seankim/Movies/The Brutalist.mkv', 'dev:2')
      ],
      '2026-03-12T09:00:00.000Z'
    );
    const state = await store.readState();

    expect(recordedEntries.map((entry) => entry.sourcePath)).toEqual([
      '/Users/seankim/Movies/Severance',
      '/Users/seankim/Movies/The Brutalist.mkv'
    ]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual([
      '/Users/seankim/Movies/Severance',
      '/Users/seankim/Movies/The Brutalist.mkv'
    ]);
  });

  it('updates the scanned snapshot without adding history when a watched-folder file is renamed', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
      '2026-03-12T09:00:00.000Z'
    );

    const renamedScan = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Flow (1).mkv', 'dev:1')],
      '2026-03-13T09:00:00.000Z'
    );
    const state = await store.readState();

    expect(renamedScan).toEqual([]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
    expect(state.libraryItems.map((item) => item.sourcePath)).toEqual(['/Users/seankim/Movies/Flow (1).mkv']);
  });

  it('updates the scanned snapshot without adding history when a watched-folder folder moves in place', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Severance', 'dev:1', 'directory')],
      '2026-03-12T09:00:00.000Z'
    );

    const movedScan = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [scannedItem('/Users/seankim/Movies/Severance Archive', 'dev:1', 'directory')],
      '2026-03-13T09:00:00.000Z'
    );
    const state = await store.readState();

    expect(movedScan).toEqual([]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Severance']);
    expect(state.libraryItems.map((item) => item.sourcePath)).toEqual(['/Users/seankim/Movies/Severance Archive']);
  });

  it('backfills unmarked stores into append-only history once when stable item keys are missing', async () => {
    const unmarkedState = {
      history: [createEntryFromPath('/Users/seankim/Movies/Severance', 'watch', '2026-03-12T08:00:00.000Z', 'directory')],
      knownPathsByFolder: {
        '/Users/seankim/Movies': ['/Users/seankim/Movies/Flow.mkv', '/Users/seankim/Movies/Severance']
      },
      libraryItems: [
        {
          firstSeenAt: '2026-03-12T08:00:00.000Z',
          folderId: '/Users/seankim/Movies',
          folderPath: '/Users/seankim/Movies',
          id: '/Users/seankim/Movies/Severance',
          lastSeenAt: '2026-03-12T08:00:00.000Z',
          sourceKind: 'directory',
          sourcePath: '/Users/seankim/Movies/Severance',
          title: 'Severance'
        },
        {
          firstSeenAt: '2026-03-12T08:00:00.000Z',
          folderId: '/Users/seankim/Movies',
          folderPath: '/Users/seankim/Movies',
          id: '/Users/seankim/Movies/Flow.mkv',
          lastSeenAt: '2026-03-12T08:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      watchedFolders: [
        {
          addedAt: '2026-03-12T08:00:00.000Z',
          id: '/Users/seankim/Movies',
          lastScannedAt: '2026-03-12T08:00:00.000Z',
          name: 'Movies',
          path: '/Users/seankim/Movies'
        }
      ]
    };
    await writeFile(join(dataDirectory, 'movie-log.json'), `${JSON.stringify(unmarkedState, null, 2)}\n`, 'utf8');

    const store = createHistoryStore(dataDirectory);
    const firstBackfill = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1'),
        scannedItem('/Users/seankim/Movies/Severance', 'dev:2', 'directory')
      ],
      '2026-03-13T09:00:00.000Z'
    );
    const secondBackfill = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1'),
        scannedItem('/Users/seankim/Movies/Severance', 'dev:2', 'directory')
      ],
      '2026-03-13T10:00:00.000Z'
    );
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as { historyPolicy?: string };

    expect(firstBackfill.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
    expect(secondBackfill).toEqual([]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual([
      '/Users/seankim/Movies/Flow.mkv',
      '/Users/seankim/Movies/Severance'
    ]);
    expect(storedJson.historyPolicy).toBe('append-only');
  });

  it('backfills empty history from library items when the append-only marker is missing', async () => {
    const unmarkedState = {
      history: [],
      knownPathsByFolder: {
        '/Users/seankim/Movies': ['/Users/seankim/Movies/Flow.mkv']
      },
      libraryItems: [
        {
          firstSeenAt: '2026-03-12T08:00:00.000Z',
          folderId: '/Users/seankim/Movies',
          folderPath: '/Users/seankim/Movies',
          id: 'dev:1',
          lastSeenAt: '2026-03-12T08:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      seenKeysByFolder: {
        '/Users/seankim/Movies': ['dev:1']
      },
      watchedFolders: [
        {
          addedAt: '2026-03-12T08:00:00.000Z',
          id: '/Users/seankim/Movies',
          lastScannedAt: '2026-03-12T08:00:00.000Z',
          name: 'Movies',
          path: '/Users/seankim/Movies'
        }
      ]
    };
    await writeFile(join(dataDirectory, 'movie-log.json'), `${JSON.stringify(unmarkedState, null, 2)}\n`, 'utf8');

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      history: Array<{ sourcePath: string }>;
      historyPolicy?: string;
    };

    expect(state.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
    expect(storedJson.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
    expect(storedJson.historyPolicy).toBe('append-only');
  });

  it('does not silently backfill marked append-only stores with empty history', async () => {
    const currentState = {
      history: [],
      historyPolicy: 'append-only',
      knownPathsByFolder: {
        '/Users/seankim/Movies': ['/Users/seankim/Movies/Flow.mkv']
      },
      libraryItems: [
        {
          firstSeenAt: '2026-03-12T08:00:00.000Z',
          folderId: '/Users/seankim/Movies',
          folderPath: '/Users/seankim/Movies',
          id: 'dev:1',
          lastSeenAt: '2026-03-12T08:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      seenKeysByFolder: {
        '/Users/seankim/Movies': ['dev:1']
      },
      watchedFolders: [
        {
          addedAt: '2026-03-12T08:00:00.000Z',
          id: '/Users/seankim/Movies',
          lastScannedAt: '2026-03-12T08:00:00.000Z',
          name: 'Movies',
          path: '/Users/seankim/Movies'
        }
      ]
    };
    await writeFile(join(dataDirectory, 'movie-log.json'), `${JSON.stringify(currentState, null, 2)}\n`, 'utf8');

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();

    expect(state.history).toEqual([]);
  });
});

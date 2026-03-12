// ABOUTME: Verifies that the desktop app persists watch history and watched folders on disk.
// ABOUTME: Uses real temporary files so the store behavior matches the local desktop runtime.
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryStore } from '../electron/store.js';
import { createEntryFromPath } from '../shared/history.js';

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
      knownPathsByFolder: {},
      libraryItems: [],
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
        {
          sourceKind: 'directory',
          sourcePath: '/Users/seankim/Movies/Severance',
          title: 'Severance'
        },
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/The Brutalist.mkv',
          title: 'The Brutalist'
        }
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
        {
          sourceKind: 'directory',
          sourcePath: '/Users/seankim/Movies/Severance',
          title: 'Severance'
        },
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/The Brutalist.mkv',
          title: 'The Brutalist'
        }
      ],
      '2026-03-12T09:00:00.000Z'
    );

    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        {
          sourceKind: 'directory',
          sourcePath: '/Users/seankim/Movies/Severance',
          title: 'Severance'
        },
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
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
      [
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      '2026-03-12T09:00:00.000Z'
    );
    const secondScan = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      '2026-03-13T09:00:00.000Z'
    );

    expect(firstScan).toEqual([
      {
        sourceKind: 'file',
        sourcePath: '/Users/seankim/Movies/Flow.mkv',
        title: 'Flow'
      }
    ]);
    expect(secondScan).toEqual([]);
  });

  it('does not rewrite persisted files when a watched-folder scan finds no changes', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      '2026-03-12T09:00:00.000Z'
    );

    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const firstDataStats = await stat(dataPath);
    const firstNoteStats = await stat(notePath);

    await delay(20);
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/Flow.mkv',
          title: 'Flow'
        }
      ],
      '2026-03-13T09:00:00.000Z'
    );

    const secondDataStats = await stat(dataPath);
    const secondNoteStats = await stat(notePath);

    expect(secondDataStats.mtimeMs).toBe(firstDataStats.mtimeMs);
    expect(secondNoteStats.mtimeMs).toBe(firstNoteStats.mtimeMs);
  });

  it('records the current watched-folder contents into history without duplicates', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        {
          sourceKind: 'directory',
          sourcePath: '/Users/seankim/Movies/Severance',
          title: 'Severance'
        },
        {
          sourceKind: 'file',
          sourcePath: '/Users/seankim/Movies/The Brutalist.mkv',
          title: 'The Brutalist'
        }
      ],
      '2026-03-12T09:00:00.000Z'
    );

    const firstRecord = await store.recordWatchedFolderContents('/Users/seankim/Movies', '2026-03-12T10:00:00.000Z');
    const secondRecord = await store.recordWatchedFolderContents('/Users/seankim/Movies', '2026-03-12T11:00:00.000Z');
    const state = await store.readState();

    expect(firstRecord.map((entry) => entry.sourcePath)).toEqual([
      '/Users/seankim/Movies/Severance',
      '/Users/seankim/Movies/The Brutalist.mkv'
    ]);
    expect(secondRecord).toEqual([]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual([
      '/Users/seankim/Movies/Severance',
      '/Users/seankim/Movies/The Brutalist.mkv'
    ]);
  });

  it('clears history without removing watched folders', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z', 'file')
    );
    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.clearHistory();

    const state = await store.readState();

    expect(state.history).toEqual([]);
    expect(state.watchedFolders).toHaveLength(1);
  });
});

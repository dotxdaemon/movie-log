// ABOUTME: Verifies that the desktop app persists watch history and watched folders on disk.
// ABOUTME: Uses real temporary files so the store behavior matches the local desktop runtime.
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanFolderContents } from '../electron/folder-scan.js';
import { atomicWriteFile, createHistoryStore } from '../electron/store.js';
import { createEntryFromPath } from '../shared/history.js';

function scannedItem(sourcePath: string, itemKey: string, sourceKind: 'file' | 'directory' = 'file', addedAt?: string) {
  return {
    addedAt,
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

  it('persists viewing annotations without reducing append-only history or note rows', async () => {
    const store = createHistoryStore(dataDirectory);
    const entry = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z');
    await store.addHistoryEntry(entry);
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const noteBefore = await readFile(notePath, 'utf8');

    await store.updateHistoryEntry(entry.id, {
      favorite: true,
      rating: 4.5,
      review: 'Quiet, precise, and unexpectedly moving.',
      rewatch: true,
      tags: ['Animation', 'Drama'],
      viewingFormat: 'Digital'
    });

    const reloaded = createHistoryStore(dataDirectory);
    const state = await reloaded.readState();
    const noteAfter = await readFile(notePath, 'utf8');

    expect(state.history[0]).toMatchObject({
      favorite: true,
      rating: 4.5,
      review: 'Quiet, precise, and unexpectedly moving.',
      rewatch: true,
      tags: ['Animation', 'Drama'],
      viewingFormat: 'Digital'
    });
    expect(noteAfter.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(
      noteBefore.split('\n').filter((line) => line.startsWith('- ')).length
    );
  });

  it('preserves the watched timestamp when an annotation form omits its date field', async () => {
    const store = createHistoryStore(dataDirectory);
    const entry = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z');
    await store.addHistoryEntry(entry);
    const details = { review: 'Edited without a date control.', watchedAt: undefined };

    await store.updateHistoryEntry(entry.id, details);

    const reloaded = createHistoryStore(dataDirectory);
    expect((await reloaded.readState()).history[0]).toMatchObject({
      review: 'Edited without a date control.',
      watchedAt: '2026-03-12T08:00:00.000Z'
    });
  });

  it('updates the viewing date when an edit supplies a new local date', async () => {
    const store = createHistoryStore(dataDirectory);
    const entry = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z');
    await store.addHistoryEntry(entry);

    const updated = await store.updateHistoryEntry(entry.id, {
      watchedAt: '2026-03-10T18:00:00.000Z'
    });

    expect(updated).toMatchObject({
      id: entry.id,
      watchedAt: '2026-03-10T18:00:00.000Z'
    });
    expect((await store.readState()).history[0]?.watchedAt).toBe('2026-03-10T18:00:00.000Z');
    expect(await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8')).toContain('2026-03-10T18:00:00.000Z');
  });

  it('deletes one explicitly selected viewing and snapshots the previous journal', async () => {
    const store = createHistoryStore(dataDirectory);
    const flow = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z');
    const heat = createEntryFromPath('/Users/seankim/Movies/Heat.mkv', 'drop', '2026-03-11T08:00:00.000Z');
    await store.addHistoryEntries([flow, heat]);

    const deleted = await store.deleteHistoryEntry(flow.id);
    const state = await store.readState();
    const note = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');
    const snapshotDirectories = await readdir(join(dataDirectory, 'history-snapshots'));
    const latestSnapshot = snapshotDirectories.sort().at(-1) ?? '';
    const snapshot = JSON.parse(
      await readFile(join(dataDirectory, 'history-snapshots', latestSnapshot, 'movie-log.json'), 'utf8')
    ) as { history: Array<{ id: string }> };

    expect(deleted?.id).toBe(flow.id);
    expect(state.history.map((entry) => entry.id)).toEqual([heat.id]);
    expect(note).not.toContain('Flow.mkv');
    expect(note).toContain('Heat.mkv');
    expect(snapshot.history.map((entry) => entry.id)).toEqual(expect.arrayContaining([flow.id, heat.id]));
    expect(await store.deleteHistoryEntry(flow.id)).toBeNull();
  });

  it('rolls back both history files when deletion cannot commit the paired note', async () => {
    const store = createHistoryStore(dataDirectory);
    const flow = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'drop', '2026-03-12T08:00:00.000Z');
    const heat = createEntryFromPath('/Users/seankim/Movies/Heat.mkv', 'drop', '2026-03-11T08:00:00.000Z');
    await store.addHistoryEntries([flow, heat]);

    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const dataBefore = await readFile(dataPath, 'utf8');
    const noteBefore = await readFile(notePath, 'utf8');
    let rejectNextNoteWrite = true;
    const failingStore = createHistoryStore(dataDirectory, {
      writeFile: async (filePath, contents) => {
        if (filePath === notePath && rejectNextNoteWrite) {
          rejectNextNoteWrite = false;
          throw new Error('Injected note commit failure.');
        }

        await atomicWriteFile(filePath, contents);
      }
    });

    await expect(failingStore.deleteHistoryEntry(flow.id)).rejects.toThrow('Injected note commit failure.');

    expect(await readFile(dataPath, 'utf8')).toBe(dataBefore);
    expect(await readFile(notePath, 'utf8')).toBe(noteBefore);
    expect((await createHistoryStore(dataDirectory).readState()).history.map((entry) => entry.id)).toEqual([
      flow.id,
      heat.id
    ]);
  });

  it('does not reveal an older hidden watcher duplicate after its visible viewing is deleted', async () => {
    const store = createHistoryStore(dataDirectory);
    const older = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-11T08:00:00.000Z', 'file');
    const newer = createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-12T08:00:00.000Z', 'file');
    await store.addHistoryEntries([newer, older]);

    await store.deleteHistoryEntry(older.id);

    expect((await store.readState()).history).toEqual([]);
    const stored = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      history: Array<{ sourcePath: string }>;
    };
    expect(stored.history).toEqual([]);
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

  it('keeps the earliest watched-folder entry when the same source path is logged twice', async () => {
    const store = createHistoryStore(dataDirectory);
    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-13T08:00:00.000Z', 'file')
    );
    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-12T08:00:00.000Z', 'file')
    );

    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(dataPath, 'utf8')) as { history: Array<{ watchedAt: string }> };
    const note = await readFile(notePath, 'utf8');

    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.watchedAt).toBe('2026-03-12T08:00:00.000Z');
    expect(storedJson.history.map((entry) => entry.watchedAt)).toEqual([
      '2026-03-13T08:00:00.000Z',
      '2026-03-12T08:00:00.000Z'
    ]);
    expect(note).toContain('2026-03-12T08:00:00.000Z | Flow | File | Watched Folder | /Users/seankim/Movies/Flow.mkv');
    expect(note).toContain('2026-03-13T08:00:00.000Z | Flow | File | Watched Folder | /Users/seankim/Movies/Flow.mkv');
  });

  it('repairs stored titles from source paths', async () => {
    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const sourcePath = '/Users/seankim/Movies/Fantasy.Life.2025.1008p.AMZN.WEB-DL.DDP5.1.H.264-CHORTLE.mkv';
    const watchedAt = '2026-03-12T08:00:00.000Z';
    const title = 'Fantasy.Life.2025.1008p.AMZN.WEB-DL.DDP5.1.H.264-CHORTLE';
    const shortTitle = 'Fantasy Life 2025';

    await writeFile(
      dataPath,
      `${JSON.stringify(
        {
          history: [
            {
              id: `${watchedAt}:${sourcePath}`,
              source: 'watch',
              sourceKind: 'file',
              sourcePath,
              title: shortTitle,
              watchedAt
            }
          ],
          historyPolicy: 'append-only',
          knownPathsByFolder: {},
          libraryItems: [
            {
              firstSeenAt: watchedAt,
              folderId: 'folder',
              folderPath: '/Users/seankim/Movies',
              id: 'dev:1',
              lastSeenAt: watchedAt,
              sourceKind: 'file',
              sourcePath,
              title: shortTitle
            }
          ],
          seenKeysByFolder: {},
          watchedFolders: []
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      notePath,
      `# Movie Log\n\n## History\n\n- ${watchedAt} | ${shortTitle} | File | Watched Folder | ${sourcePath}\n\n## Watched Folders\n\n- None\n`
    );

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(dataPath, 'utf8')) as {
      history: Array<{ title: string }>;
      libraryItems: Array<{ title: string }>;
    };
    const note = await readFile(notePath, 'utf8');

    expect(state.history[0]?.title).toBe(title);
    expect(storedJson.history[0]?.title).toBe(title);
    expect(storedJson.libraryItems[0]?.title).toBe(title);
    expect(note).toContain(`- ${watchedAt} | ${title} | File | Watched Folder | ${sourcePath}`);
    expect(note).not.toContain(`| ${shortTitle} | File |`);
  });

  it('preserves overlapping manual and watched-folder writes', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.readState();
    await store.addWatchedFolder('/Users/seankim/Movies');

    const manualEntries = Array.from({ length: 20 }, (_, index) =>
      createEntryFromPath(
        `/Users/seankim/Manual/Drop ${index + 1}.mkv`,
        'drop',
        `2026-03-12T08:${index.toString().padStart(2, '0')}:00.000Z`,
        'file'
      )
    );

    await Promise.all([
      ...manualEntries.map((entry) => store.addHistoryEntry(entry)),
      store.syncWatchedFolderContents(
        '/Users/seankim/Movies',
        [scannedItem('/Users/seankim/Movies/Flow.mkv', 'dev:1')],
        '2026-03-12T09:00:00.000Z'
      )
    ]);

    const state = await store.readState();

    expect(state.history).toHaveLength(21);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual(
      expect.arrayContaining(['/Users/seankim/Movies/Flow.mkv', ...manualEntries.map((entry) => entry.sourcePath)])
    );
    expect(state.libraryItems.map((item) => item.sourcePath)).toEqual(['/Users/seankim/Movies/Flow.mkv']);
  });

  it('recovers from an unreadable json file without crashing startup', async () => {
    const dataFilePath = join(dataDirectory, 'movie-log.json');
    const unreadableContents = '{"history": [';
    await writeFile(dataFilePath, unreadableContents, 'utf8');

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();
    const recoveredJson = JSON.parse(await readFile(dataFilePath, 'utf8')) as {
      history: unknown[];
      historyPolicy: string;
      knownPathsByFolder: Record<string, string[]>;
      libraryItems: unknown[];
      seenKeysByFolder: Record<string, string[]>;
      watchedFolders: unknown[];
    };
    const preservedFileName = (await readdir(dataDirectory)).find((fileName) =>
      /^movie-log\.invalid\..+\.json$/.test(fileName)
    );

    expect(preservedFileName).toBeDefined();
    const preservedEntries = await readFile(join(dataDirectory, preservedFileName ?? ''), 'utf8');

    expect(state).toEqual({
      history: [],
      libraryItems: [],
      watchedFolders: []
    });
    expect(recoveredJson).toEqual({
      history: [],
      historyPolicy: 'append-only',
      knownPathsByFolder: {},
      libraryItems: [],
      seenKeysByFolder: {},
      watchedFolders: []
    });
    expect(preservedEntries).toBe(unreadableContents);
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

  it('keeps both hard-linked paths after an unchanged second scan', async () => {
    const watchedFolderPath = join(dataDirectory, 'Movies');
    const firstFilePath = join(watchedFolderPath, 'One.mkv');
    const secondFilePath = join(watchedFolderPath, 'Two.mkv');
    const store = createHistoryStore(dataDirectory);

    await mkdir(watchedFolderPath, { recursive: true });
    await writeFile(firstFilePath, 'movie', 'utf8');
    await link(firstFilePath, secondFilePath);
    await store.addWatchedFolder(watchedFolderPath);

    const items = await scanFolderContents(watchedFolderPath);
    await store.syncWatchedFolderContents(watchedFolderPath, items, '2026-03-12T09:00:00.000Z');
    await store.syncWatchedFolderContents(watchedFolderPath, items, '2026-03-13T09:00:00.000Z');

    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      history: Array<{ sourcePath: string }>;
    };
    const note = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');
    const expectedPaths = [firstFilePath, secondFilePath];

    expect(state.history.map((entry) => entry.sourcePath).sort()).toEqual(expectedPaths);
    expect(state.libraryItems.map((item) => item.sourcePath).sort()).toEqual(expectedPaths);
    expect(storedJson.history.map((entry) => entry.sourcePath).sort()).toEqual(expectedPaths);
    expect(note.split(`| ${firstFilePath}`).length - 1).toBe(1);
    expect(note.split(`| ${secondFilePath}`).length - 1).toBe(1);
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

  it('uses a scanned item added time instead of the scan time for first import', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    const recordedEntries = await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem(
          '/Users/seankim/Movies/Dtf.St.Louis.S01e01.Cornhole.1080P.Amzn.Web-Dl.Ddp5.1.Atmos.H.265.mp4',
          'dev:1',
          'file',
          '2026-03-02T20:19:04.000Z'
        )
      ],
      '2026-04-06T15:54:20.342Z'
    );
    const state = await store.readState();

    expect(recordedEntries[0]?.watchedAt).toBe('2026-03-02T20:19:04.000Z');
    expect(state.history[0]?.watchedAt).toBe('2026-03-02T20:19:04.000Z');
    expect(state.libraryItems[0]?.firstSeenAt).toBe('2026-03-02T20:19:04.000Z');
  });

  it('rewrites an existing watched-folder entry when a later scan finds an earlier added time', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem(
          '/Users/seankim/Movies/Dtf.St.Louis.S01e01.Cornhole.1080P.Amzn.Web-Dl.Ddp5.1.Atmos.H.265.mp4',
          'dev:1'
        )
      ],
      '2026-04-06T15:54:20.342Z'
    );

    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem(
          '/Users/seankim/Movies/Dtf.St.Louis.S01e01.Cornhole.1080P.Amzn.Web-Dl.Ddp5.1.Atmos.H.265.mp4',
          'dev:1',
          'file',
          '2026-03-02T20:19:04.000Z'
        )
      ],
      '2026-04-06T16:10:00.000Z'
    );

    const state = await store.readState();

    expect(state.history[0]?.watchedAt).toBe('2026-03-02T20:19:04.000Z');
    expect(state.libraryItems[0]?.firstSeenAt).toBe('2026-03-02T20:19:04.000Z');
  });

  it('rewrites an existing watched-folder entry when Finder date added is later than the stored creation time', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addWatchedFolder('/Users/seankim/Movies');
    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem(
          '/Users/seankim/Movies/Y Tu Mama Tambien 2001 Criterion (1080p x265 10bit Tigole).mkv',
          'dev:1',
          'file',
          '2023-12-19T17:35:21.000Z'
        )
      ],
      '2026-04-06T15:54:20.342Z'
    );

    await store.syncWatchedFolderContents(
      '/Users/seankim/Movies',
      [
        scannedItem(
          '/Users/seankim/Movies/Y Tu Mama Tambien 2001 Criterion (1080p x265 10bit Tigole).mkv',
          'dev:1',
          'file',
          '2026-04-06T01:44:32.000Z'
        )
      ],
      '2026-04-06T16:10:00.000Z'
    );

    const state = await store.readState();

    expect(state.history[0]?.watchedAt).toBe('2026-04-06T01:44:32.000Z');
    expect(state.libraryItems[0]?.firstSeenAt).toBe('2026-04-06T01:44:32.000Z');
  });

  it('repairs stale watched-folder history from the filesystem when snapshot data is missing', async () => {
    const watchedFolderPath = join(dataDirectory, 'Movies');
    const filePath = join(watchedFolderPath, 'Dtf.St.Louis.S01e01.Cornhole.1080P.Amzn.Web-Dl.Ddp5.1.Atmos.H.265.mp4');

    await mkdir(watchedFolderPath, { recursive: true });
    await writeFile(filePath, 'dtf', 'utf8');

    const fileStats = await stat(filePath);
    const addedAt = fileStats.birthtimeMs > 0 ? fileStats.birthtime.toISOString() : fileStats.mtime.toISOString();
    const staleScanTime = '2026-04-07T15:54:20.342Z';

    await writeFile(
      join(dataDirectory, 'movie-log.json'),
      `${JSON.stringify(
        {
          history: [createEntryFromPath(filePath, 'watch', staleScanTime, 'file')],
          historyPolicy: 'append-only',
          knownPathsByFolder: {
            [watchedFolderPath]: []
          },
          libraryItems: [],
          seenKeysByFolder: {
            [watchedFolderPath]: []
          },
          watchedFolders: [
            {
              addedAt: '2026-03-12T08:00:00.000Z',
              id: watchedFolderPath,
              lastScannedAt: staleScanTime,
              name: 'Movies',
              path: watchedFolderPath
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();

    expect(state.history[0]?.watchedAt).toBe(addedAt);
    expect(state.libraryItems[0]?.firstSeenAt).toBe(addedAt);
  });

  it('keeps stored history rows when a repair write has fewer entries', async () => {
    const watchedFolderPath = join(dataDirectory, 'Movies');
    const currentFilePath = join(watchedFolderPath, 'Flow.mkv');
    const absentFilePath = join(watchedFolderPath, 'Absent.mkv');
    const staleScanTime = '2026-04-07T15:54:20.342Z';

    await mkdir(watchedFolderPath, { recursive: true });
    await writeFile(currentFilePath, 'flow', 'utf8');
    await writeFile(
      join(dataDirectory, 'movie-log.json'),
      `${JSON.stringify(
        {
          history: [
            createEntryFromPath(currentFilePath, 'watch', staleScanTime, 'file'),
            createEntryFromPath(absentFilePath, 'watch', '2026-04-06T15:54:20.342Z', 'file')
          ],
          historyPolicy: 'append-only',
          knownPathsByFolder: {
            [watchedFolderPath]: []
          },
          libraryItems: [],
          seenKeysByFolder: {
            [watchedFolderPath]: []
          },
          watchedFolders: [
            {
              addedAt: '2026-03-12T08:00:00.000Z',
              id: watchedFolderPath,
              lastScannedAt: staleScanTime,
              name: 'Movies',
              path: watchedFolderPath
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      history: Array<{ sourcePath: string }>;
    };
    const note = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');

    expect(state.history.map((entry) => entry.sourcePath)).toEqual(
      expect.arrayContaining([currentFilePath, absentFilePath])
    );
    expect(storedJson.history.map((entry) => entry.sourcePath)).toEqual(
      expect.arrayContaining([currentFilePath, absentFilePath])
    );
    expect(storedJson.history).toHaveLength(2);
    expect(note).toContain(absentFilePath);
  });

  it('keeps stored history rows when a repair finds the same number of different items', async () => {
    const watchedFolderPath = join(dataDirectory, 'Movies');
    const currentFilePath = join(watchedFolderPath, 'Current.mkv');
    const absentFilePath = join(watchedFolderPath, 'Absent.mkv');
    const staleScanTime = '2026-04-07T15:54:20.342Z';

    await mkdir(watchedFolderPath, { recursive: true });
    await writeFile(currentFilePath, 'current', 'utf8');
    await writeFile(
      join(dataDirectory, 'movie-log.json'),
      `${JSON.stringify(
        {
          history: [createEntryFromPath(absentFilePath, 'watch', staleScanTime, 'file')],
          historyPolicy: 'append-only',
          knownPathsByFolder: {
            [watchedFolderPath]: []
          },
          libraryItems: [],
          seenKeysByFolder: {
            [watchedFolderPath]: []
          },
          watchedFolders: [
            {
              addedAt: '2026-03-12T08:00:00.000Z',
              id: watchedFolderPath,
              lastScannedAt: staleScanTime,
              name: 'Movies',
              path: watchedFolderPath
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const store = createHistoryStore(dataDirectory);
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      history: Array<{ sourcePath: string }>;
    };
    const note = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');

    expect(state.history.map((entry) => entry.sourcePath)).toEqual(
      expect.arrayContaining([currentFilePath, absentFilePath])
    );
    expect(storedJson.history.map((entry) => entry.sourcePath)).toEqual(
      expect.arrayContaining([currentFilePath, absentFilePath])
    );
    expect(storedJson.history).toHaveLength(2);
    expect(note).toContain(absentFilePath);
  });

  it('creates durable file snapshots before replacing store files', async () => {
    const store = createHistoryStore(dataDirectory);
    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Flow.mkv', 'watch', '2026-03-12T08:00:00.000Z', 'file')
    );

    const firstJson = await readFile(dataPath, 'utf8');
    const firstNote = await readFile(notePath, 'utf8');

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Movies/Severance.mkv', 'watch', '2026-03-13T08:00:00.000Z', 'file')
    );

    const snapshotRoot = join(dataDirectory, 'history-snapshots');
    const snapshotDirectories = await readdir(snapshotRoot);
    const snapshots = await Promise.all(
      snapshotDirectories.map(async (snapshotDirectory) => ({
        json: await readFile(join(snapshotRoot, snapshotDirectory, 'movie-log.json'), 'utf8'),
        note: await readFile(join(snapshotRoot, snapshotDirectory, 'movie-log-note.md'), 'utf8')
      }))
    );

    expect(snapshots).toContainEqual({
      json: firstJson,
      note: firstNote
    });
  });

  it('refuses to replace the readable note with fewer history rows', async () => {
    const dataPath = join(dataDirectory, 'movie-log.json');
    const notePath = join(dataDirectory, 'movie-log-note.md');
    const storedEntry = createEntryFromPath(
      '/Users/seankim/Movies/Flow.mkv',
      'watch',
      '2026-03-12T08:00:00.000Z',
      'file'
    );
    const missingNoteRow =
      '- 2026-03-11T08:00:00.000Z | Missing.mkv | File | Watched Folder | /Users/seankim/Movies/Missing.mkv';

    await writeFile(
      dataPath,
      `${JSON.stringify(
        {
          history: [storedEntry],
          historyPolicy: 'append-only',
          knownPathsByFolder: {},
          libraryItems: [],
          seenKeysByFolder: {},
          watchedFolders: []
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(
      notePath,
      `# Movie Log\n\n## History\n\n- ${storedEntry.watchedAt} | ${storedEntry.title} | File | Watched Folder | ${storedEntry.sourcePath}\n${missingNoteRow}\n\n## Watched Folders\n\n- None\n`,
      'utf8'
    );

    const store = createHistoryStore(dataDirectory);

    await expect(store.addWatchedFolder('/Users/seankim/Movies')).rejects.toThrow('Refusing to write Movie Log note');

    const storedJson = JSON.parse(await readFile(dataPath, 'utf8')) as { watchedFolders: unknown[] };
    const note = await readFile(notePath, 'utf8');

    expect(storedJson.watchedFolders).toEqual([]);
    expect(note).toContain(missingNoteRow);
  });

  it('keeps newline characters in filenames from creating extra note rows', async () => {
    const moviesPath = join(dataDirectory, 'Movies');
    const filePath = join(moviesPath, 'Flow\n- forged.mkv');
    const store = createHistoryStore(dataDirectory);

    await mkdir(moviesPath, { recursive: true });
    await writeFile(filePath, 'movie', 'utf8');
    await store.addHistoryEntry(createEntryFromPath(filePath, 'drop', '2026-07-09T12:00:00.000Z', 'file'));

    await expect(store.addWatchedFolder(join(dataDirectory, 'Inbox'))).resolves.toBeDefined();

    const note = await readFile(join(dataDirectory, 'movie-log-note.md'), 'utf8');
    const historyRows = note
      .split('\n## Watched Folders\n')[0]
      .split('\n')
      .filter((line) => line.startsWith('- '));

    expect(historyRows).toHaveLength(1);
    expect(note).toContain('Flow\\n- forged | File | Manual Drop');
    expect(note).toContain(`| ${moviesPath}/Flow\\n- forged.mkv`);
    expect(note).not.toContain('\n- forged');
  });

  it('updates history paths when a watched-folder file is renamed in place', async () => {
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
    expect(state.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Flow (1).mkv']);
    expect(state.libraryItems.map((item) => item.sourcePath)).toEqual(['/Users/seankim/Movies/Flow (1).mkv']);
  });

  it('updates history paths when a watched-folder folder moves in place', async () => {
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
    expect(state.history.map((entry) => entry.sourcePath)).toEqual(['/Users/seankim/Movies/Severance Archive']);
    expect(state.libraryItems.map((item) => item.sourcePath)).toEqual(['/Users/seankim/Movies/Severance Archive']);
  });

  it('preserves watched-folder identity when the same folder is re-added at a new path', async () => {
    const rootPath = join(dataDirectory, 'Movies');
    const firstFolderPath = join(rootPath, 'Inbox');
    const secondFolderPath = join(rootPath, 'Archive');
    await mkdir(firstFolderPath, { recursive: true });

    const currentState = {
      history: [createEntryFromPath(`${firstFolderPath}/Flow.mkv`, 'watch', '2026-03-12T08:00:00.000Z', 'file')],
      historyPolicy: 'append-only',
      knownPathsByFolder: {
        [firstFolderPath]: [`${firstFolderPath}/Flow.mkv`]
      },
      libraryItems: [
        {
          firstSeenAt: '2026-03-12T08:00:00.000Z',
          folderId: firstFolderPath,
          folderPath: firstFolderPath,
          id: 'dev:1',
          lastSeenAt: '2026-03-12T08:00:00.000Z',
          sourceKind: 'file',
          sourcePath: `${firstFolderPath}/Flow.mkv`,
          title: 'Flow'
        }
      ],
      seenKeysByFolder: {
        [firstFolderPath]: ['dev:1']
      },
      watchedFolders: [
        {
          addedAt: '2026-03-12T08:00:00.000Z',
          id: firstFolderPath,
          lastScannedAt: '2026-03-12T08:00:00.000Z',
          name: 'Inbox',
          path: firstFolderPath
        }
      ]
    };
    await writeFile(join(dataDirectory, 'movie-log.json'), `${JSON.stringify(currentState, null, 2)}\n`, 'utf8');

    const store = createHistoryStore(dataDirectory);
    const stableFolderId = `${(await stat(firstFolderPath)).dev}:${(await stat(firstFolderPath)).ino}`;
    await store.readState();
    await rename(firstFolderPath, secondFolderPath);
    const folder = await store.addWatchedFolder(secondFolderPath);
    const recordedEntries = await store.syncWatchedFolderContents(
      secondFolderPath,
      [scannedItem(`${secondFolderPath}/Flow.mkv`, 'dev:1')],
      '2026-03-13T09:00:00.000Z'
    );
    const state = await store.readState();
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      knownPathsByFolder: Record<string, string[]>;
      watchedFolders: Array<{ addedAt: string; id: string; path: string }>;
    };

    expect(folder).toEqual({
      addedAt: '2026-03-12T08:00:00.000Z',
      id: stableFolderId,
      lastScannedAt: '2026-03-12T08:00:00.000Z',
      name: 'Archive',
      path: secondFolderPath
    });
    expect(recordedEntries).toEqual([]);
    expect(state.watchedFolders).toEqual([
      {
        addedAt: '2026-03-12T08:00:00.000Z',
        id: stableFolderId,
        lastScannedAt: '2026-03-13T09:00:00.000Z',
        name: 'Archive',
        path: secondFolderPath
      }
    ]);
    expect(state.history.map((entry) => entry.sourcePath)).toEqual([`${secondFolderPath}/Flow.mkv`]);
    expect(state.libraryItems).toEqual([
      {
        firstSeenAt: '2026-03-12T08:00:00.000Z',
        folderId: stableFolderId,
        folderPath: secondFolderPath,
        id: 'dev:1',
        lastSeenAt: '2026-03-13T09:00:00.000Z',
        sourceKind: 'file',
        sourcePath: `${secondFolderPath}/Flow.mkv`,
        title: 'Flow'
      }
    ]);
    expect(storedJson.knownPathsByFolder).toEqual({
      [secondFolderPath]: [`${secondFolderPath}/Flow.mkv`]
    });
    expect(storedJson.watchedFolders).toEqual([
      {
        addedAt: '2026-03-12T08:00:00.000Z',
        id: stableFolderId,
        lastScannedAt: '2026-03-13T09:00:00.000Z',
        name: 'Archive',
        path: secondFolderPath
      }
    ]);
  });

  it('backfills unmarked stores into append-only history once when stable item keys are missing', async () => {
    const unmarkedState = {
      history: [
        createEntryFromPath('/Users/seankim/Movies/Severance', 'watch', '2026-03-12T08:00:00.000Z', 'directory')
      ],
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
    const storedJson = JSON.parse(await readFile(join(dataDirectory, 'movie-log.json'), 'utf8')) as {
      historyPolicy?: string;
    };

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

// ABOUTME: Verifies that watched folders only emit newly added top-level items after startup.
// ABOUTME: Uses the real filesystem so the monitor logic matches how the desktop app discovers media.
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFolderMonitor } from '../electron/folder-monitor.js';
import { scanFolderContents } from '../electron/folder-scan.js';
import { createHistoryStore } from '../electron/store.js';

async function waitForDiscovery(paths: string[]) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (paths.length > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error('Timed out waiting for a watched-folder discovery');
}

async function waitForHistory(store: ReturnType<typeof createHistoryStore>) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await store.readState();

    if (state.history.length > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error('Timed out waiting for watched-folder history to be recorded');
}

async function waitForLibraryItemCount(store: ReturnType<typeof createHistoryStore>, expectedCount: number) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await store.readState();

    if (state.libraryItems.length === expectedCount) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Timed out waiting for watched-folder library item count ${expectedCount}`);
}

async function waitForFlag(getValue: () => boolean, label: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (getValue()) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

describe('createFolderMonitor', () => {
  let rootDirectory = '';

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'movie-log-watch-'));
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('ignores hidden and non-media files and emits newly added top-level folders and media files', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    await mkdir(inboxPath);
    await writeFile(join(inboxPath, 'Already There.txt'), 'text');
    await writeFile(join(inboxPath, '.DS_Store'), 'junk');

    const changedFolders: string[] = [];
    let visibleItems: string[] = [];
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async (folderPath) => {
        changedFolders.push(folderPath);
        visibleItems = (await scanFolderContents(folderPath)).map((item) => item.sourcePath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await writeFile(join(inboxPath, '.localized'), 'junk');
    await writeFile(join(inboxPath, 'Just Added.txt'), 'text');
    await mkdir(join(inboxPath, 'Movie Folder'));
    await writeFile(join(inboxPath, 'Movie File.mkv'), 'movie');
    await waitForDiscovery(changedFolders);
    await monitor.dispose();

    expect(changedFolders).toEqual([inboxPath]);
    expect(visibleItems).toEqual([join(inboxPath, 'Movie File.mkv'), join(inboxPath, 'Movie Folder')]);
  });

  it('does not throw when a watched folder is missing', async () => {
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async () => {}
    });

    await expect(monitor.watchFolder(join(rootDirectory, 'Missing Folder'))).resolves.toBeUndefined();
    await monitor.dispose();
  });

  it('starts watching a missing folder when the folder appears later', async () => {
    const missingPath = join(rootDirectory, 'Missing Folder');
    const changedFolders: string[] = [];
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async (folderPath) => {
        changedFolders.push(folderPath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(missingPath);
    await delay(50);
    await mkdir(missingPath);
    await delay(50);
    await writeFile(join(missingPath, 'Flow.mkv'), 'movie');
    await waitForDiscovery(changedFolders);
    await monitor.dispose();

    expect(changedFolders).toEqual([missingPath]);
  });

  it('does not keep rescanning a watched folder while it is idle', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    await mkdir(inboxPath);

    let saveCount = 0;
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        saveCount += 1;
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async () => {},
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await delay(180);
    const settledSaveCount = saveCount;
    await delay(180);
    await monitor.dispose();

    expect(saveCount).toBe(settledSaveCount);
    expect(saveCount).toBe(0);
  });

  it('does not sync until an arrival happens after watching starts', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    const existingPath = join(inboxPath, 'Already There.mkv');
    const arrivalPath = join(inboxPath, 'Just Arrived.mkv');
    await mkdir(inboxPath);
    await writeFile(existingPath, 'movie');

    const changedFolders: string[] = [];
    let saveCount = 0;
    let resolveKnownPathsWrite: (() => void) | null = null;
    const knownPathsWritten = new Promise<void>((resolve) => {
      resolveKnownPathsWrite = resolve;
    });
    const knownByFolder = new Map<string, string[]>([[inboxPath, [existingPath]]]);
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        saveCount += 1;
        knownByFolder.set(folderPath, knownPaths);
        resolveKnownPathsWrite?.();
      },
      onChange: async (folderPath) => {
        changedFolders.push(folderPath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await delay(80);

    expect(saveCount).toBe(0);
    expect(changedFolders).toEqual([]);

    await writeFile(arrivalPath, 'movie');
    await waitForDiscovery(changedFolders);
    await knownPathsWritten;
    await monitor.dispose();

    expect(changedFolders).toEqual([inboxPath]);
    expect(knownByFolder.get(inboxPath)).toEqual([existingPath, arrivalPath]);
  });

  it('records one history entry when a new top-level item arrives in a watched folder', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    const dataDirectory = join(rootDirectory, 'Data');
    const store = createHistoryStore(dataDirectory);
    await mkdir(inboxPath);
    await store.addWatchedFolder(inboxPath);
    await store.syncWatchedFolderContents(inboxPath, [], '2026-03-12T08:00:00.000Z');

    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => store.readKnownPaths(folderPath),
      saveKnownPaths: async (folderPath, knownPaths) => {
        await store.writeKnownPaths(folderPath, knownPaths);
      },
      onChange: async () => {
        const scannedAt = '2026-03-12T09:00:00.000Z';
        const items = await scanFolderContents(inboxPath);
        await store.syncWatchedFolderContents(inboxPath, items, scannedAt);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await writeFile(join(inboxPath, 'Flow.mkv'), 'movie');
    await waitForHistory(store);
    await monitor.dispose();

    const state = await store.readState();

    expect(state.history.map((entry) => entry.sourcePath)).toEqual([join(inboxPath, 'Flow.mkv')]);
  });

  it('refreshes the stored snapshot when a watched-folder item is deleted', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    const dataDirectory = join(rootDirectory, 'Data');
    const filePath = join(inboxPath, 'Flow.mkv');
    const store = createHistoryStore(dataDirectory);
    await mkdir(inboxPath);
    await writeFile(filePath, 'movie');
    await store.addWatchedFolder(inboxPath);
    await store.syncWatchedFolderContents(
      inboxPath,
      [{ itemKey: 'dev:1', sourceKind: 'file', sourcePath: filePath, title: 'Flow' }],
      '2026-03-12T08:00:00.000Z'
    );

    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => store.readKnownPaths(folderPath),
      saveKnownPaths: async (folderPath, knownPaths) => {
        await store.writeKnownPaths(folderPath, knownPaths);
      },
      onChange: async () => {
        const items = await scanFolderContents(inboxPath);
        await store.syncWatchedFolderContents(inboxPath, items, '2026-03-12T09:00:00.000Z');
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await unlink(filePath);
    await waitForLibraryItemCount(store, 0);
    await monitor.dispose();

    const state = await store.readState();

    expect(state.libraryItems).toEqual([]);
  });

  it('unwatches one folder without waiting for another folder sync to finish', async () => {
    const firstFolderPath = join(rootDirectory, 'First Folder');
    const secondFolderPath = join(rootDirectory, 'Second Folder');
    await mkdir(firstFolderPath);
    await mkdir(secondFolderPath);

    let releaseSecondFolderSync = () => {};
    let secondFolderSyncStarted = false;
    const secondFolderSync = new Promise<void>((resolve) => {
      releaseSecondFolderSync = resolve;
    });
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async (folderPath) => {
        if (folderPath !== secondFolderPath) {
          return;
        }

        secondFolderSyncStarted = true;
        await secondFolderSync;
      },
      settleMs: 25
    });

    await monitor.watchFolder(firstFolderPath);
    await monitor.watchFolder(secondFolderPath);
    await writeFile(join(secondFolderPath, 'Flow.mkv'), 'movie');
    await waitForFlag(() => secondFolderSyncStarted, 'the second folder sync to start');
    let unwatchResolved = false;
    const unwatchPromise = monitor.unwatchFolder(firstFolderPath).then(() => {
      unwatchResolved = true;
    });
    await delay(50);

    expect(unwatchResolved).toBe(true);

    releaseSecondFolderSync();
    await unwatchPromise;
    await monitor.dispose();
  });

  it('coalesces multiple new top-level media files into one folder update', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    await mkdir(inboxPath);

    const changedFolders: string[] = [];
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onChange: async (folderPath) => {
        changedFolders.push(folderPath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await delay(50);
    await Promise.all([
      writeFile(join(inboxPath, 'One.mkv'), 'one'),
      writeFile(join(inboxPath, 'Two.mkv'), 'two'),
      writeFile(join(inboxPath, 'Three.mkv'), 'three')
    ]);
    await waitForDiscovery(changedFolders);
    await delay(150);
    await monitor.dispose();

    expect(changedFolders).toEqual([inboxPath]);
  });
});

// ABOUTME: Verifies that watched folders only emit newly added top-level items after startup.
// ABOUTME: Uses the real filesystem so the monitor logic matches how the desktop app discovers media.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFolderMonitor } from '../electron/folder-monitor.js';
import { scanFolderContents } from '../electron/folder-scan.js';
import { createHistoryStore } from '../electron/store.js';
import { createEntryFromPath } from '../shared/history.js';

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

    const seenPaths: string[] = [];
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onDiscover: async (itemPath) => {
        seenPaths.push(itemPath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await writeFile(join(inboxPath, '.localized'), 'junk');
    await writeFile(join(inboxPath, 'Just Added.txt'), 'text');
    await mkdir(join(inboxPath, 'Movie Folder'));
    await writeFile(join(inboxPath, 'Movie File.mkv'), 'movie');
    await waitForDiscovery(seenPaths);
    await monitor.dispose();

    expect(seenPaths).toEqual([join(inboxPath, 'Movie File.mkv'), join(inboxPath, 'Movie Folder')]);
  });

  it('does not throw when a watched folder is missing', async () => {
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onDiscover: async () => {}
    });

    await expect(monitor.watchFolder(join(rootDirectory, 'Missing Folder'))).resolves.toBeUndefined();
    await monitor.dispose();
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
      onDiscover: async () => {},
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await delay(120);
    const settledSaveCount = saveCount;
    await delay(180);
    await monitor.dispose();

    expect(saveCount).toBe(settledSaveCount);
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
      onDiscover: async () => {
        const scannedAt = '2026-03-12T09:00:00.000Z';
        const items = await scanFolderContents(inboxPath);
        const newItems = await store.syncWatchedFolderContents(inboxPath, items, scannedAt);

        if (newItems.length > 0) {
          await store.addHistoryEntries(
            newItems.map((item) => createEntryFromPath(item.sourcePath, 'watch', scannedAt, item.sourceKind))
          );
        }
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
});

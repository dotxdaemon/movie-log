// ABOUTME: Verifies that watched-folder refreshes are queued and caught up through one shared path.
// ABOUTME: Covers startup, resume, add-folder setup, and per-folder serialization without importing Electron.
import { describe, expect, it, vi } from 'vitest';
import type { ScannedFolderItem } from '../electron/folder-scan.js';
import { createWatchedFolderSync } from '../electron/watched-folder-sync.js';
import type { WatchedFolder } from '../shared/types.js';

function watchedFolder(path: string): WatchedFolder {
  return {
    addedAt: '2026-03-16T00:00:00.000Z',
    id: path,
    lastScannedAt: null,
    name: path.split('/').at(-1) ?? path,
    path
  };
}

function scannedItem(sourcePath: string): ScannedFolderItem {
  return {
    itemKey: sourcePath,
    sourceKind: 'file',
    sourcePath,
    title: sourcePath.split('/').at(-1)?.replace(/\.mkv$/, '') ?? sourcePath
  };
}

describe('createWatchedFolderSync', () => {
  it('catches up existing watched folders once when watching starts', async () => {
    const order: string[] = [];
    const folders = [watchedFolder('/Movies/One'), watchedFolder('/Movies/Two')];
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {
        order.push('broadcast');
      },
      listWatchedFolders: async () => folders,
      now: () => '2026-03-16T09:00:00.000Z',
      saveFolderContents: async (folderPath, _items, scannedAt) => {
        order.push(`save:${folderPath}:${scannedAt}`);
      },
      scanFolder: async (folderPath) => {
        order.push(`scan:${folderPath}`);
        return [];
      },
      watchFolder: async (folderPath) => {
        order.push(`watch:${folderPath}`);
      }
    });

    await watchedFolderSync.catchUpWatchedFolders();

    expect(order).toEqual([
      'watch:/Movies/One',
      'watch:/Movies/Two',
      'scan:/Movies/One',
      'scan:/Movies/Two',
      'save:/Movies/One:2026-03-16T09:00:00.000Z',
      'save:/Movies/Two:2026-03-16T09:00:00.000Z',
      'broadcast',
      'broadcast'
    ]);
  });

  it('catches up watched folders once after watching resumes', async () => {
    const savedPaths: string[] = [];
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {},
      listWatchedFolders: async () => [watchedFolder('/Movies/Resume')],
      now: () => '2026-03-16T10:00:00.000Z',
      saveFolderContents: async (folderPath) => {
        savedPaths.push(folderPath);
      },
      scanFolder: async () => [scannedItem('/Movies/Resume/Flow.mkv')],
      watchFolder: async () => {}
    });

    await watchedFolderSync.catchUpWatchedFolders();
    await watchedFolderSync.catchUpWatchedFolders();

    expect(savedPaths).toEqual(['/Movies/Resume', '/Movies/Resume']);
  });

  it('captures an arrival that lands during add-folder setup', async () => {
    let currentItems: ScannedFolderItem[] = [];
    const savedItems: ScannedFolderItem[][] = [];
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {},
      listWatchedFolders: async () => [],
      now: () => '2026-03-16T11:00:00.000Z',
      saveFolderContents: async (_folderPath, items) => {
        savedItems.push(items);
      },
      scanFolder: async () => currentItems,
      watchFolder: async () => {
        currentItems = [scannedItem('/Movies/Add/Flow.mkv')];
      }
    });

    await watchedFolderSync.watchAndRefreshFolder('/Movies/Add');

    expect(savedItems).toEqual([[scannedItem('/Movies/Add/Flow.mkv')]]);
  });

  it('serializes refreshes for the same watched folder', async () => {
    const order: string[] = [];
    const trackedFolders = [watchedFolder('/Movies/Queue')];
    let releaseFirstScan = () => {};
    const firstScan = new Promise<void>((resolve) => {
      releaseFirstScan = () => {
        resolve();
      };
    });
    let scanCount = 0;
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {
        order.push('broadcast');
      },
      listWatchedFolders: async () => trackedFolders,
      now: () => '2026-03-16T12:00:00.000Z',
      saveFolderContents: async () => {
        order.push('save');
      },
      scanFolder: async () => {
        scanCount += 1;
        order.push(`scan:${scanCount}`);

        if (scanCount === 1) {
          await firstScan;
        }

        return [];
      },
      watchFolder: async () => {}
    });

    const firstRefresh = watchedFolderSync.queueRefresh('/Movies/Queue');
    const secondRefresh = watchedFolderSync.queueRefresh('/Movies/Queue');
    await vi.waitFor(() => {
      expect(order).toEqual(['scan:1']);
    });

    releaseFirstScan();
    await Promise.all([firstRefresh, secondRefresh]);

    expect(order).toEqual(['scan:1', 'save', 'broadcast', 'scan:2', 'save', 'broadcast']);
  });

  it('drops queued refresh results after a watched folder is removed', async () => {
    const order: string[] = [];
    let watchedFolders = [watchedFolder('/Movies/Removed')];
    let releaseScan = () => {};
    let scanStarted = false;
    const blockedScan = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {
        order.push('broadcast');
      },
      listWatchedFolders: async () => watchedFolders,
      now: () => '2026-03-16T12:30:00.000Z',
      saveFolderContents: async () => {
        order.push('save');
      },
      scanFolder: async () => {
        scanStarted = true;
        order.push('scan');
        await blockedScan;
        return [scannedItem('/Movies/Removed/Flow.mkv')];
      },
      watchFolder: async () => {}
    });

    const refreshPromise = watchedFolderSync.queueRefresh('/Movies/Removed');

    await vi.waitFor(() => {
      expect(scanStarted).toBe(true);
    });

    watchedFolders = [];
    watchedFolderSync.forgetFolder('/Movies/Removed');
    releaseScan();
    await refreshPromise;

    expect(order).toEqual(['scan']);
  });

  it('reuses an in-flight refresh when Scan Now runs for the same watched folder', async () => {
    const order: string[] = [];
    let releaseScan = () => {};
    let scanStarted = false;
    const blockedScan = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    const watchedFolderSync = createWatchedFolderSync({
      broadcastState: async () => {
        order.push('broadcast');
      },
      listWatchedFolders: async () => [watchedFolder('/Movies/Scan')],
      now: () => '2026-03-16T13:00:00.000Z',
      saveFolderContents: async () => {
        order.push('save');
      },
      scanFolder: async () => {
        scanStarted = true;
        order.push('scan');
        await blockedScan;
        return [scannedItem('/Movies/Scan/Flow.mkv')];
      },
      watchFolder: async () => {}
    });

    const liveRefresh = watchedFolderSync.queueRefresh('/Movies/Scan');

    await vi.waitFor(() => {
      expect(scanStarted).toBe(true);
    });

    const scanNowRefresh = watchedFolderSync.refreshWatchedFolders();
    releaseScan();
    await Promise.all([liveRefresh, scanNowRefresh]);

    expect(order).toEqual(['scan', 'save', 'broadcast']);
  });
});

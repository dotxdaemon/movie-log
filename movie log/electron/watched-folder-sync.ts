// ABOUTME: Queues watched-folder refreshes so the main process uses one scan-and-save path everywhere.
// ABOUTME: Keeps add-folder setup, startup catch-up, manual scans, and live arrivals serialized per folder.
import type { ScannedFolderItem } from './folder-scan.js';
import type { WatchedFolder } from '../shared/types.js';

interface WatchedFolderSyncOptions {
  broadcastState(): Promise<void>;
  listWatchedFolders(): Promise<WatchedFolder[]>;
  now(): string;
  saveFolderContents(folderPath: string, items: ScannedFolderItem[], scannedAt: string): Promise<void>;
  scanFolder(folderPath: string): Promise<ScannedFolderItem[]>;
  watchFolder(folderPath: string): Promise<void>;
}

export function createWatchedFolderSync(options: WatchedFolderSyncOptions) {
  const refreshesByFolder = new Map<string, Promise<void>>();

  async function refreshFolder(folderPath: string): Promise<void> {
    const scannedAt = options.now();
    const items = await options.scanFolder(folderPath);
    await options.saveFolderContents(folderPath, items, scannedAt);
    await options.broadcastState();
  }

  function queueRefresh(folderPath: string): Promise<void> {
    const previousRefresh = refreshesByFolder.get(folderPath) ?? Promise.resolve();
    const nextRefresh = previousRefresh.catch(() => undefined).then(async () => refreshFolder(folderPath));

    refreshesByFolder.set(folderPath, nextRefresh);

    return nextRefresh.finally(() => {
      if (refreshesByFolder.get(folderPath) === nextRefresh) {
        refreshesByFolder.delete(folderPath);
      }
    });
  }

  async function refreshWatchedFolders(): Promise<void> {
    const watchedFolders = await options.listWatchedFolders();
    await Promise.all(watchedFolders.map((folder) => queueRefresh(folder.path)));
  }

  async function catchUpWatchedFolders(): Promise<void> {
    const watchedFolders = await options.listWatchedFolders();

    await Promise.all(watchedFolders.map((folder) => options.watchFolder(folder.path)));
    await Promise.all(watchedFolders.map((folder) => queueRefresh(folder.path)));
  }

  async function watchAndRefreshFolder(folderPath: string): Promise<void> {
    await options.watchFolder(folderPath);
    await queueRefresh(folderPath);
  }

  return {
    catchUpWatchedFolders,
    queueRefresh,
    refreshWatchedFolders,
    watchAndRefreshFolder
  };
}

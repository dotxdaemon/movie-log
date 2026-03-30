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
  const refreshVersionsByFolder = new Map<string, number>();

  function readRefreshVersion(folderPath: string): number {
    return refreshVersionsByFolder.get(folderPath) ?? 0;
  }

  async function refreshFolder(folderPath: string, allowUntrackedFolder: boolean, refreshVersion: number): Promise<void> {
    const scannedAt = options.now();
    let items: ScannedFolderItem[] = [];

    try {
      items = await options.scanFolder(folderPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'ENOENT') {
        throw error;
      }
    }

    if (readRefreshVersion(folderPath) !== refreshVersion) {
      return;
    }

    if (!allowUntrackedFolder) {
      const watchedFolders = await options.listWatchedFolders();

      if (!watchedFolders.some((folder) => folder.path === folderPath)) {
        return;
      }
    }

    await options.saveFolderContents(folderPath, items, scannedAt);

    if (readRefreshVersion(folderPath) !== refreshVersion) {
      return;
    }

    await options.broadcastState();
  }

  function queueFolderRefresh(folderPath: string, allowUntrackedFolder: boolean): Promise<void> {
    const refreshVersion = readRefreshVersion(folderPath);
    const previousRefresh = refreshesByFolder.get(folderPath) ?? Promise.resolve();
    const nextRefresh = previousRefresh
      .catch(() => undefined)
      .then(async () => refreshFolder(folderPath, allowUntrackedFolder, refreshVersion));

    refreshesByFolder.set(folderPath, nextRefresh);

    return nextRefresh.finally(() => {
      if (refreshesByFolder.get(folderPath) === nextRefresh) {
        refreshesByFolder.delete(folderPath);
      }
    });
  }

  function queueRefresh(folderPath: string): Promise<void> {
    return queueFolderRefresh(folderPath, false);
  }

  async function refreshWatchedFolders(): Promise<void> {
    const watchedFolders = await options.listWatchedFolders();
    await Promise.all(
      watchedFolders.map((folder) => refreshesByFolder.get(folder.path) ?? queueRefresh(folder.path))
    );
  }

  async function catchUpWatchedFolders(): Promise<void> {
    const watchedFolders = await options.listWatchedFolders();

    await Promise.all(watchedFolders.map((folder) => options.watchFolder(folder.path)));
  }

  async function watchAndRefreshFolder(folderPath: string): Promise<void> {
    await options.watchFolder(folderPath);
    await queueFolderRefresh(folderPath, true);
  }

  function forgetFolder(folderPath: string): void {
    refreshVersionsByFolder.set(folderPath, readRefreshVersion(folderPath) + 1);
  }

  return {
    catchUpWatchedFolders,
    forgetFolder,
    queueRefresh,
    refreshWatchedFolders,
    watchAndRefreshFolder
  };
}

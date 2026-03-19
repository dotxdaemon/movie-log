// ABOUTME: Coordinates main-process watched-folder setup and dropped-path logging without importing Electron globals.
// ABOUTME: Keeps rollback and partial-failure behavior testable while the BrowserWindow shell stays thin.
import type { LogPathsResult, WatchEntry, WatchedFolder } from '../shared/types.js';

interface AddWatchedFolderPathOptions {
  queueFolderRefresh(folderPath: string): Promise<void>;
  removeWatchedFolder(folderId: string): Promise<WatchedFolder | null>;
  saveWatchedFolder(folderPath: string): Promise<WatchedFolder>;
  unwatchFolder(folderPath: string): Promise<void>;
  watchFolder(folderPath: string): Promise<void>;
}

interface LogPathsFromDropOptions {
  addHistoryEntries(entries: WatchEntry[]): Promise<WatchEntry[]>;
  broadcastState(): Promise<void>;
  createEntryForPath(itemPath: string): Promise<WatchEntry | null>;
}

export async function addWatchedFolderPath(
  folderPath: string,
  options: AddWatchedFolderPathOptions
): Promise<WatchedFolder> {
  await options.watchFolder(folderPath);

  let folder: WatchedFolder | null = null;

  try {
    folder = await options.saveWatchedFolder(folderPath);
    await options.queueFolderRefresh(folderPath);
    return folder;
  } catch (error) {
    if (folder) {
      await options.removeWatchedFolder(folder.id);
    }

    await options.unwatchFolder(folderPath);
    throw error;
  }
}

export async function logPathsFromDrop(paths: string[], options: LogPathsFromDropOptions): Promise<LogPathsResult> {
  const entries: WatchEntry[] = [];
  const skippedPaths: string[] = [];

  for (const itemPath of paths) {
    try {
      const entry = await options.createEntryForPath(itemPath);

      if (entry) {
        entries.push(entry);
      }
    } catch {
      skippedPaths.push(itemPath);
    }
  }

  if (entries.length > 0) {
    await options.addHistoryEntries(entries);
    await options.broadcastState();
  }

  return {
    addedCount: entries.length,
    skippedPaths
  };
}

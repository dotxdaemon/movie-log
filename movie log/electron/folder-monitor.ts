// ABOUTME: Watches top-level inbox folders and reports when a watched folder needs one refresh.
// ABOUTME: Uses real filesystem scans with a short settle delay so one batch of arrivals stays one update.
import { stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { scanFolderContents } from './folder-scan.js';

interface FolderMonitorOptions {
  loadKnownPaths(folderPath: string): Promise<string[]>;
  saveKnownPaths(folderPath: string, knownPaths: string[]): Promise<void>;
  onChange(folderPath: string): Promise<void> | void;
  settleMs?: number;
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createFolderMonitor(options: FolderMonitorOptions) {
  const settleMs = options.settleMs ?? 400;
  const watchers = new Map<string, FSWatcher>();
  const scheduledSyncs = new Map<string, NodeJS.Timeout>();
  const pendingSyncs = new Set<Promise<void>>();

  function trackPendingSync(syncPromise: Promise<void>): void {
    pendingSyncs.add(syncPromise);
    void syncPromise.finally(() => {
      pendingSyncs.delete(syncPromise);
    });
  }

  async function syncFolder(folderPath: string, emitNewItems: boolean): Promise<void> {
    try {
      const knownPaths = await options.loadKnownPaths(folderPath);
      const currentPaths = (await scanFolderContents(folderPath)).map((item) => item.sourcePath);
      const knownPathSet = new Set(knownPaths);

      if (sameValues(knownPaths, currentPaths)) {
        return;
      }

      if (!emitNewItems) {
        await options.saveKnownPaths(folderPath, currentPaths);
        return;
      }

      const newPaths = currentPaths.filter((itemPath) => !knownPathSet.has(itemPath));

      if (newPaths.length === 0) {
        await options.saveKnownPaths(folderPath, currentPaths);
        return;
      }

      await options.onChange(folderPath);

      await options.saveKnownPaths(folderPath, currentPaths);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        await options.saveKnownPaths(folderPath, []);
        return;
      }

      throw error;
    }
  }

  function scheduleSync(folderPath: string): void {
    const existing = scheduledSyncs.get(folderPath);

    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      scheduledSyncs.delete(folderPath);
      trackPendingSync(syncFolder(folderPath, true));
    }, settleMs);

    scheduledSyncs.set(folderPath, timeout);
  }

  return {
    async watchFolder(folderPath: string): Promise<void> {
      if (watchers.has(folderPath)) {
        return;
      }

      try {
        await stat(folderPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code === 'ENOENT') {
          await options.saveKnownPaths(folderPath, []);
          return;
        }

        throw error;
      }

      const folderWatcher = watch(folderPath, () => {
        scheduleSync(folderPath);
      });

      watchers.set(folderPath, folderWatcher);
    },

    async unwatchFolder(folderPath: string): Promise<void> {
      const folderWatcher = watchers.get(folderPath);

      if (folderWatcher) {
        folderWatcher.close();
        watchers.delete(folderPath);
      }

      const timeout = scheduledSyncs.get(folderPath);
      if (timeout) {
        clearTimeout(timeout);
        scheduledSyncs.delete(folderPath);
      }

      if (pendingSyncs.size > 0) {
        await Promise.all([...pendingSyncs]);
      }
    },

    async dispose(): Promise<void> {
      for (const timeout of scheduledSyncs.values()) {
        clearTimeout(timeout);
      }

      scheduledSyncs.clear();

      for (const folderWatcher of watchers.values()) {
        folderWatcher.close();
      }

      watchers.clear();

      if (pendingSyncs.size > 0) {
        await Promise.all([...pendingSyncs]);
      }
    }
  };
}

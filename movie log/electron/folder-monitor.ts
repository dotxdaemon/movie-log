// ABOUTME: Watches top-level inbox folders and reports newly added files or folders to the app.
// ABOUTME: Uses real filesystem scans with a short settle delay so repeated events do not duplicate history.
import { readdir, stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

interface FolderMonitorOptions {
  loadKnownPaths(folderPath: string): Promise<string[]>;
  saveKnownPaths(folderPath: string, knownPaths: string[]): Promise<void>;
  onDiscover(itemPath: string): Promise<void> | void;
  settleMs?: number;
}

async function listTopLevelPaths(folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => join(folderPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function createFolderMonitor(options: FolderMonitorOptions) {
  const settleMs = options.settleMs ?? 400;
  const pollMs = Math.max(settleMs * 4, 100);
  const watchers = new Map<string, FSWatcher>();
  const pollingTimers = new Map<string, NodeJS.Timeout>();
  const scheduledSyncs = new Map<string, NodeJS.Timeout>();

  async function syncFolder(folderPath: string, emitNewItems: boolean): Promise<void> {
    try {
      const knownPaths = new Set(await options.loadKnownPaths(folderPath));
      const currentPaths = await listTopLevelPaths(folderPath);

      await options.saveKnownPaths(folderPath, currentPaths);

      if (!emitNewItems) {
        return;
      }

      for (const itemPath of currentPaths) {
        if (!knownPaths.has(itemPath)) {
          await options.onDiscover(itemPath);
        }
      }
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
      void syncFolder(folderPath, true);
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

      await syncFolder(folderPath, false);

      const folderWatcher = watch(folderPath, () => {
        scheduleSync(folderPath);
      });

      watchers.set(folderPath, folderWatcher);
      pollingTimers.set(
        folderPath,
        setInterval(() => {
          void syncFolder(folderPath, true);
        }, pollMs)
      );
    },

    async unwatchFolder(folderPath: string): Promise<void> {
      const folderWatcher = watchers.get(folderPath);

      if (folderWatcher) {
        folderWatcher.close();
        watchers.delete(folderPath);
      }

      const pollingTimer = pollingTimers.get(folderPath);
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimers.delete(folderPath);
      }

      const timeout = scheduledSyncs.get(folderPath);
      if (timeout) {
        clearTimeout(timeout);
        scheduledSyncs.delete(folderPath);
      }
    },

    async dispose(): Promise<void> {
      for (const timeout of scheduledSyncs.values()) {
        clearTimeout(timeout);
      }

      scheduledSyncs.clear();

      for (const pollingTimer of pollingTimers.values()) {
        clearInterval(pollingTimer);
      }

      pollingTimers.clear();

      for (const folderWatcher of watchers.values()) {
        folderWatcher.close();
      }

      watchers.clear();
    }
  };
}

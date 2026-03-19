// ABOUTME: Watches top-level inbox folders and reports when a watched folder needs one refresh.
// ABOUTME: Uses real filesystem scans with a short settle delay so one batch of arrivals stays one update.
import { stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { dirname } from 'node:path';
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
  const missingFolderWatchers = new Map<string, FSWatcher>();
  const scheduledSyncs = new Map<string, NodeJS.Timeout>();
  const pendingSyncsByFolder = new Map<string, Set<Promise<void>>>();

  function trackPendingSync(folderPath: string, syncPromise: Promise<void>): void {
    const pendingSyncs = pendingSyncsByFolder.get(folderPath) ?? new Set<Promise<void>>();
    pendingSyncs.add(syncPromise);
    pendingSyncsByFolder.set(folderPath, pendingSyncs);
    void syncPromise.finally(() => {
      pendingSyncs.delete(syncPromise);

      if (pendingSyncs.size === 0) {
        pendingSyncsByFolder.delete(folderPath);
      }
    });
  }

  function closeWatcher(watcher: FSWatcher | undefined): void {
    watcher?.close();
  }

  async function findNearestExistingParent(folderPath: string): Promise<string> {
    let currentPath = dirname(folderPath);

    while (true) {
      try {
        await stat(currentPath);
        return currentPath;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code !== 'ENOENT') {
          throw error;
        }
      }

      const parentPath = dirname(currentPath);

      if (parentPath === currentPath) {
        return currentPath;
      }

      currentPath = parentPath;
    }
  }

  function clearScheduledSync(folderPath: string): void {
    const timeout = scheduledSyncs.get(folderPath);

    if (timeout) {
      clearTimeout(timeout);
      scheduledSyncs.delete(folderPath);
    }
  }

  async function waitForPendingSyncs(folderPath: string): Promise<void> {
    const pendingSyncs = pendingSyncsByFolder.get(folderPath);

    if (pendingSyncs && pendingSyncs.size > 0) {
      await Promise.all([...pendingSyncs]);
    }
  }

  async function syncFolder(folderPath: string, emitNewItems: boolean): Promise<void> {
    let currentPaths: string[] = [];
    let folderIsMissing = false;

    try {
      const knownPaths = await options.loadKnownPaths(folderPath);
      currentPaths = (await scanFolderContents(folderPath)).map((item) => item.sourcePath);

      if (sameValues(knownPaths, currentPaths)) {
        return;
      }

      if (emitNewItems) {
        await options.onChange(folderPath);
      }

      await options.saveKnownPaths(folderPath, currentPaths);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        folderIsMissing = true;
        currentPaths = [];
      } else {
        throw error;
      }
    }

    if (!folderIsMissing) {
      return;
    }

    const knownPaths = await options.loadKnownPaths(folderPath);

    if (!sameValues(knownPaths, currentPaths) && emitNewItems) {
      await options.onChange(folderPath);
    }

    await options.saveKnownPaths(folderPath, currentPaths);
    closeWatcher(watchers.get(folderPath));
    watchers.delete(folderPath);
    await watchMissingFolder(folderPath);
  }

  function scheduleSync(folderPath: string): void {
    clearScheduledSync(folderPath);

    const timeout = setTimeout(() => {
      scheduledSyncs.delete(folderPath);
      trackPendingSync(folderPath, syncFolder(folderPath, true));
    }, settleMs);

    scheduledSyncs.set(folderPath, timeout);
  }

  function attachFolderWatcher(folderPath: string): void {
    if (watchers.has(folderPath)) {
      return;
    }

    const missingFolderWatcher = missingFolderWatchers.get(folderPath);

    if (missingFolderWatcher) {
      closeWatcher(missingFolderWatcher);
      missingFolderWatchers.delete(folderPath);
    }

    const folderWatcher = watch(folderPath, () => {
      scheduleSync(folderPath);
    });

    watchers.set(folderPath, folderWatcher);
  }

  async function attachWhenPresent(folderPath: string): Promise<void> {
    if (watchers.has(folderPath)) {
      return;
    }

    try {
      await stat(folderPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        return;
      }

      throw error;
    }

    attachFolderWatcher(folderPath);
    scheduleSync(folderPath);
  }

  async function watchMissingFolder(folderPath: string): Promise<void> {
    if (watchers.has(folderPath) || missingFolderWatchers.has(folderPath)) {
      return;
    }

    const parentPath = await findNearestExistingParent(folderPath);
    const parentWatcher = watch(parentPath, () => {
      void attachWhenPresent(folderPath);
    });

    missingFolderWatchers.set(folderPath, parentWatcher);
  }

  return {
    async watchFolder(folderPath: string): Promise<void> {
      if (watchers.has(folderPath) || missingFolderWatchers.has(folderPath)) {
        return;
      }

      try {
        await stat(folderPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code === 'ENOENT') {
          await options.saveKnownPaths(folderPath, []);
          await watchMissingFolder(folderPath);
          return;
        }

        throw error;
      }

      attachFolderWatcher(folderPath);
    },

    async unwatchFolder(folderPath: string): Promise<void> {
      closeWatcher(watchers.get(folderPath));
      watchers.delete(folderPath);
      closeWatcher(missingFolderWatchers.get(folderPath));
      missingFolderWatchers.delete(folderPath);
      clearScheduledSync(folderPath);
      await waitForPendingSyncs(folderPath);
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
      for (const parentWatcher of missingFolderWatchers.values()) {
        parentWatcher.close();
      }

      missingFolderWatchers.clear();

      const pendingSyncs = [...pendingSyncsByFolder.values()].flatMap((folderPendingSyncs) => [...folderPendingSyncs]);

      if (pendingSyncs.length > 0) {
        await Promise.all(pendingSyncs);
      }
    }
  };
}

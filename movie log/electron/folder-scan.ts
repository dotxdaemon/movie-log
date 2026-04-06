// ABOUTME: Scans a chosen folder and returns the current top-level media items that should populate the app.
// ABOUTME: Keeps folder population deterministic for startup scans, manual adds, and scheduled refreshes.
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryKind } from '../shared/types.js';

const execFileAsync = promisify(execFile);

export interface ScannedFolderItem {
  addedAt?: string;
  itemKey: string;
  sourceKind: EntryKind;
  sourcePath: string;
  title: string;
}

function readFilesystemAddedAt(itemStats: Awaited<ReturnType<typeof stat>>): string {
  if (itemStats.birthtimeMs > 0) {
    return itemStats.birthtime.toISOString();
  }

  return itemStats.mtime.toISOString();
}

export function resolveAddedAt(addedAtValue: string | null | undefined, fallbackAddedAt: string): string {
  const normalizedValue = addedAtValue?.trim();

  if (!normalizedValue || normalizedValue === '(null)') {
    return fallbackAddedAt;
  }

  const parsedAddedAt = new Date(normalizedValue);

  if (Number.isNaN(parsedAddedAt.valueOf())) {
    return fallbackAddedAt;
  }

  return parsedAddedAt.toISOString();
}

async function readDateAddedValue(sourcePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('mdls', ['-raw', '-name', 'kMDItemDateAdded', sourcePath]);
    return stdout;
  } catch {
    return null;
  }
}

async function readScannedItem(sourcePath: string): Promise<Pick<ScannedFolderItem, 'addedAt' | 'itemKey'> | null> {
  try {
    const itemStats = await stat(sourcePath);
    const fallbackAddedAt = readFilesystemAddedAt(itemStats);
    const addedAtValue = await readDateAddedValue(sourcePath);

    return {
      addedAt: resolveAddedAt(addedAtValue, fallbackAddedAt),
      itemKey: `${itemStats.dev}:${itemStats.ino}`
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function scanFolderContents(folderPath: string): Promise<ScannedFolderItem[]> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const scannedItems = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.isFile())
        .map(async (entry): Promise<ScannedFolderItem | null> => {
          const sourcePath = join(folderPath, entry.name);
          const sourceKind: EntryKind = entry.isDirectory() ? 'directory' : 'file';

          if (!isTrackableMediaItem(sourcePath, sourceKind)) {
            return null;
          }

          const scannedItem = await readScannedItem(sourcePath);

          if (!scannedItem) {
            return null;
          }

          const watchEntry = createEntryFromPath(sourcePath, 'watch', '1970-01-01T00:00:00.000Z', sourceKind);

          const nextItem: ScannedFolderItem = {
            addedAt: scannedItem.addedAt,
            itemKey: scannedItem.itemKey,
            sourceKind,
            sourcePath,
            title: watchEntry.title
          };

          return nextItem;
        })
    );

    return scannedItems
      .filter((item): item is ScannedFolderItem => item !== null)
      .sort((left, right) => left.title.localeCompare(right.title) || left.sourcePath.localeCompare(right.sourcePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

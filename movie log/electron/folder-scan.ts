// ABOUTME: Scans a chosen folder and returns the current top-level media items that should populate the app.
// ABOUTME: Keeps folder population deterministic for startup scans, manual adds, and scheduled refreshes.
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryKind } from '../shared/types.js';

export interface ScannedFolderItem {
  itemKey: string;
  sourceKind: EntryKind;
  sourcePath: string;
  title: string;
}

async function readItemKey(sourcePath: string): Promise<string | null> {
  try {
    const itemStats = await stat(sourcePath);
    return `${itemStats.dev}:${itemStats.ino}`;
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
        .map(async (entry) => {
          const sourcePath = join(folderPath, entry.name);
          const sourceKind: EntryKind = entry.isDirectory() ? 'directory' : 'file';

          if (!isTrackableMediaItem(sourcePath, sourceKind)) {
            return null;
          }

          const itemKey = await readItemKey(sourcePath);

          if (!itemKey) {
            return null;
          }

          const watchEntry = createEntryFromPath(sourcePath, 'watch', '1970-01-01T00:00:00.000Z', sourceKind);

          return {
            itemKey,
            sourceKind,
            sourcePath,
            title: watchEntry.title
          };
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

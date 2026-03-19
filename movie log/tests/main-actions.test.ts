// ABOUTME: Verifies the main-process orchestration for adding watched folders and logging dropped paths.
// ABOUTME: Covers rollback and partial-failure behavior without importing the Electron runtime shell.
import { describe, expect, it } from 'vitest';
import { addWatchedFolderPath, logPathsFromDrop } from '../electron/main-actions.js';
import { createEntryFromPath } from '../shared/history.js';
import type { WatchedFolder } from '../shared/types.js';

function watchedFolder(path: string): WatchedFolder {
  return {
    addedAt: '2026-03-19T10:00:00.000Z',
    id: path,
    lastScannedAt: null,
    name: path.split('/').at(-1) ?? path,
    path
  };
}

describe('main actions', () => {
  it('removes a watched folder again if the initial refresh fails', async () => {
    const order: string[] = [];
    const savedFolders = new Map<string, WatchedFolder>();

    await expect(
      addWatchedFolderPath('/Movies/Add', {
        queueFolderRefresh: async (folderPath) => {
          order.push(`refresh:${folderPath}`);
          throw new Error('scan failed');
        },
        removeWatchedFolder: async (folderId) => {
          order.push(`remove:${folderId}`);
          const folder = savedFolders.get(folderId) ?? null;

          if (folder) {
            savedFolders.delete(folderId);
          }

          return folder;
        },
        saveWatchedFolder: async (folderPath) => {
          order.push(`save:${folderPath}`);
          const folder = watchedFolder(folderPath);
          savedFolders.set(folder.id, folder);
          return folder;
        },
        unwatchFolder: async (folderPath) => {
          order.push(`unwatch:${folderPath}`);
        },
        watchFolder: async (folderPath) => {
          order.push(`watch:${folderPath}`);
        }
      })
    ).rejects.toThrow('scan failed');

    expect(order).toEqual([
      'watch:/Movies/Add',
      'save:/Movies/Add',
      'refresh:/Movies/Add',
      'remove:/Movies/Add',
      'unwatch:/Movies/Add'
    ]);
    expect(savedFolders.size).toBe(0);
  });

  it('keeps valid dropped paths when one dropped path disappears', async () => {
    const savedPaths: string[] = [];
    let broadcastCount = 0;

    const result = await logPathsFromDrop(['/Movies/Good.mkv', '/Movies/Missing.mkv'], {
      addHistoryEntries: async (entries) => {
        savedPaths.push(...entries.map((entry) => entry.sourcePath));
        return entries;
      },
      broadcastState: async () => {
        broadcastCount += 1;
      },
      createEntryForPath: async (itemPath) => {
        if (itemPath === '/Movies/Missing.mkv') {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }

        return createEntryFromPath(itemPath, 'drop', '2026-03-19T10:05:00.000Z', 'file');
      }
    });

    expect(result).toEqual({
      addedCount: 1,
      skippedPaths: ['/Movies/Missing.mkv']
    });
    expect(savedPaths).toEqual(['/Movies/Good.mkv']);
    expect(broadcastCount).toBe(1);
  });
});

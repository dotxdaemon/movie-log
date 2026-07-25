// ABOUTME: Verifies the main-process orchestration for adding watched folders and logging dropped paths.
// ABOUTME: Covers rollback and partial-failure behavior without importing the Electron runtime shell.
import { describe, expect, it } from 'vitest';
import {
  addWatchedFolderPath,
  createAttachedCatalogSelection,
  logCatalogFilmEntry,
  logPathsFromDrop,
  searchCatalogWithFallback
} from '../electron/main-actions.js';
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
  it('preserves series identity, co-directors, and poster quality for the index', () => {
    expect(
      createAttachedCatalogSelection({
        catalogId: 'tt0298130',
        catalogSource: 'imdb',
        director: ['Gore Verbinski', 'Jane Campion'],
        mediaType: 'series',
        pageId: -298130,
        posterLookupComplete: false,
        posterUrl: 'https://m.media-amazon.com/images/M/ring-small.jpg',
        posterWidth: 500,
        title: 'The Ring',
        year: 2002
      })
    ).toMatchObject({
      catalogId: 'tt0298130',
      catalogSource: 'imdb',
      director: ['Gore Verbinski', 'Jane Campion'],
      mediaType: 'series',
      posterLookupComplete: false,
      posterWidth: 500
    });
  });

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
      entryStatus: 'saved',
      metadataStatus: 'not-requested',
      skippedPaths: ['/Movies/Missing.mkv']
    });
    expect(savedPaths).toEqual(['/Movies/Good.mkv']);
    expect(broadcastCount).toBe(1);
  });

  it('reports readable dropped paths that are not loggable as skipped', async () => {
    const savedPaths: string[] = [];

    const result = await logPathsFromDrop(['/Movies/Good.mkv', '/Movies/Poster.jpg'], {
      addHistoryEntries: async (entries) => {
        savedPaths.push(...entries.map((entry) => entry.sourcePath));
        return entries;
      },
      broadcastState: async () => {},
      createEntryForPath: async (itemPath) => {
        if (itemPath === '/Movies/Poster.jpg') {
          return null;
        }

        return createEntryFromPath(itemPath, 'drop', '2026-03-19T10:05:00.000Z', 'file');
      }
    });

    expect(result).toEqual({
      addedCount: 1,
      entryStatus: 'saved',
      metadataStatus: 'not-requested',
      skippedPaths: ['/Movies/Poster.jpg']
    });
    expect(savedPaths).toEqual(['/Movies/Good.mkv']);
  });

  it('matches one selected catalog film to one accepted media path', async () => {
    const savedPaths: string[] = [];
    const matchedPaths: string[] = [];
    const film = { pageId: 42, title: 'Known Film', year: 2024 };

    const result = await logPathsFromDrop(
      ['/Movies/Known.Film.2024.mkv'],
      {
        addHistoryEntries: async (entries) => {
          savedPaths.push(...entries.map((entry) => entry.sourcePath));
          return entries;
        },
        broadcastState: async () => {},
        createEntryForPath: async (itemPath) =>
          createEntryFromPath(itemPath, 'drop', '2026-07-16T12:00:00.000Z', 'file'),
        matchFilmForEntry: async (entry, selectedFilm) => {
          expect(selectedFilm).toEqual(film);
          matchedPaths.push(entry.sourcePath);
        }
      },
      film
    );

    expect(result).toEqual({
      addedCount: 1,
      entryStatus: 'saved',
      metadataStatus: 'attached',
      skippedPaths: []
    });
    expect(savedPaths).toEqual(['/Movies/Known.Film.2024.mkv']);
    expect(matchedPaths).toEqual(['/Movies/Known.Film.2024.mkv']);
  });

  it('reports a saved entry truthfully when metadata attachment must finish later', async () => {
    const savedPaths: string[] = [];
    let broadcastCount = 0;

    const result = await logPathsFromDrop(
      ['/Movies/Known.Film.2024.mkv'],
      {
        addHistoryEntries: async (entries) => {
          savedPaths.push(...entries.map((entry) => entry.sourcePath));
          return entries;
        },
        broadcastState: async () => {
          broadcastCount += 1;
        },
        createEntryForPath: async (itemPath) =>
          createEntryFromPath(itemPath, 'drop', '2026-07-16T12:00:00.000Z', 'file'),
        matchFilmForEntry: async () => {
          throw new Error('catalog cache unavailable');
        }
      },
      { pageId: 42, posterUrl: 'https://example.test/known-film-poster.jpg', title: 'Known Film', year: 2024 }
    );

    expect(result).toEqual({
      addedCount: 1,
      entryStatus: 'saved',
      metadataStatus: 'pending',
      skippedPaths: []
    });
    expect(savedPaths).toEqual(['/Movies/Known.Film.2024.mkv']);
    expect(broadcastCount).toBe(1);
  });

  it('returns the same truthful structured result for a catalog-only entry', async () => {
    const entry = createEntryFromPath(
      'film://wikipedia-42/Known Film (2024)',
      'drop',
      '2026-07-16T12:00:00.000Z',
      'directory'
    );
    let broadcastCount = 0;
    const result = await logCatalogFilmEntry(
      entry,
      { pageId: 42, title: 'Known Film', year: 2024 },
      {
        addHistoryEntry: async (savedEntry) => savedEntry,
        attachFilm: async () => {
          throw new Error('cache write unavailable');
        },
        broadcastState: async () => {
          broadcastCount += 1;
        }
      }
    );

    expect(result).toEqual({
      addedCount: 1,
      entryStatus: 'saved',
      metadataStatus: 'pending',
      skippedPaths: []
    });
    expect(broadcastCount).toBe(1);
  });

  it('rejects a selected catalog film with multiple media paths before any partial save', async () => {
    const calls: string[] = [];

    await expect(
      logPathsFromDrop(
        ['/Movies/One.mkv', '/Movies/Two.mkv'],
        {
          addHistoryEntries: async () => {
            calls.push('save');
            return [];
          },
          broadcastState: async () => {
            calls.push('broadcast');
          },
          createEntryForPath: async (itemPath) => {
            calls.push(`create:${itemPath}`);
            return createEntryFromPath(itemPath, 'drop', '2026-07-16T12:00:00.000Z', 'file');
          },
          matchFilmForEntry: async () => {
            calls.push('match');
          }
        },
        { pageId: 42, title: 'Known Film', year: 2024 }
      )
    ).resolves.toEqual({
      addedCount: 0,
      entryStatus: 'failed',
      metadataStatus: 'not-requested',
      skippedPaths: ['/Movies/One.mkv', '/Movies/Two.mkv']
    });

    expect(calls).toEqual([]);
  });

  it('rejects one valid and one skipped path with a selected film before inspecting either path', async () => {
    const calls: string[] = [];

    await expect(
      logPathsFromDrop(
        ['/Movies/Good.mkv', '/Movies/Poster.jpg'],
        {
          addHistoryEntries: async () => {
            calls.push('save');
            return [];
          },
          broadcastState: async () => {},
          createEntryForPath: async (itemPath) => {
            calls.push(`create:${itemPath}`);
            return itemPath.endsWith('.jpg')
              ? null
              : createEntryFromPath(itemPath, 'drop', '2026-07-16T12:00:00.000Z', 'file');
          },
          matchFilmForEntry: async () => {
            calls.push('match');
          }
        },
        { pageId: 42, title: 'Known Film', year: 2024 }
      )
    ).resolves.toEqual({
      addedCount: 0,
      entryStatus: 'failed',
      metadataStatus: 'not-requested',
      skippedPaths: ['/Movies/Good.mkv', '/Movies/Poster.jpg']
    });

    expect(calls).toEqual([]);
  });

  it('never matches a selected film when its only media path is skipped', async () => {
    let matchCount = 0;

    const result = await logPathsFromDrop(
      ['/Movies/Poster.jpg'],
      {
        addHistoryEntries: async (entries) => entries,
        broadcastState: async () => {},
        createEntryForPath: async () => null,
        matchFilmForEntry: async () => {
          matchCount += 1;
        }
      },
      { pageId: 42, title: 'Known Film', year: 2024 }
    );

    expect(result).toEqual({
      addedCount: 0,
      entryStatus: 'failed',
      metadataStatus: 'not-requested',
      skippedPaths: ['/Movies/Poster.jpg']
    });
    expect(matchCount).toBe(0);
  });

  it('rejects a catalog outage when the local cache has no matching films', async () => {
    const outage = new Error('catalog offline');

    await expect(
      searchCatalogWithFallback('Unknown film', {
        searchCachedFilms: async () => [],
        searchLiveFilms: async () => {
          throw outage;
        }
      })
    ).rejects.toBe(outage);
  });

  it('returns matching cached films during a catalog outage', async () => {
    const cachedFilm = {
      description: 'Cached catalog match',
      director: ['Jane Director'],
      pageId: 42,
      posterUrl: null,
      title: 'Known Film',
      year: 2024
    };

    await expect(
      searchCatalogWithFallback('Known Film', {
        searchCachedFilms: async () => [cachedFilm],
        searchLiveFilms: async () => {
          throw new Error('catalog offline');
        }
      })
    ).resolves.toEqual([cachedFilm]);
  });

  it('returns matching cached films when the live catalog never settles', async () => {
    const cachedFilm = {
      description: 'Cached catalog match',
      director: ['Jane Director'],
      pageId: 42,
      posterUrl: null,
      title: 'Known Film',
      year: 2024
    };
    const options = {
      liveSearchTimeoutMs: 1,
      searchCachedFilms: async () => [cachedFilm],
      searchLiveFilms: async () => new Promise<never>(() => {})
    } as Parameters<typeof searchCatalogWithFallback>[1];
    const outcome = await Promise.race([
      searchCatalogWithFallback('Known Film', options),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 50))
    ]);

    expect(outcome).toEqual([cachedFilm]);
  });

  it('cancels the live catalog request when the interactive timeout expires', async () => {
    let requestSignal: AbortSignal | undefined;

    await expect(
      searchCatalogWithFallback('Unknown Film', {
        liveSearchTimeoutMs: 1,
        searchCachedFilms: async () => [],
        searchLiveFilms: async (_query, signal) => {
          requestSignal = signal;
          return new Promise<never>(() => {});
        }
      })
    ).rejects.toThrow('timed out');

    expect(requestSignal?.aborted).toBe(true);
  });

  it('returns matching cached films when the live catalog returns no results', async () => {
    const cachedFilm = {
      description: 'Cached catalog match',
      director: ['Jane Director'],
      pageId: 42,
      posterUrl: null,
      title: 'Known Film',
      year: 2024
    };

    await expect(
      searchCatalogWithFallback('Known Film', {
        searchCachedFilms: async () => [cachedFilm],
        searchLiveFilms: async () => []
      })
    ).resolves.toEqual([cachedFilm]);
  });
});

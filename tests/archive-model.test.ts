// ABOUTME: Verifies that real Movie Log state becomes filterable library items and derived statistics.
// ABOUTME: Keeps multi-view product surfaces grounded in persisted entries instead of placeholder data.
import { describe, expect, it } from 'vitest';
import {
  buildArchiveItems,
  defaultArchiveFilters,
  filterArchiveItems,
  readArchiveStats
} from '../src/archive-model.js';
import type { MovieLogState } from '../shared/types.js';

const state: MovieLogState = {
  history: [
    {
      favorite: true,
      id: '2026-07-10T20:00:00.000Z:/Movies/Flow.2024.mkv',
      rating: 4.5,
      review: 'Quiet, precise, and unexpectedly moving.',
      rewatch: false,
      source: 'drop',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      tags: ['Animation', 'Drama'],
      title: 'Flow.2024',
      viewingFormat: 'Digital',
      watchedAt: '2026-07-10T20:00:00.000Z'
    },
    {
      id: '2026-07-01T20:00:00.000Z:/Movies/Flow.2024.mkv',
      rating: 4,
      rewatch: true,
      source: 'drop',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      tags: ['Animation'],
      title: 'Flow.2024',
      watchedAt: '2026-07-01T20:00:00.000Z'
    },
    {
      id: '2026-06-18T08:00:00.000Z:/Movies/Heat.1995.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/Heat.1995.mkv',
      title: 'Heat.1995',
      watchedAt: '2026-06-18T08:00:00.000Z'
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-07-01T20:00:00.000Z',
      folderId: 'movies',
      folderPath: '/Movies',
      id: 'dev:1',
      lastSeenAt: '2026-07-10T20:00:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      title: 'Flow.2024'
    }
  ],
  watchedFolders: []
};

describe('archive model', () => {
  it('groups viewing history into one real library item per source path', () => {
    const items = buildArchiveItems(state);

    expect(items).toHaveLength(2);
    expect(items[0]?.sourcePath).toBe('/Movies/Flow.2024.mkv');
    expect(items[0]?.viewings).toHaveLength(2);
    expect(items[0]?.current).toBe(true);
    expect(items[0]?.year).toBe(2024);
    expect(items[0]?.rating).toBe(4.5);
    expect(items[0]?.tags).toEqual(['Animation', 'Drama']);
  });

  it('filters by real metadata and sorts without mutating the source state', () => {
    const items = buildArchiveItems(state);
    const filters = {
      ...defaultArchiveFilters,
      decade: '2020s',
      favorite: 'favorite',
      rating: '4-plus',
      tag: 'Animation'
    } as const;

    expect(filterArchiveItems(items, filters).map((item) => item.title)).toEqual(['Flow.2024']);
    expect(items).toHaveLength(2);
  });

  it('derives statistics, monthly activity, ratings, and tags from persisted entries', () => {
    const stats = readArchiveStats(state, new Date('2026-07-12T12:00:00.000Z'));

    expect(stats.totalViewings).toBe(3);
    expect(stats.averageRating).toBe(4.25);
    expect(stats.favorites).toBe(1);
    expect(stats.rewatches).toBe(1);
    expect(stats.months.map((month) => [month.key, month.count])).toContainEqual(['2026-07', 2]);
    expect(stats.ratings.find((rating) => rating.value === 4.5)?.count).toBe(1);
    expect(stats.tags[0]).toEqual({ count: 2, name: 'Animation' });
    expect(stats.activity).toHaveLength(84);
  });
});

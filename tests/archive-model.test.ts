// ABOUTME: Verifies that real Movie Log state becomes filterable library items and derived statistics.
// ABOUTME: Keeps multi-view product surfaces grounded in persisted entries instead of placeholder data.
import { describe, expect, it } from 'vitest';
import {
  buildArchiveItems,
  buildSearchResults,
  defaultArchiveFilters,
  filterArchiveItems,
  readArchiveStats,
  readEntryFilm,
  sumRuntime
} from '../src/archive-model.js';
import type { FilmRecord, MovieLogState } from '../shared/types.js';

const flowFilm: FilmRecord = {
  cast: ['A bird'],
  country: ['Latvia'],
  director: ['Gints Zilbalodis'],
  fetchedAt: '2026-07-12T10:00:00.000Z',
  genres: ['Animated', 'Adventure'],
  key: 'flow::2024',
  language: ['None'],
  pageId: 71441742,
  posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Flow_poster.jpg',
  runtimeMinutes: 85,
  status: 'matched',
  title: 'Flow',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Flow_(2024_film)',
  year: 2024
};

const heatFilm: FilmRecord = {
  ...flowFilm,
  director: ['Michael Mann'],
  genres: ['Crime', 'Thriller'],
  key: 'heat::1995',
  posterUrl: null,
  runtimeMinutes: 170,
  title: 'Heat',
  year: 1995
};

const state: MovieLogState = {
  films: { 'flow::2024': flowFilm, 'heat::1995': heatFilm },
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

  it('attaches film metadata, clean display titles, and review status to archive items', () => {
    const items = buildArchiveItems(state);

    expect(items[0]?.displayTitle).toBe('Flow');
    expect(items[0]?.film?.director).toEqual(['Gints Zilbalodis']);
    expect(items[0]?.film?.posterUrl).toContain('Flow_poster');
    expect(items[0]?.reviewed).toBe(true);
    expect(items[0]?.rewatched).toBe(true);
    expect(items[1]?.displayTitle).toBe('Heat');
    expect(items[1]?.reviewed).toBe(false);
    expect(items[1]?.rewatched).toBe(false);
  });

  it('filters by catalog genre and graded rating bands', () => {
    const items = buildArchiveItems(state);

    expect(filterArchiveItems(items, { ...defaultArchiveFilters, genre: 'Crime' }).map((item) => item.displayTitle)).toEqual(['Heat']);
    expect(filterArchiveItems(items, { ...defaultArchiveFilters, rating: '4.5-plus' }).map((item) => item.displayTitle)).toEqual(['Flow']);
    expect(filterArchiveItems(items, { ...defaultArchiveFilters, rating: 'unrated' }).map((item) => item.displayTitle)).toEqual(['Heat']);
  });

  it('reads films for entries and sums known runtimes', () => {
    expect(readEntryFilm(state.history[2]!, state.films)?.director).toEqual(['Michael Mann']);
    expect(sumRuntime(state.history, state.films)).toEqual({ knownCount: 3, minutes: 85 + 85 + 170 });
    expect(sumRuntime([], state.films)).toEqual({ knownCount: 0, minutes: 0 });
  });

  it('groups search results into diary, library, and catalog lanes with a flat keyboard order', () => {
    const groups = buildSearchResults(state, 'flow', [
      {
        description: '2024 animated film',
        pageId: 71441742,
        posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Flow_poster.jpg',
        title: 'Flow',
        year: 2024
      },
      { description: '2014 documentary', pageId: 999, posterUrl: null, title: 'Flowing Home', year: 2014 }
    ]);

    expect(groups.diary.map((result) => result.title)).toEqual(['Flow']);
    expect(groups.diary[0]?.director).toBe('Gints Zilbalodis');
    expect(groups.diary[0]?.year).toBe(2024);
    expect(groups.diary[0]?.posterUrl).toContain('Flow_poster');
    expect(groups.library.map((result) => result.title)).toEqual(['Flow']);
    expect(groups.catalog.map((result) => result.pageId)).toEqual([999]);
    expect(groups.flat).toHaveLength(3);
    expect(groups.flat[0]?.key).toBeTruthy();
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
    expect(stats.activity).toHaveLength(365);
  });

  it('derives runtime totals, genre breakdown, director frequency, favorite-decade ranking, and yearly counts', () => {
    const stats = readArchiveStats(state, new Date('2026-07-12T12:00:00.000Z'));

    expect(stats.totalRuntimeMinutes).toBe(85 + 85 + 170);
    expect(stats.runtimeKnownCount).toBe(3);
    expect(stats.genres.find((genre) => genre.name === 'Animated')?.count).toBe(2);
    expect(stats.genres.find((genre) => genre.name === 'Crime')?.count).toBe(1);
    expect(stats.directors[0]).toEqual({ count: 2, name: 'Gints Zilbalodis' });
    expect(stats.decades).toEqual([{ averageRating: 4.5, count: 1, label: '2020s' }]);
    expect(stats.years).toEqual([{ count: 3, year: 2026 }]);
  });
});

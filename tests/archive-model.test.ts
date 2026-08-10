// ABOUTME: Verifies that real Movie Log state becomes filterable library items and derived statistics.
// ABOUTME: Keeps multi-view product surfaces grounded in persisted entries instead of placeholder data.
import { describe, expect, it } from 'vitest';
import {
  buildArchiveItems,
  buildSearchResults,
  defaultArchiveFilters,
  filterArchiveItems,
  readArchiveCoverage,
  readArchiveStats,
  readMediaTypeLabel,
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
  it('groups viewing history into one film item while retaining its source path', () => {
    const items = buildArchiveItems(state);

    expect(items).toHaveLength(2);
    expect(items[0]?.sourcePath).toBe('/Movies/Flow.2024.mkv');
    expect(items[0]?.sourcePaths).toEqual(['/Movies/Flow.2024.mkv']);
    expect(items[0]?.viewings).toHaveLength(2);
    expect(items[0]?.current).toBe(true);
    expect(items[0]?.year).toBe(2024);
    expect(items[0]?.rating).toBe(4.5);
    expect(items[0]?.tags).toEqual(['Animation', 'Drama']);
  });

  it('keeps hidden and unsupported file history out of archive items and metadata coverage', () => {
    const invalidFileState: MovieLogState = {
      ...state,
      films: {
        ...state.films,
        'ds store::': {
          ...flowFilm,
          attempts: 2,
          failureReason: 'temporary',
          key: 'ds store::',
          posterUrl: null,
          status: 'failed',
          title: 'DS Store',
          year: null
        }
      },
      history: [
        ...state.history,
        {
          id: 'hidden-file',
          source: 'watch',
          sourceKind: 'file',
          sourcePath: '/Movies/.DS_Store',
          title: '.DS_Store',
          watchedAt: '2026-07-12T12:00:00.000Z'
        }
      ]
    };

    expect(buildArchiveItems(invalidFileState)).toHaveLength(2);
    expect(readArchiveCoverage(invalidFileState)).toMatchObject({ failed: 0, matched: 2, total: 2 });
  });

  it('groups multiple files and a catalog-only entry by clean title plus year without rewriting viewings', () => {
    const groupedState: MovieLogState = {
      ...state,
      history: [
        ...state.history,
        {
          id: '2026-07-11T20:00:00.000Z:/Downloads/Flow.2024.mp4',
          rating: 5,
          source: 'drop',
          sourceKind: 'file',
          sourcePath: '/Downloads/Flow.2024.mp4',
          title: 'Flow.2024',
          watchedAt: '2026-07-11T20:00:00.000Z'
        },
        {
          id: '2026-07-12T20:00:00.000Z:film://wikipedia-71441742/Flow (2024)',
          review: 'Catalog-only viewing.',
          source: 'drop',
          sourceKind: 'directory',
          sourcePath: 'film://wikipedia-71441742/Flow (2024)',
          title: 'Flow (2024)',
          watchedAt: '2026-07-12T20:00:00.000Z'
        }
      ],
      libraryItems: [
        ...state.libraryItems,
        {
          firstSeenAt: '2026-07-11T20:00:00.000Z',
          folderId: 'downloads',
          folderPath: '/Downloads',
          id: 'dev:2',
          lastSeenAt: '2026-07-11T20:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Downloads/Flow.2024.mp4',
          title: 'Flow.2024'
        }
      ]
    };

    const items = buildArchiveItems(groupedState);
    const flow = items.find((item) => item.displayTitle === 'Flow');

    expect(items).toHaveLength(2);
    expect(flow?.viewings).toHaveLength(4);
    expect(flow?.sourcePaths).toEqual([
      'film://wikipedia-71441742/Flow (2024)',
      '/Downloads/Flow.2024.mp4',
      '/Movies/Flow.2024.mkv'
    ]);
    expect(flow?.localSourcePaths).toEqual(['/Downloads/Flow.2024.mp4', '/Movies/Flow.2024.mkv']);
    expect(groupedState.history).toHaveLength(5);
    expect(buildSearchResults(groupedState, 'flow', []).watched).toHaveLength(1);
  });

  it('keeps same-title films from different years separate and merges missing-year identities together', () => {
    const identityState: MovieLogState = {
      films: {},
      history: [
        {
          id: 'heat-1995',
          source: 'drop',
          sourceKind: 'file',
          sourcePath: '/Movies/Heat.1995.mkv',
          title: 'Heat.1995',
          watchedAt: '2026-07-01T12:00:00.000Z'
        },
        {
          id: 'heat-1986',
          source: 'drop',
          sourceKind: 'file',
          sourcePath: '/Movies/Heat.1986.mkv',
          title: 'Heat.1986',
          watchedAt: '2026-07-02T12:00:00.000Z'
        },
        {
          id: 'home-one',
          source: 'drop',
          sourceKind: 'file',
          sourcePath: '/Movies/Home Video.mkv',
          title: 'Home Video',
          watchedAt: '2026-07-03T12:00:00.000Z'
        },
        {
          id: 'home-two',
          source: 'drop',
          sourceKind: 'file',
          sourcePath: '/Downloads/Home.Video.mp4',
          title: 'Home.Video',
          watchedAt: '2026-07-04T12:00:00.000Z'
        }
      ],
      libraryItems: [],
      watchedFolders: []
    };

    const items = buildArchiveItems(identityState);

    expect(items).toHaveLength(3);
    expect(items.filter((item) => item.displayTitle === 'Heat')).toHaveLength(2);
    expect(items.find((item) => item.displayTitle === 'Home Video')?.viewings).toHaveLength(2);
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

    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        genre: 'Crime'
      }).map((item) => item.displayTitle)
    ).toEqual(['Heat']);
    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        rating: '4.5-plus'
      }).map((item) => item.displayTitle)
    ).toEqual(['Flow']);
    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        rating: 'unrated'
      }).map((item) => item.displayTitle)
    ).toEqual(['Heat']);
  });

  it('filters by director, exact release year, and viewing date', () => {
    const items = buildArchiveItems(state);

    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        director: 'Michael Mann'
      }).map((item) => item.displayTitle)
    ).toEqual(['Heat']);
    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        year: '2024'
      }).map((item) => item.displayTitle)
    ).toEqual(['Flow']);
    expect(
      filterArchiveItems(items, {
        ...defaultArchiveFilters,
        watchDate: 'year:2025'
      })
    ).toEqual([]);
  });

  it('sorts recently added independently from the latest viewing date', () => {
    const addedState: MovieLogState = {
      ...state,
      libraryItems: [
        {
          ...state.libraryItems[0]!,
          firstSeenAt: '2026-06-01T20:00:00.000Z'
        },
        {
          firstSeenAt: '2026-07-11T20:00:00.000Z',
          folderId: 'movies',
          folderPath: '/Movies',
          id: 'dev:2',
          lastSeenAt: '2026-07-11T20:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Movies/Heat.1995.mkv',
          title: 'Heat.1995'
        }
      ]
    };
    const items = buildArchiveItems(addedState);

    expect(filterArchiveItems(items, { ...defaultArchiveFilters, sort: 'recent' })[0]?.displayTitle).toBe('Flow');
    expect(filterArchiveItems(items, { ...defaultArchiveFilters, sort: 'added' })[0]?.displayTitle).toBe('Heat');
  });

  it('models films, series episodes, and unknown media without rewriting stored titles', () => {
    const mediaState: MovieLogState = {
      films: { 'flow::2024': { ...flowFilm, mediaType: 'film' } },
      history: [
        state.history[0]!,
        {
          id: 'episode',
          source: 'watch',
          sourceKind: 'file',
          sourcePath: '/Shows/Severance.S01E04.1080p.mkv',
          title: 'Severance.S01E04.1080p',
          watchedAt: '2026-07-12T20:00:00.000Z'
        },
        {
          id: 'unknown',
          source: 'watch',
          sourceKind: 'directory',
          sourcePath: '/Archive/Hl25',
          title: 'Hl25',
          watchedAt: '2026-07-13T20:00:00.000Z'
        }
      ],
      libraryItems: [],
      watchedFolders: []
    };
    const items = buildArchiveItems(mediaState);
    const episode = items.find((item) => item.title === 'Severance.S01E04.1080p');

    expect(episode?.displayTitle).toBe('Severance');
    expect(episode?.episodeCode).toBe('S01E04');
    expect(readMediaTypeLabel(episode!)).toBe('Series · S01E04');
    expect(filterArchiveItems(items, { ...defaultArchiveFilters, mediaType: 'series' })).toEqual([episode]);
    expect(
      filterArchiveItems(items, { ...defaultArchiveFilters, mediaType: 'unknown' }).map((item) => item.title)
    ).toEqual(['Hl25']);
    expect(mediaState.history[1]?.title).toBe('Severance.S01E04.1080p');

    const stats = readArchiveStats(mediaState);
    expect({ films: stats.filmViewings, series: stats.seriesEpisodes, unknown: stats.unknownViewings }).toEqual({
      films: 1,
      series: 1,
      unknown: 1
    });
  });

  it('keeps distinct episodes as distinct Library items while sharing series metadata', () => {
    const episodeState: MovieLogState = {
      films: {},
      history: [
        {
          id: 'episode-4',
          source: 'watch',
          sourceKind: 'file',
          sourcePath: '/Shows/Severance.S01E04.mkv',
          title: 'Severance.S01E04',
          watchedAt: '2026-07-12T20:00:00.000Z'
        },
        {
          id: 'episode-5',
          source: 'watch',
          sourceKind: 'file',
          sourcePath: '/Shows/Severance.S01E05.mkv',
          title: 'Severance.S01E05',
          watchedAt: '2026-07-13T20:00:00.000Z'
        }
      ],
      libraryItems: [],
      watchedFolders: []
    };

    expect(buildArchiveItems(episodeState).map((item) => item.episodeCode)).toEqual(['S01E05', 'S01E04']);
  });

  it('reads films for entries and sums known runtimes', () => {
    expect(readEntryFilm(state.history[2]!, state.films)?.director).toEqual(['Michael Mann']);
    expect(sumRuntime(state.history, state.films)).toEqual({
      knownCount: 3,
      minutes: 85 + 85 + 170
    });
    expect(sumRuntime([], state.films)).toEqual({ knownCount: 0, minutes: 0 });
  });

  it('gives watched records precedence over indexed-only and catalog search results', () => {
    const groups = buildSearchResults(state, 'flow', [
      {
        description: '2024 animated film',
        pageId: 71441742,
        posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Flow_poster.jpg',
        title: 'Flow',
        year: 2024
      },
      {
        description: '2014 documentary',
        pageId: 999,
        posterUrl: null,
        title: 'Flowing Home',
        year: 2014
      }
    ]);

    expect(groups.watched.map((result) => result.title)).toEqual(['Flow']);
    expect(groups.watched[0]?.director).toEqual(['Gints Zilbalodis']);
    expect(groups.watched[0]?.year).toBe(2024);
    expect(groups.watched[0]?.posterUrl).toContain('Flow_poster');
    expect(groups.library).toEqual([]);
    expect(groups.catalog.map((result) => result.pageId)).toEqual([999]);
    expect(groups.flat).toHaveLength(2);
    expect(groups.flat[0]?.key).toBeTruthy();
  });

  it('matches local records across credits, metadata, reviews, punctuation, and multiple query terms', () => {
    expect(buildSearchResults(state, 'gints adventure', []).watched.map((result) => result.title)).toEqual(['Flow']);
    expect(buildSearchResults(state, 'unexpectedly, moving', []).watched.map((result) => result.title)).toEqual([
      'Flow'
    ]);
    expect(buildSearchResults(state, 'a bird animation', []).watched.map((result) => result.title)).toEqual(['Flow']);
  });

  it('does not count an indexed copy as a second viewing or a Library search result', () => {
    const mixedState: MovieLogState = {
      ...state,
      history: [{ ...state.history[0]!, rewatch: false }],
      libraryItems: [
        {
          firstSeenAt: '2026-07-11T20:00:00.000Z',
          folderId: 'archive',
          folderPath: '/Archive',
          id: 'dev:copy',
          lastSeenAt: '2026-07-12T20:00:00.000Z',
          sourceKind: 'file',
          sourcePath: '/Archive/Flow.2024.mkv',
          title: 'Flow.2024'
        }
      ]
    };
    const flow = buildArchiveItems(mixedState).find((item) => item.displayTitle === 'Flow');
    const groups = buildSearchResults(mixedState, 'flow', []);

    expect(flow?.viewings).toHaveLength(1);
    expect(flow?.rewatched).toBe(false);
    expect(flow?.localSourcePaths).toEqual(['/Archive/Flow.2024.mkv', '/Movies/Flow.2024.mkv']);
    expect(groups.watched).toHaveLength(1);
    expect(groups.library).toHaveLength(0);
  });

  it('does not materialize the complete archive before Search has a query', () => {
    const groups = buildSearchResults(state, '', []);

    expect(groups).toEqual({ catalog: [], flat: [], library: [], watched: [] });
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

  it('calculates honest metadata and personal-annotation progress states', () => {
    const coverageState: MovieLogState = {
      ...state,
      films: {
        'flow::2024': flowFilm,
        'heat::1995': {
          ...heatFilm,
          attempts: 2,
          failureReason: 'temporary',
          status: 'failed'
        }
      }
    };

    expect(readArchiveCoverage(coverageState)).toEqual({
      annotated: 1,
      failed: 1,
      matched: 1,
      pending: 0,
      retryScheduled: 0,
      total: 2,
      unmatched: 0
    });
  });
});

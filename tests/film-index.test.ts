// ABOUTME: Verifies the film metadata cache enriches, persists, and rematches without touching the history store.
// ABOUTME: Uses a stub catalog and temp directories so cache behavior stays deterministic and offline.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilmIndex } from '../electron/film-index.js';
import type { CatalogSearchResult, FilmDetails } from '../shared/types.js';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'movie-log-films-'));
});

afterEach(async () => {
  await rm(dataDirectory, { force: true, recursive: true });
});

const plagueResult: CatalogSearchResult = {
  description: 'Psychological drama thriller film',
  pageId: 79985226,
  posterUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c3/The_Plague_film_poster.jpg',
  title: 'The Plague',
  year: 2025
};

const plagueDetails: FilmDetails = {
  cast: ['Joel Edgerton'],
  country: ['United States of America'],
  director: ['Charlie Polinger'],
  genres: ['Drama'],
  language: ['English'],
  pageId: 79985226,
  posterUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c3/The_Plague_film_poster.jpg',
  runtimeMinutes: 95,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/The_Plague_(2025_film)',
  year: 2025
};

function createStubCatalog() {
  const calls = { details: 0, search: 0 };

  return {
    calls,
    catalog: {
      async fetchFilmDetails(pageId: number): Promise<FilmDetails | null> {
        calls.details += 1;
        return pageId === plagueResult.pageId ? plagueDetails : null;
      },
      async searchFilms(query: string): Promise<CatalogSearchResult[]> {
        calls.search += 1;
        return query.toLowerCase().includes('plague') ? [plagueResult] : [];
      }
    }
  };
}

describe('createFilmIndex', () => {
  it('enriches unknown films, persists them, and skips already-cached keys', async () => {
    const { calls, catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });

    const changed = await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);
    expect(changed).toBe(true);

    const films = await index.readFilms();
    expect(films['the plague::2025']).toMatchObject({
      director: ['Charlie Polinger'],
      fetchedAt: '2026-07-12T10:00:00.000Z',
      key: 'the plague::2025',
      pageId: 79985226,
      posterUrl: plagueDetails.posterUrl,
      runtimeMinutes: 95,
      status: 'matched',
      title: 'The Plague',
      year: 2025
    });

    const unchanged = await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);
    expect(unchanged).toBe(false);
    expect(calls.search).toBe(1);
    expect(calls.details).toBe(1);

    const persisted = JSON.parse(await readFile(join(dataDirectory, 'movie-log-films.json'), 'utf8'));
    expect(persisted.films['the plague::2025'].status).toBe('matched');
  });

  it('returns matched cached films when the live catalog is unavailable', async () => {
    const { catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });
    await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);

    expect(await index.searchFilms('The Plague film')).toEqual([
      {
        catalogId: '79985226',
        catalogSource: 'wikipedia',
        description: 'Cached catalog match',
        director: ['Charlie Polinger'],
        pageId: 79985226,
        posterUrl: plagueDetails.posterUrl,
        title: 'The Plague',
        year: 2025
      }
    ]);
  });

  it('reads cached search results while background enrichment is still running', async () => {
    await writeFile(
      join(dataDirectory, 'movie-log-films.json'),
      `${JSON.stringify({
        films: {
          'the plague::2025': {
            ...plagueDetails,
            fetchedAt: '2026-07-12T10:00:00.000Z',
            key: 'the plague::2025',
            status: 'matched',
            title: 'The Plague'
          }
        }
      })}\n`,
      'utf8'
    );
    let releaseEnrichment = () => {};
    let markEnrichmentStarted = () => {};
    const enrichmentStarted = new Promise<void>((resolve) => {
      markEnrichmentStarted = resolve;
    });
    const enrichmentRelease = new Promise<void>((resolve) => {
      releaseEnrichment = resolve;
    });
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return null;
        },
        async searchFilms() {
          markEnrichmentStarted();
          await enrichmentRelease;
          return [];
        }
      },
      dataDirectory
    });
    const enrichment = index.enrichFilms([{ key: 'pending::2026', title: 'Pending', year: 2026 }]);
    await enrichmentStarted;

    const searchOutcome = await Promise.race([
      index.searchFilms('The Plague film'),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 100))
    ]);
    releaseEnrichment();
    await enrichment;

    expect(searchOutcome).not.toBe('blocked');
    expect(searchOutcome).toEqual([
      {
        description: 'Cached catalog match',
        director: ['Charlie Polinger'],
        pageId: 79985226,
        posterUrl: plagueDetails.posterUrl,
        title: 'The Plague',
        year: 2025
      }
    ]);
  });

  it('records an unmatched film so missing metadata stays a designed state instead of a refetch loop', async () => {
    const { calls, catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });

    await index.enrichFilms([{ key: 'home video::', title: 'Home Video', year: null }]);
    const films = await index.readFilms();

    expect(films['home video::']).toMatchObject({ pageId: null, posterUrl: null, status: 'unmatched' });

    await index.enrichFilms([{ key: 'home video::', title: 'Home Video', year: null }]);
    expect(calls.search).toBe(1);

    await index.enrichFilms([{ key: 'home video::', title: 'Home Video', year: null }], { forceRetry: true });
    expect(calls.search).toBe(2);
  });

  it('rematches a film to an explicit catalog page and can clear a wrong match', async () => {
    const { catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });

    const matched = await index.matchFilm('home video::', { title: 'Home Video', year: null }, plagueResult.pageId);
    expect(matched?.status).toBe('matched');
    expect(matched?.director).toEqual(['Charlie Polinger']);

    const cleared = await index.matchFilm('home video::', { title: 'Home Video', year: null }, null);
    expect(cleared?.status).toBe('unmatched');
    expect(cleared?.posterUrl).toBeNull();
  });

  it('reuses a complete cached page when attaching that catalog film to another accepted media key', async () => {
    let catalogAvailable = true;
    let detailCalls = 0;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          detailCalls += 1;

          if (!catalogAvailable) {
            throw new Error('rate limited');
          }

          return plagueDetails;
        },
        async searchFilms() {
          return [plagueResult];
        }
      },
      dataDirectory
    });
    await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);
    catalogAvailable = false;

    const attached = await index.matchFilm('local media::', { title: 'The Plague', year: 2025 }, plagueResult.pageId);

    expect(attached).toMatchObject({
      director: ['Charlie Polinger'],
      key: 'local media::',
      pageId: plagueResult.pageId,
      status: 'matched',
      title: 'The Plague'
    });
    expect(detailCalls).toBe(1);
  });

  it('keeps films readable when the cache file is corrupt', async () => {
    await writeFile(join(dataDirectory, 'movie-log-films.json'), 'not json', 'utf8');
    const { catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });

    expect(await index.readFilms()).toEqual({});
  });

  it('records a temporary failure without mislabeling it as confidently unmatched', async () => {
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          throw new Error('offline');
        },
        async searchFilms() {
          throw new Error('offline');
        }
      },
      dataDirectory,
      maxAttempts: 1,
      now: () => '2026-07-12T10:00:00.000Z'
    });

    const changed = await index.enrichFilms([{ key: 'flow::2024', title: 'Flow', year: 2024 }]);
    expect(changed).toBe(true);
    expect(await index.readFilms()).toMatchObject({
      'flow::2024': {
        attempts: 1,
        status: 'retry-scheduled',
        title: 'Flow'
      }
    });
  });

  it('persists exponential cross-launch backoff and does not retry again on every startup', async () => {
    let currentTime = '2026-07-12T10:00:00.000Z';
    let searchCalls = 0;
    const catalog = {
      async fetchFilmDetails() {
        throw new Error('offline');
      },
      async searchFilms() {
        searchCalls += 1;
        throw new Error('offline');
      }
    };
    const request = [{ key: 'flow::2024', title: 'Flow', year: 2024 }];
    const createIndex = () =>
      createFilmIndex({
        backoffDelaysMs: [60_000, 120_000],
        catalog,
        dataDirectory,
        maxAttempts: 1,
        now: () => currentTime
      });

    await createIndex().enrichFilms(request);
    expect((await createIndex().readFilms())['flow::2024']).toMatchObject({
      attempts: 1,
      nextRetryAt: '2026-07-12T10:01:00.000Z',
      status: 'retry-scheduled'
    });

    currentTime = '2026-07-12T10:00:30.000Z';
    await expect(createIndex().enrichFilms(request)).resolves.toBe(false);
    expect(searchCalls).toBe(1);

    currentTime = '2026-07-12T10:01:01.000Z';
    await createIndex().enrichFilms(request);
    expect((await createIndex().readFilms())['flow::2024']).toMatchObject({
      attempts: 2,
      nextRetryAt: '2026-07-12T10:03:01.000Z',
      status: 'retry-scheduled'
    });
    expect(searchCalls).toBe(2);
  });

  it('bounds automatic work per run and batches cache persistence plus renderer progress', async () => {
    const progressSnapshots: Array<Record<string, unknown>> = [];
    let searchCalls = 0;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return plagueDetails;
        },
        async searchFilms() {
          searchCalls += 1;
          return [plagueResult];
        }
      },
      dataDirectory,
      maxWorkPerRun: 4,
      persistBatchSize: 2
    });
    const requests = Array.from({ length: 7 }, (_value, index) => ({
      key: `the plague ${index}::2025`,
      title: `The Plague ${index}`,
      year: 2025
    }));

    await index.enrichFilms(requests, {
      onProgress: (films) => {
        progressSnapshots.push(films);
      }
    });

    expect(searchCalls).toBe(4);
    expect(Object.keys(await index.readFilms())).toHaveLength(4);
    expect(progressSnapshots).toHaveLength(3);
  });

  it('attaches the selected catalog result without another network request and completes details later', async () => {
    let detailsCalls = 0;
    let searchCalls = 0;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          detailsCalls += 1;
          return plagueDetails;
        },
        async searchFilms() {
          searchCalls += 1;
          return [plagueResult];
        }
      },
      dataDirectory
    });

    const attached = await index.attachFilm('local media::', plagueResult);

    expect(attached).toMatchObject({
      detailsComplete: false,
      pageId: plagueResult.pageId,
      posterUrl: plagueResult.posterUrl,
      status: 'matched',
      title: 'The Plague',
      year: 2025
    });
    expect(detailsCalls).toBe(0);
    expect(searchCalls).toBe(0);

    await index.enrichFilms([{ key: 'local media::', mediaType: 'film', title: 'Opaque Local Filename', year: null }]);
    expect((await index.readFilms())['local media::']).toMatchObject({
      detailsComplete: true,
      director: ['Charlie Polinger'],
      mediaType: 'film',
      status: 'matched',
      title: 'The Plague',
      year: 2025
    });
    expect(detailsCalls).toBe(1);
    expect(searchCalls).toBe(0);
  });

  it('can prioritize poster coverage before secondary detail requests', async () => {
    const { calls, catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, deferDetails: true });
    const request = [{ key: 'the plague::2025', title: 'The Plague', year: 2025 }];

    await index.enrichFilms(request);
    expect((await index.readFilms())['the plague::2025']).toMatchObject({
      detailsComplete: false,
      pageId: plagueResult.pageId,
      posterUrl: plagueResult.posterUrl,
      status: 'matched'
    });
    expect(calls).toEqual({ details: 0, search: 1 });

    await index.enrichFilms(request);
    expect((await index.readFilms())['the plague::2025']).toMatchObject({
      detailsComplete: true,
      director: ['Charlie Polinger']
    });
    expect(calls).toEqual({ details: 1, search: 1 });
  });

  it('uses an exact source-aware poster fallback when the primary catalog is throttled', async () => {
    const fallbackResult: CatalogSearchResult = {
      catalogId: 'tt79985226',
      catalogSource: 'imdb',
      description: 'Feature film',
      pageId: -79985226,
      posterUrl: 'https://m.media-amazon.com/plague.jpg',
      title: 'The Plague',
      year: 2025
    };
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          throw new Error('should not fetch secondary details');
        },
        async searchFilms() {
          throw new Error('429 throttled');
        },
        async searchPosterFallback() {
          return [fallbackResult];
        }
      },
      dataDirectory,
      maxAttempts: 1
    });

    await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);

    expect((await index.readFilms())['the plague::2025']).toMatchObject({
      catalogId: 'tt79985226',
      catalogSource: 'imdb',
      detailsComplete: true,
      pageId: -79985226,
      posterUrl: fallbackResult.posterUrl,
      status: 'matched'
    });
  });

  it('revalidates an incomplete legacy movie page before enriching the same-title series', async () => {
    await writeFile(
      join(dataDirectory, 'movie-log-films.json'),
      `${JSON.stringify({
        films: {
          'the boys::': {
            attempts: 1,
            cast: [],
            country: [],
            detailsComplete: false,
            director: [],
            fetchedAt: '2026-07-12T10:00:00.000Z',
            genres: [],
            key: 'the boys::',
            language: [],
            matchVersion: 2,
            mediaType: 'film',
            pageId: 1,
            posterUrl: 'https://example.test/wrong-movie.jpg',
            runtimeMinutes: null,
            status: 'matched',
            title: 'The Boys',
            wikipediaUrl: null,
            year: null
          }
        }
      })}\n`,
      'utf8'
    );
    const fetchedPageIds: number[] = [];
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails(pageId) {
          fetchedPageIds.push(pageId);
          return { ...plagueDetails, pageId: 2, posterUrl: 'https://example.test/correct-series.jpg', year: 2019 };
        },
        async searchFilms() {
          return [
            {
              description: 'American superhero television series',
              pageId: 2,
              posterUrl: 'https://example.test/correct-series.jpg',
              title: 'The Boys',
              year: 2019
            }
          ];
        }
      },
      dataDirectory
    });

    await index.enrichFilms([{ key: 'the boys::', mediaType: 'series', title: 'The Boys', year: null }]);

    expect(fetchedPageIds).toEqual([2]);
    expect((await index.readFilms())['the boys::']).toMatchObject({
      mediaType: 'series',
      pageId: 2,
      posterUrl: 'https://example.test/correct-series.jpg'
    });
  });

  it('prioritizes unseen identities ahead of force-retrying an older terminal failure', async () => {
    let catalogAvailable = false;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return plagueDetails;
        },
        async searchFilms() {
          if (!catalogAvailable) {
            throw new Error('offline');
          }

          return [plagueResult];
        }
      },
      dataDirectory,
      maxAttempts: 1,
      maxFailureCount: 1
    });
    const failed = { key: 'older failure::2020', title: 'Older Failure', year: 2020 };
    const unseen = { key: 'the plague::2025', title: 'The Plague', year: 2025 };
    await index.enrichFilms([failed]);
    catalogAvailable = true;

    await index.enrichFilms([failed, unseen], { forceRetry: true, maxWork: 1 });
    const films = await index.readFilms();

    expect(films['older failure::2020']?.status).toBe('failed');
    expect(films['the plague::2025']?.status).toBe('matched');
  });

  it('persists each successful record before the rest of a batch finishes', async () => {
    let releaseSecond = () => {};
    let notifyFirstPersisted = () => {};
    const secondRelease = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const firstPersisted = new Promise<void>((resolve) => {
      notifyFirstPersisted = resolve;
    });
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails(pageId: number) {
          return pageId === plagueResult.pageId ? plagueDetails : null;
        },
        async searchFilms(query: string) {
          if (query.toLowerCase().includes('slow')) {
            await secondRelease;
            return [];
          }

          return [plagueResult];
        }
      },
      concurrency: 1,
      dataDirectory,
      now: () => '2026-07-12T10:00:00.000Z'
    });
    const enrichment = index.enrichFilms(
      [
        { key: 'the plague::2025', title: 'The Plague', year: 2025 },
        { key: 'slow::2026', title: 'Slow', year: 2026 }
      ],
      {
        onProgress: (films) => {
          if (films['the plague::2025']?.status === 'matched') {
            notifyFirstPersisted();
          }
        }
      }
    );

    expect(
      await Promise.race([
        firstPersisted.then(() => 'persisted'),
        new Promise((resolve) => setTimeout(() => resolve('blocked'), 100))
      ])
    ).toBe('persisted');
    expect(JSON.parse(await readFile(join(dataDirectory, 'movie-log-films.json'), 'utf8')).films).toMatchObject({
      'slow::2026': { status: 'pending' },
      'the plague::2025': { status: 'matched' }
    });

    releaseSecond();
    await enrichment;
  });

  it('times out a catalog boundary and reaches a temporary failed state', async () => {
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return null;
        },
        async searchFilms() {
          return new Promise<never>(() => {});
        }
      },
      dataDirectory,
      maxAttempts: 1,
      requestTimeoutMs: 2
    });
    const outcome = await Promise.race([
      index.enrichFilms([{ key: 'timeout::2026', title: 'Timeout', year: 2026 }]),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 100))
    ]);

    expect(outcome).not.toBe('blocked');
    expect((await index.readFilms())['timeout::2026']?.status).toBe('retry-scheduled');
  });

  it('retries one transient failure with bounded backoff and persists the eventual match', async () => {
    let searchCount = 0;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return plagueDetails;
        },
        async searchFilms() {
          searchCount += 1;

          if (searchCount === 1) {
            throw new Error('temporary outage');
          }

          return [plagueResult];
        }
      },
      dataDirectory,
      retryDelaysMs: [0]
    });

    await index.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);

    expect(searchCount).toBe(2);
    expect((await index.readFilms())['the plague::2025']?.status).toBe('matched');
  });

  it('prevents duplicate simultaneous enrichment jobs', async () => {
    let release = () => {};
    let searchCount = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return plagueDetails;
        },
        async searchFilms() {
          searchCount += 1;
          await gate;
          return [plagueResult];
        }
      },
      dataDirectory
    });
    const requests = [{ key: 'the plague::2025', title: 'The Plague', year: 2025 }];
    const first = index.enrichFilms(requests);
    const duplicate = index.enrichFilms(requests);
    release();

    await Promise.all([first, duplicate]);
    expect(searchCount).toBe(1);
  });

  it('resumes a persisted pending title after an interrupted application run', async () => {
    await writeFile(
      join(dataDirectory, 'movie-log-films.json'),
      `${JSON.stringify({
        films: {
          'the plague::2025': {
            attempts: 0,
            cast: [],
            country: [],
            director: [],
            fetchedAt: '2026-07-12T10:00:00.000Z',
            genres: [],
            key: 'the plague::2025',
            language: [],
            pageId: null,
            posterUrl: null,
            runtimeMinutes: null,
            status: 'pending',
            title: 'The Plague',
            wikipediaUrl: null,
            year: 2025
          }
        }
      })}\n`,
      'utf8'
    );
    const { catalog } = createStubCatalog();
    const restarted = createFilmIndex({ catalog, dataDirectory });

    await restarted.enrichFilms([{ key: 'the plague::2025', title: 'The Plague', year: 2025 }]);

    expect((await restarted.readFilms())['the plague::2025']?.status).toBe('matched');
  });

  it('allows an explicit retry to recover a persisted temporary failure', async () => {
    let available = false;
    const index = createFilmIndex({
      catalog: {
        async fetchFilmDetails() {
          return plagueDetails;
        },
        async searchFilms() {
          if (!available) {
            throw new Error('offline');
          }

          return [plagueResult];
        }
      },
      dataDirectory,
      maxAttempts: 1,
      now: () => '2026-07-12T10:00:00.000Z'
    });
    const requests = [{ key: 'the plague::2025', title: 'The Plague', year: 2025 }];
    await index.enrichFilms(requests);
    expect((await index.readFilms())['the plague::2025']?.status).toBe('retry-scheduled');

    available = true;
    await index.enrichFilms(requests, { forceRetry: true });

    expect((await index.readFilms())['the plague::2025']?.status).toBe('matched');
  });
});

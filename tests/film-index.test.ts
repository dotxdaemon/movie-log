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

  it('keeps films readable when the cache file is corrupt', async () => {
    await writeFile(join(dataDirectory, 'movie-log-films.json'), 'not json', 'utf8');
    const { catalog } = createStubCatalog();
    const index = createFilmIndex({ catalog, dataDirectory, now: () => '2026-07-12T10:00:00.000Z' });

    expect(await index.readFilms()).toEqual({});
  });

  it('leaves no cache entry when the catalog fails so the next trigger retries', async () => {
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
      now: () => '2026-07-12T10:00:00.000Z'
    });

    const changed = await index.enrichFilms([{ key: 'flow::2024', title: 'Flow', year: 2024 }]);
    expect(changed).toBe(false);
    expect(await index.readFilms()).toEqual({});
  });
});

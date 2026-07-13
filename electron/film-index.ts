// ABOUTME: Caches film catalog metadata in a standalone JSON file beside the guarded history store.
// ABOUTME: Enriches unknown films once, records confident misses, and supports explicit rematching.
import { mkdir, readFile, rename } from 'node:fs/promises';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { chooseFilmMatch, type FilmCatalog } from './film-catalog.js';
import type { FilmDetails, FilmRecord } from '../shared/types.js';

export interface FilmEnrichmentRequest {
  key: string;
  title: string;
  year: number | null;
}

interface FilmIndexOptions {
  catalog: FilmCatalog;
  dataDirectory: string;
  now?: () => string;
}

interface PersistedFilms {
  films: Record<string, FilmRecord>;
}

function buildRecord(
  key: string,
  film: { title: string; year: number | null },
  details: FilmDetails | null,
  fetchedAt: string
): FilmRecord {
  return {
    cast: details?.cast ?? [],
    country: details?.country ?? [],
    director: details?.director ?? [],
    fetchedAt,
    genres: details?.genres ?? [],
    key,
    language: details?.language ?? [],
    pageId: details?.pageId ?? null,
    posterUrl: details?.posterUrl ?? null,
    runtimeMinutes: details?.runtimeMinutes ?? null,
    status: details ? 'matched' : 'unmatched',
    title: film.title,
    wikipediaUrl: details?.wikipediaUrl ?? null,
    year: details?.year ?? film.year
  };
}

export function createFilmIndex({ catalog, dataDirectory, now = () => new Date().toISOString() }: FilmIndexOptions) {
  const filmsFilePath = join(dataDirectory, 'movie-log-films.json');
  let queue = Promise.resolve();

  function runSerialized<T>(work: () => Promise<T>): Promise<T> {
    const task = queue.catch(() => undefined).then(work);
    queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  async function readPersistedFilms(): Promise<Record<string, FilmRecord>> {
    try {
      const parsed = JSON.parse(await readFile(filmsFilePath, 'utf8')) as Partial<PersistedFilms>;
      return parsed.films ?? {};
    } catch (error) {
      if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }

      throw error;
    }
  }

  async function writePersistedFilms(films: Record<string, FilmRecord>): Promise<void> {
    await mkdir(dataDirectory, { recursive: true });
    const temporaryPath = `${filmsFilePath}.tmp-${process.pid}`;
    const fileHandle = await open(temporaryPath, 'w');

    try {
      await fileHandle.writeFile(`${JSON.stringify({ films }, null, 2)}\n`, 'utf8');
      await fileHandle.sync();
    } finally {
      await fileHandle.close();
    }

    await rename(temporaryPath, filmsFilePath);
  }

  async function fetchRecord(key: string, film: { title: string; year: number | null }): Promise<FilmRecord> {
    const results = await catalog.searchFilms(`${film.title}${film.year ? ` ${film.year}` : ''} film`);
    const match = chooseFilmMatch(results, film);
    const details = match ? await catalog.fetchFilmDetails(match.pageId) : null;
    return buildRecord(key, film, details, now());
  }

  return {
    async readFilms(): Promise<Record<string, FilmRecord>> {
      return runSerialized(readPersistedFilms);
    },

    async enrichFilms(requests: FilmEnrichmentRequest[]): Promise<boolean> {
      const known = await runSerialized(readPersistedFilms);
      const pending = requests.filter((request, index) => {
        return !known[request.key] && requests.findIndex((candidate) => candidate.key === request.key) === index;
      });

      if (pending.length === 0) {
        return false;
      }

      const fetchedRecords: FilmRecord[] = [];

      for (const request of pending) {
        try {
          fetchedRecords.push(await fetchRecord(request.key, request));
        } catch {
          continue;
        }
      }

      if (fetchedRecords.length === 0) {
        return false;
      }

      await runSerialized(async () => {
        const films = await readPersistedFilms();

        for (const record of fetchedRecords) {
          films[record.key] = record;
        }

        await writePersistedFilms(films);
      });

      return true;
    },

    async matchFilm(
      key: string,
      film: { title: string; year: number | null },
      pageId: number | null
    ): Promise<FilmRecord | null> {
      let details: FilmDetails | null = null;

      if (pageId !== null) {
        details = await catalog.fetchFilmDetails(pageId);
      }

      const record = buildRecord(key, film, details, now());

      await runSerialized(async () => {
        const films = await readPersistedFilms();
        films[key] = record;
        await writePersistedFilms(films);
      });

      return record;
    }
  };
}

export type FilmIndex = ReturnType<typeof createFilmIndex>;

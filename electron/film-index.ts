// ABOUTME: Caches film catalog metadata in a standalone JSON file beside the guarded history store.
// ABOUTME: Persists bounded enrichment progress as matched, unmatched, pending, or temporarily failed records.
import { mkdir, readFile, rename } from 'node:fs/promises';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { chooseFilmMatch, type FilmCatalog } from './film-catalog.js';
import type { CatalogSearchResult, FilmDetails, FilmRecord } from '../shared/types.js';

export interface FilmEnrichmentRequest {
  key: string;
  title: string;
  year: number | null;
}

interface FilmIndexOptions {
  catalog: FilmCatalog;
  concurrency?: number;
  dataDirectory: string;
  maxAttempts?: number;
  now?: () => string;
  requestTimeoutMs?: number;
  retryDelaysMs?: number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

interface EnrichFilmOptions {
  forceRetry?: boolean;
  onProgress?: (films: Record<string, FilmRecord>) => Promise<void> | void;
}

interface PersistedFilms {
  films: Record<string, FilmRecord>;
}

class EnrichmentCancelledError extends Error {
  constructor() {
    super('Film metadata enrichment was cancelled.');
  }
}

function emptyRecord(
  request: FilmEnrichmentRequest,
  fetchedAt: string,
  status: FilmRecord['status'],
  attempts = 0
): FilmRecord {
  return {
    attempts,
    cast: [],
    country: [],
    director: [],
    fetchedAt,
    genres: [],
    key: request.key,
    language: [],
    pageId: null,
    posterUrl: null,
    runtimeMinutes: null,
    status,
    title: request.title,
    wikipediaUrl: null,
    year: request.year
  };
}

function buildRecord(
  key: string,
  film: { title: string; year: number | null },
  details: FilmDetails | null,
  fetchedAt: string,
  attempts = 0
): FilmRecord {
  return {
    attempts,
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

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

export function createFilmIndex({
  catalog,
  concurrency = 2,
  dataDirectory,
  maxAttempts = 2,
  now = () => new Date().toISOString(),
  requestTimeoutMs = 8000,
  retryDelaysMs = [250],
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}: FilmIndexOptions) {
  const filmsFilePath = join(dataDirectory, 'movie-log-films.json');
  let queue = Promise.resolve();
  let activeJob: { controller: AbortController; promise: Promise<boolean> } | null = null;

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

  async function persistRecords(
    records: FilmRecord[],
    onProgress?: EnrichFilmOptions['onProgress']
  ): Promise<Record<string, FilmRecord>> {
    const films = await runSerialized(async () => {
      const current = await readPersistedFilms();

      for (const record of records) {
        current[record.key] = record;
      }

      await writePersistedFilms(current);
      return { ...current };
    });

    await onProgress?.(films);
    return films;
  }

  async function withBoundaryTimeout<T>(
    signal: AbortSignal,
    work: (requestSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (signal.aborted) {
      throw new EnrichmentCancelledError();
    }

    const requestController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let rejectFromCancellation: ((error: Error) => void) | undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectFromCancellation = reject;
    });
    const cancel = () => {
      requestController.abort();
      rejectFromCancellation?.(new EnrichmentCancelledError());
    };
    signal.addEventListener('abort', cancel, { once: true });

    try {
      const timeoutFailure = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          requestController.abort();
          reject(new Error('Catalog request timed out.'));
        }, requestTimeoutMs);
      });
      return await Promise.race([work(requestController.signal), timeoutFailure, cancellation]);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
    }
  }

  async function fetchRecord(
    request: FilmEnrichmentRequest,
    attempt: number,
    signal: AbortSignal
  ): Promise<FilmRecord> {
    const results = await withBoundaryTimeout(signal, (requestSignal) =>
      catalog.searchFilms(`${request.title}${request.year ? ` ${request.year}` : ''} film`, {
        signal: requestSignal
      })
    );
    const match = chooseFilmMatch(results, request);

    if (!match) {
      return buildRecord(request.key, request, null, now(), attempt);
    }

    const details = await withBoundaryTimeout(signal, (requestSignal) =>
      catalog.fetchFilmDetails(match.pageId, { signal: requestSignal })
    );
    return buildRecord(request.key, request, details, now(), attempt);
  }

  async function fetchWithRetry(request: FilmEnrichmentRequest, signal: AbortSignal): Promise<FilmRecord> {
    let latestError: unknown = null;

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
      try {
        return await fetchRecord(request, attempt, signal);
      } catch (error) {
        if (error instanceof EnrichmentCancelledError || signal.aborted) {
          throw new EnrichmentCancelledError();
        }

        latestError = error;

        if (attempt < Math.max(1, maxAttempts)) {
          await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 0);
        }
      }
    }

    void latestError;
    const failedAt = now();
    return {
      ...emptyRecord(request, failedAt, 'failed', Math.max(1, maxAttempts)),
      failureReason: 'temporary',
      nextRetryAt: addMilliseconds(failedAt, retryDelaysMs.at(-1) ?? 1000)
    };
  }

  async function runEnrichment(
    requests: FilmEnrichmentRequest[],
    options: EnrichFilmOptions,
    signal: AbortSignal
  ): Promise<boolean> {
    const known = await runSerialized(readPersistedFilms);
    const uniqueRequests = requests.filter(
      (request, index) => requests.findIndex((candidate) => candidate.key === request.key) === index
    );
    const currentTime = Date.parse(now());
    const pending = uniqueRequests.filter((request) => {
      const record = known[request.key];

      if (!record || record.status === 'pending') {
        return true;
      }

      if (record.status !== 'failed') {
        return false;
      }

      return (
        options.forceRetry === true ||
        !record.nextRetryAt ||
        Number.isNaN(Date.parse(record.nextRetryAt)) ||
        Date.parse(record.nextRetryAt) <= currentTime
      );
    });

    if (pending.length === 0) {
      return false;
    }

    await persistRecords(
      pending.map((request) => emptyRecord(request, now(), 'pending', known[request.key]?.attempts ?? 0)),
      options.onProgress
    );

    let nextIndex = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pending.length)) }, async () => {
      while (!signal.aborted) {
        const request = pending[nextIndex];
        nextIndex += 1;

        if (!request) {
          return;
        }

        try {
          const record = await fetchWithRetry(request, signal);
          await persistRecords([record], options.onProgress);
        } catch (error) {
          if (error instanceof EnrichmentCancelledError) {
            return;
          }

          throw error;
        }
      }
    });

    await Promise.all(workers);
    return true;
  }

  return {
    cancelEnrichment(): void {
      activeJob?.controller.abort();
    },

    async readFilms(): Promise<Record<string, FilmRecord>> {
      return runSerialized(readPersistedFilms);
    },

    async searchFilms(query: string): Promise<CatalogSearchResult[]> {
      const normalizedQuery = query
        .replace(/\s+film\s*$/i, '')
        .trim()
        .toLowerCase();
      const films = Object.values(await runSerialized(readPersistedFilms));

      return films
        .filter(
          (film) =>
            film.status === 'matched' && film.pageId !== null && film.title.toLowerCase().includes(normalizedQuery)
        )
        .sort((left, right) => left.title.localeCompare(right.title))
        .slice(0, 8)
        .map((film) => ({
          description: 'Cached catalog match',
          director: [...film.director],
          pageId: film.pageId as number,
          posterUrl: film.posterUrl,
          title: film.title,
          year: film.year
        }));
    },

    enrichFilms(requests: FilmEnrichmentRequest[], options: EnrichFilmOptions = {}): Promise<boolean> {
      if (activeJob) {
        return activeJob.promise;
      }

      const controller = new AbortController();
      const promise = runEnrichment(requests, options, controller.signal).finally(() => {
        if (activeJob?.promise === promise) {
          activeJob = null;
        }
      });
      activeJob = { controller, promise };
      return promise;
    },

    async matchFilm(
      key: string,
      film: { title: string; year: number | null },
      pageId: number | null
    ): Promise<FilmRecord | null> {
      const controller = new AbortController();
      const cachedPage =
        pageId === null
          ? null
          : (Object.values(await runSerialized(readPersistedFilms)).find(
              (record) => record.status === 'matched' && record.pageId === pageId
            ) ?? null);
      const details = cachedPage
        ? {
            cast: [...cachedPage.cast],
            country: [...cachedPage.country],
            director: [...cachedPage.director],
            genres: [...cachedPage.genres],
            language: [...cachedPage.language],
            pageId: cachedPage.pageId as number,
            posterUrl: cachedPage.posterUrl,
            runtimeMinutes: cachedPage.runtimeMinutes,
            wikipediaUrl: cachedPage.wikipediaUrl,
            year: cachedPage.year
          }
        : pageId === null
          ? null
          : await withBoundaryTimeout(controller.signal, (requestSignal) =>
              catalog.fetchFilmDetails(pageId, { signal: requestSignal })
            );
      const record = buildRecord(key, film, details, now());
      await persistRecords([record]);
      return record;
    }
  };
}

export type FilmIndex = ReturnType<typeof createFilmIndex>;

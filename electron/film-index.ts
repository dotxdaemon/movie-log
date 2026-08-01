// ABOUTME: Caches bounded film catalog work beside the guarded append-only history store.
// ABOUTME: Persists identity-safe matches, durable retry scheduling, and batched enrichment progress across launches.
import { mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chooseFilmMatch, type FilmCatalog } from './film-catalog.js';
import { dossierPosterMinimumWidth } from '../shared/poster-policy.js';
import type { CatalogSearchResult, FilmDetails, FilmRecord } from '../shared/types.js';

export interface FilmEnrichmentRequest {
  key: string;
  mediaType?: 'film' | 'series';
  title: string;
  year: number | null;
}

interface FilmIndexOptions {
  backoffDelaysMs?: number[];
  catalog: FilmCatalog;
  concurrency?: number;
  dataDirectory: string;
  deferDetails?: boolean;
  maxAttempts?: number;
  maxFailureCount?: number;
  maxWorkPerRun?: number;
  now?: () => string;
  persistBatchDelayMs?: number;
  persistBatchSize?: number;
  requestTimeoutMs?: number;
  retryDelaysMs?: number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface EnrichFilmOptions {
  forceRetry?: boolean;
  maxWork?: number;
  onProgress?: (films: Record<string, FilmRecord>) => Promise<void> | void;
}

interface PersistedFilms {
  films: Record<string, FilmRecord>;
}

interface FilmCacheFileHandle {
  close(): Promise<void>;
  sync(): Promise<void>;
  writeFile(contents: string, encoding: BufferEncoding): Promise<void>;
}

interface FilmCacheWriteOperations {
  createDirectory(path: string, options: { recursive: true }): Promise<unknown>;
  openFile(path: string, flags: 'w'): Promise<FilmCacheFileHandle>;
  removeFile(path: string, options: { force: true }): Promise<void>;
  renameFile(source: string, destination: string): Promise<void>;
  temporarySuffix(): string;
}

const defaultFilmCacheWriteOperations: FilmCacheWriteOperations = {
  createDirectory: mkdir,
  openFile: open,
  removeFile: rm,
  renameFile: rename,
  temporarySuffix: () => `${process.pid}-${Date.now()}`
};
const filmCacheTemporaryFilePattern = /^movie-log-films\.json\.tmp-\d+(?:-\d+)?$/;
const staleFilmCacheAgeMs = 24 * 60 * 60_000;

export async function writeFilmCacheAtomically(
  filmsFilePath: string,
  films: Record<string, FilmRecord>,
  operations: FilmCacheWriteOperations = defaultFilmCacheWriteOperations
): Promise<void> {
  await operations.createDirectory(dirname(filmsFilePath), { recursive: true });
  const temporaryPath = `${filmsFilePath}.tmp-${operations.temporarySuffix()}`;
  let fileHandle: FilmCacheFileHandle | null = null;
  let fileHandleClosed = false;

  try {
    fileHandle = await operations.openFile(temporaryPath, 'w');
    await fileHandle.writeFile(`${JSON.stringify({ films }, null, 2)}\n`, 'utf8');
    await fileHandle.sync();
    await fileHandle.close();
    fileHandleClosed = true;
    await operations.renameFile(temporaryPath, filmsFilePath);
  } catch (error) {
    if (fileHandle && !fileHandleClosed) {
      await fileHandle.close().catch(() => undefined);
    }

    await operations.removeFile(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function cleanupStaleFilmCacheFiles(dataDirectory: string, nowMilliseconds = Date.now()): Promise<void> {
  let entries;

  try {
    entries = await readdir(dataDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    throw error;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && filmCacheTemporaryFilePattern.test(entry.name))
      .map(async (entry) => {
        const temporaryPath = join(dataDirectory, entry.name);
        const fileStats = await stat(temporaryPath).catch(() => null);

        if (fileStats && nowMilliseconds - fileStats.mtimeMs >= staleFilmCacheAgeMs) {
          await rm(temporaryPath, { force: true });
        }
      })
  );
}

class EnrichmentCancelledError extends Error {
  constructor() {
    super('Film metadata enrichment was cancelled.');
  }
}

const automaticMatchVersion = 3;
const posterLookupVersion = 3;

function readPosterWidth(source: { posterUrl: string | null; posterWidth?: number }): number | null {
  if (typeof source.posterWidth === 'number' && source.posterWidth > 0) {
    return source.posterWidth;
  }

  const thumbnailWidth = source.posterUrl?.match(/\/(\d+)px-[^/]+$/)?.[1];
  return thumbnailWidth ? Number(thumbnailWidth) : null;
}

function posterNeedsLookup(record: FilmRecord): boolean {
  return record.posterLookupVersion !== posterLookupVersion;
}

function selectPoster(record: FilmRecord, fallback: CatalogSearchResult | null): FilmRecord {
  const currentWidth = readPosterWidth(record);
  const fallbackWidth = fallback ? readPosterWidth(fallback) : null;
  const fallbackVerified = fallback?.posterLookupComplete !== false;
  const shouldUseFallback =
    Boolean(fallback?.posterUrl) &&
    (record.posterUrl === null ||
      (fallbackVerified && fallbackWidth !== null && fallbackWidth >= dossierPosterMinimumWidth) ||
      (fallbackVerified && fallbackWidth !== null && fallbackWidth > (currentWidth ?? 0)));
  const selectedPoster = shouldUseFallback && fallback ? fallback : record;
  const selectedWidth = readPosterWidth(selectedPoster);

  return {
    ...record,
    posterUrl: selectedPoster.posterUrl,
    ...(selectedWidth === null ? {} : { posterWidth: selectedWidth })
  };
}

function emptyRecord(
  request: FilmEnrichmentRequest,
  fetchedAt: string,
  status: FilmRecord['status'],
  previous?: FilmRecord
): FilmRecord {
  return {
    attempts: previous?.attempts ?? 0,
    cast: previous?.cast ?? [],
    catalogId: previous?.catalogId,
    catalogSource: previous?.catalogSource,
    country: previous?.country ?? [],
    detailsComplete: false,
    director: previous?.director ?? [],
    fetchedAt,
    genres: previous?.genres ?? [],
    key: request.key,
    language: previous?.language ?? [],
    matchVersion: previous?.matchVersion,
    mediaType: request.mediaType ?? previous?.mediaType,
    pageId: previous?.pageId ?? null,
    posterFailureCount: previous?.posterFailureCount,
    posterLookupVersion: previous?.posterLookupVersion,
    posterUrl: previous?.posterUrl ?? null,
    posterWidth: previous?.posterWidth,
    runtimeMinutes: previous?.runtimeMinutes ?? null,
    status,
    title: previous?.title ?? request.title,
    wikipediaUrl: previous?.wikipediaUrl ?? null,
    year: previous?.year ?? request.year
  };
}

function buildRecord(
  key: string,
  film: { title: string; year: number | null },
  details: FilmDetails | null,
  fetchedAt: string,
  attempts = 0,
  mediaType?: FilmEnrichmentRequest['mediaType']
): FilmRecord {
  return {
    attempts,
    cast: details?.cast ?? [],
    catalogId: details ? String(details.pageId) : undefined,
    catalogSource: 'wikipedia',
    country: details?.country ?? [],
    detailsComplete: details !== null,
    director: details?.director ?? [],
    fetchedAt,
    genres: details?.genres ?? [],
    key,
    language: details?.language ?? [],
    matchVersion: automaticMatchVersion,
    mediaType,
    pageId: details?.pageId ?? null,
    posterUrl: details?.posterUrl ?? null,
    runtimeMinutes: details?.runtimeMinutes ?? null,
    status: details ? 'matched' : 'unmatched',
    title: film.title,
    wikipediaUrl: details?.wikipediaUrl ?? null,
    year: details?.year ?? film.year
  };
}

function buildAttachedRecord(key: string, film: CatalogSearchResult, fetchedAt: string): FilmRecord {
  return {
    attempts: 0,
    cast: [],
    catalogId: film.catalogId,
    catalogSource: film.catalogSource ?? 'wikipedia',
    country: [],
    detailsComplete: film.catalogSource === 'imdb',
    director: [...(film.director ?? [])],
    fetchedAt,
    genres: [],
    key,
    language: [],
    matchVersion: automaticMatchVersion,
    mediaType: film.mediaType,
    pageId: film.pageId,
    posterLookupVersion:
      film.catalogSource === 'imdb' && (readPosterWidth(film) ?? 0) >= dossierPosterMinimumWidth
        ? posterLookupVersion
        : undefined,
    posterUrl: film.posterUrl,
    posterWidth: film.posterWidth,
    runtimeMinutes: null,
    status: 'matched',
    title: film.title,
    wikipediaUrl: null,
    year: film.year
  };
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

export function createFilmIndex({
  backoffDelaysMs = [
    15 * 60_000,
    60 * 60_000,
    6 * 60 * 60_000,
    24 * 60 * 60_000,
    3 * 24 * 60 * 60_000,
    7 * 24 * 60 * 60_000
  ],
  catalog,
  concurrency = 2,
  dataDirectory,
  deferDetails = false,
  maxAttempts = 2,
  maxFailureCount = 8,
  maxWorkPerRun = 12,
  now = () => new Date().toISOString(),
  persistBatchDelayMs = 50,
  persistBatchSize = 4,
  requestTimeoutMs = 8000,
  retryDelaysMs = [500],
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}: FilmIndexOptions) {
  const filmsFilePath = join(dataDirectory, 'movie-log-films.json');
  let queue = Promise.resolve();
  let activeJob: { controller: AbortController; forceRetry: boolean; promise: Promise<boolean> } | null = null;

  function settlePosterLookup(
    record: FilmRecord,
    fallback: CatalogSearchResult | null,
    previous: FilmRecord | undefined = record
  ): FilmRecord {
    const selected = selectPoster(record, fallback);
    const selectedWidth = readPosterWidth(selected);
    const fallbackVerified = Boolean(fallback?.posterUrl) && fallback?.posterLookupComplete !== false;

    if (fallbackVerified && selectedWidth !== null && selectedWidth >= dossierPosterMinimumWidth) {
      return {
        ...selected,
        nextRetryAt: undefined,
        posterFailureCount: undefined,
        posterLookupVersion
      };
    }

    const previousFailureCount = previous?.posterLookupVersion === undefined ? (previous?.posterFailureCount ?? 0) : 0;
    const posterFailureCount = previousFailureCount + 1;
    const terminal = posterFailureCount >= Math.max(1, maxFailureCount);
    const delay = backoffDelaysMs[Math.min(posterFailureCount - 1, backoffDelaysMs.length - 1)] ?? 7 * 24 * 60 * 60_000;
    const failedAt = now();

    return {
      ...selected,
      nextRetryAt: terminal ? undefined : addMilliseconds(failedAt, delay),
      posterFailureCount,
      posterLookupVersion: terminal ? posterLookupVersion : undefined
    };
  }

  function runSerialized<T>(work: () => Promise<T>): Promise<T> {
    const task = queue.catch(() => undefined).then(work);
    queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  async function readPersistedFilms(): Promise<Record<string, FilmRecord>> {
    await cleanupStaleFilmCacheFiles(dataDirectory);

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
    await writeFilmCacheAtomically(filmsFilePath, films);
  }

  async function persistRecords(
    records: FilmRecord[],
    onProgress?: EnrichFilmOptions['onProgress']
  ): Promise<Record<string, FilmRecord>> {
    if (records.length === 0) {
      return runSerialized(readPersistedFilms);
    }

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
    previous: FilmRecord | undefined,
    attempt: number,
    signal: AbortSignal
  ): Promise<FilmRecord> {
    const totalAttempts = (previous?.attempts ?? 0) + attempt;
    const mediaQualifier = request.mediaType === 'series' ? 'TV series' : 'film';
    const query = `${request.title}${request.year ? ` ${request.year}` : ''} ${mediaQualifier}`;
    const canReusePreviousIdentity =
      previous?.status === 'matched' &&
      previous.pageId !== null &&
      previous.matchVersion === automaticMatchVersion &&
      (previous.mediaType === undefined || previous.mediaType === request.mediaType);
    const needsPosterLookup = Boolean(
      canReusePreviousIdentity && catalog.searchPosterFallback && posterNeedsLookup(previous)
    );

    if (canReusePreviousIdentity && (previous.detailsComplete === false || needsPosterLookup)) {
      let record =
        previous.detailsComplete === false
          ? await withBoundaryTimeout(signal, async (requestSignal) => {
              const details = await catalog.fetchFilmDetails(previous.pageId as number, { signal: requestSignal });

              if (!details) {
                throw new Error('Catalog details are temporarily unavailable.');
              }

              return buildRecord(request.key, previous, details, now(), totalAttempts, request.mediaType);
            })
          : { ...previous, attempts: totalAttempts, fetchedAt: now() };

      if (previous.posterLookupVersion === posterLookupVersion) {
        record = {
          ...record,
          nextRetryAt: undefined,
          posterFailureCount: previous.posterFailureCount,
          posterLookupVersion
        };
      } else if (catalog.searchPosterFallback) {
        try {
          const fallbackResults = await withBoundaryTimeout(
            signal,
            (requestSignal) =>
              catalog.searchPosterFallback?.(query, { includeCredits: false, signal: requestSignal }) ??
              Promise.resolve([])
          );
          record = settlePosterLookup(record, chooseFilmMatch(fallbackResults, request), previous);
        } catch (error) {
          if (error instanceof EnrichmentCancelledError || signal.aborted) {
            throw error;
          }

          record = settlePosterLookup(record, null, previous);
        }
      }

      return record;
    }

    let results: CatalogSearchResult[] = [];
    let primaryFailed = false;

    try {
      results = await withBoundaryTimeout(signal, (requestSignal) =>
        catalog.searchFilms(query, { includeCredits: false, signal: requestSignal })
      );
    } catch (error) {
      if (!catalog.searchPosterFallback) {
        throw error;
      }

      primaryFailed = true;
    }

    let match = chooseFilmMatch(results, request);
    let fallbackMatch: CatalogSearchResult | null = null;
    let fallbackLookupComplete = !catalog.searchPosterFallback;

    if (catalog.searchPosterFallback) {
      try {
        const fallbackResults = await withBoundaryTimeout(
          signal,
          (requestSignal) =>
            catalog.searchPosterFallback?.(query, { includeCredits: false, signal: requestSignal }) ??
            Promise.resolve([])
        );
        fallbackMatch = chooseFilmMatch(fallbackResults, request);
        fallbackLookupComplete = true;
      } catch (error) {
        if (!match || error instanceof EnrichmentCancelledError || signal.aborted) {
          throw error;
        }
      }

      if (!match && fallbackMatch?.posterUrl) {
        match = fallbackMatch;
      }
    }

    if (!match) {
      return buildRecord(request.key, request, null, now(), totalAttempts, request.mediaType);
    }

    const finishPosterLookup = (record: FilmRecord): FilmRecord =>
      !catalog.searchPosterFallback
        ? record
        : settlePosterLookup(record, fallbackLookupComplete ? fallbackMatch : null);

    if (match.catalogSource === 'imdb') {
      return finishPosterLookup({
        ...buildAttachedRecord(request.key, match, now()),
        attempts: totalAttempts,
        detailsComplete: true,
        mediaType: request.mediaType
      });
    }

    if (deferDetails || primaryFailed) {
      return finishPosterLookup({
        ...buildAttachedRecord(request.key, match, now()),
        attempts: totalAttempts,
        mediaType: request.mediaType
      });
    }

    const details = await withBoundaryTimeout(signal, (requestSignal) =>
      catalog.fetchFilmDetails(match.pageId, { signal: requestSignal })
    );

    if (!details) {
      throw new Error('Catalog details are temporarily unavailable.');
    }

    return finishPosterLookup(buildRecord(request.key, request, details, now(), totalAttempts, request.mediaType));
  }

  function buildFailureRecord(
    request: FilmEnrichmentRequest,
    previous: FilmRecord | undefined,
    attemptsThisRun: number
  ): FilmRecord {
    const failedAt = now();
    const failureCount = (previous?.failureCount ?? 0) + 1;
    const attempts = (previous?.attempts ?? 0) + attemptsThisRun;
    const delay = backoffDelaysMs[Math.min(failureCount - 1, backoffDelaysMs.length - 1)] ?? 7 * 24 * 60 * 60_000;
    const preserveMatch = previous?.status === 'matched' && previous.pageId !== null;
    const status: FilmRecord['status'] = preserveMatch
      ? 'matched'
      : failureCount >= maxFailureCount
        ? 'failed'
        : 'retry-scheduled';

    return {
      ...emptyRecord(request, failedAt, status, previous),
      attempts,
      detailsComplete: preserveMatch ? false : undefined,
      failureCount,
      failureReason: 'temporary',
      nextRetryAt: failureCount >= maxFailureCount && !preserveMatch ? undefined : addMilliseconds(failedAt, delay)
    };
  }

  async function fetchWithRetry(
    request: FilmEnrichmentRequest,
    previous: FilmRecord | undefined,
    signal: AbortSignal
  ): Promise<FilmRecord> {
    const attemptsThisRun = Math.max(1, maxAttempts);

    for (let attempt = 1; attempt <= attemptsThisRun; attempt += 1) {
      try {
        return await fetchRecord(request, previous, attempt, signal);
      } catch (error) {
        if (error instanceof EnrichmentCancelledError || signal.aborted) {
          throw new EnrichmentCancelledError();
        }

        if (attempt < attemptsThisRun) {
          await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 0);
        }
      }
    }

    return buildFailureRecord(request, previous, attemptsThisRun);
  }

  function shouldProcessRecord(record: FilmRecord | undefined, forceRetry: boolean, currentTime: number): boolean {
    if (!record || record.status === 'pending') {
      return true;
    }

    if (record.status === 'unmatched' && record.matchVersion === automaticMatchVersion && !forceRetry) {
      return false;
    }

    if (record.status === 'failed') {
      return forceRetry;
    }

    const staleAutomaticMatch =
      (record.status === 'matched' || record.status === 'unmatched') && record.matchVersion !== automaticMatchVersion;
    const incompleteMatch = record.status === 'matched' && record.detailsComplete === false;
    const missingPoster = record.status === 'matched' && record.posterUrl === null;
    const pendingPosterLookup =
      record.status === 'matched' && Boolean(catalog.searchPosterFallback) && posterNeedsLookup(record);
    const forcedUnmatched = record.status === 'unmatched' && forceRetry;

    if (
      record.status !== 'retry-scheduled' &&
      !incompleteMatch &&
      !missingPoster &&
      !pendingPosterLookup &&
      !forcedUnmatched &&
      !staleAutomaticMatch
    ) {
      return false;
    }

    return (
      forceRetry ||
      !record.nextRetryAt ||
      Number.isNaN(Date.parse(record.nextRetryAt)) ||
      Date.parse(record.nextRetryAt) <= currentTime
    );
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
    const readPriority = (record: FilmRecord | undefined): number => {
      if (
        !record ||
        record.status === 'pending' ||
        ((record.status === 'matched' || record.status === 'unmatched') &&
          record.matchVersion !== automaticMatchVersion)
      ) {
        return 0;
      }

      if (record.status === 'matched' && record.detailsComplete === false) {
        return 1;
      }

      if (record.status === 'matched' && catalog.searchPosterFallback && posterNeedsLookup(record)) {
        return 2;
      }

      return record.status === 'retry-scheduled' ? 3 : 4;
    };
    const pending = uniqueRequests
      .map((request, index) => ({ index, priority: readPriority(known[request.key]), request }))
      .filter(({ request }) => shouldProcessRecord(known[request.key], options.forceRetry === true, currentTime))
      .sort((left, right) => left.priority - right.priority || left.index - right.index)
      .slice(0, Math.max(1, options.maxWork ?? maxWorkPerRun));
    const pendingRequests = pending.map(({ request }) => request);

    if (pendingRequests.length === 0) {
      return false;
    }

    const previousByKey = new Map(pendingRequests.map((request) => [request.key, known[request.key]]));
    const pendingRecords = pendingRequests.map((request) => {
      const previous = known[request.key];

      if (previous?.status === 'matched') {
        return { ...previous, fetchedAt: now(), nextRetryAt: undefined };
      }

      return emptyRecord(request, now(), 'pending', previous);
    });
    await persistRecords(pendingRecords, options.onProgress);

    let nextIndex = 0;
    const resultBuffer: FilmRecord[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let flushChain = Promise.resolve();

    const flushResults = (): Promise<void> => {
      clearTimeout(flushTimer);
      flushTimer = undefined;
      const batch = resultBuffer.splice(0, Math.max(1, persistBatchSize));

      if (batch.length === 0) {
        return flushChain;
      }

      flushChain = flushChain.then(async () => {
        await persistRecords(batch, options.onProgress);
      });
      return flushChain;
    };

    const queueResult = (record: FilmRecord): Promise<void> => {
      resultBuffer.push(record);

      if (resultBuffer.length >= Math.max(1, persistBatchSize)) {
        return flushResults();
      }

      if (!flushTimer) {
        flushTimer = setTimeout(
          () => {
            void flushResults();
          },
          Math.max(0, persistBatchDelayMs)
        );
      }

      return Promise.resolve();
    };

    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pendingRequests.length)) }, async () => {
      while (!signal.aborted) {
        const request = pendingRequests[nextIndex];
        nextIndex += 1;

        if (!request) {
          return;
        }

        try {
          const record = await fetchWithRetry(request, previousByKey.get(request.key), signal);
          await queueResult(record);
        } catch (error) {
          if (error instanceof EnrichmentCancelledError) {
            return;
          }

          throw error;
        }
      }
    });

    await Promise.all(workers);
    await flushResults();
    await flushChain;
    return true;
  }

  function startEnrichment(requests: FilmEnrichmentRequest[], options: EnrichFilmOptions): Promise<boolean> {
    const controller = new AbortController();
    const promise = runEnrichment(requests, options, controller.signal).finally(() => {
      if (activeJob?.promise === promise) {
        activeJob = null;
      }
    });
    activeJob = { controller, forceRetry: options.forceRetry === true, promise };
    return promise;
  }

  return {
    async attachFilm(key: string, film: CatalogSearchResult): Promise<FilmRecord> {
      const record = buildAttachedRecord(key, film, now());
      await persistRecords([record]);
      return record;
    },

    cancelEnrichment(): void {
      activeJob?.controller.abort();
    },

    async readFilms(): Promise<Record<string, FilmRecord>> {
      return runSerialized(readPersistedFilms);
    },

    async searchFilms(query: string): Promise<CatalogSearchResult[]> {
      const normalizedQuery = query
        .replace(/\s+(?:film|TV series)\s*$/i, '')
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
          catalogId: film.catalogId,
          catalogSource: film.catalogSource,
          mediaType: film.mediaType,
          pageId: film.pageId as number,
          posterLookupComplete:
            film.posterLookupVersion === posterLookupVersion &&
            (readPosterWidth(film) ?? 0) >= dossierPosterMinimumWidth,
          posterUrl: film.posterUrl,
          ...(film.posterWidth === undefined ? {} : { posterWidth: film.posterWidth }),
          title: film.title,
          year: film.year
        }));
    },

    enrichFilms(requests: FilmEnrichmentRequest[], options: EnrichFilmOptions = {}): Promise<boolean> {
      if (!activeJob) {
        return startEnrichment(requests, options);
      }

      if (!options.forceRetry || activeJob.forceRetry) {
        return activeJob.promise;
      }

      const currentJob = activeJob;
      currentJob.controller.abort();
      return currentJob.promise.then(() => startEnrichment(requests, options));
    },

    async matchFilm(
      key: string,
      film: { title: string; year: number | null },
      selection: CatalogSearchResult | null
    ): Promise<FilmRecord | null> {
      if (selection?.catalogSource === 'imdb') {
        const record = settlePosterLookup(buildAttachedRecord(key, selection, now()), selection);
        await persistRecords([record]);
        return record;
      }

      const pageId = selection?.pageId ?? null;
      const controller = new AbortController();
      const cachedPage =
        pageId === null
          ? null
          : (Object.values(await runSerialized(readPersistedFilms)).find(
              (record) => record.status === 'matched' && record.pageId === pageId && record.detailsComplete !== false
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

      if (pageId !== null && !details) {
        throw new Error('Catalog details are temporarily unavailable.');
      }

      const record = buildRecord(key, film, details, now(), 0, selection?.mediaType ?? cachedPage?.mediaType);
      await persistRecords([record]);
      return record;
    }
  };
}

export type FilmIndex = ReturnType<typeof createFilmIndex>;

// ABOUTME: Builds the filterable film archive, search lanes, and viewing statistics from persisted state.
// ABOUTME: Joins diary history and watched-folder contents with cached catalog metadata for every view.
import { isFilmSourcePath, parseFilmTitle, readEpisodeCode, readFilmKey } from '../shared/film-title.js';
import {
  createLocalCalendarDate,
  readLocalCalendarDateKey,
  readLocalCalendarMonthKey,
  readLocalCalendarParts,
  readLocalCalendarYear
} from '../shared/local-calendar.js';
import { readCatalogResultKey } from './catalog-result.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { CatalogSearchResult, FilmRecord, MovieLogState, WatchEntry } from '../shared/types.js';

export type ArchiveView = 'diary' | 'library' | 'search' | 'statistics' | 'settings' | 'detail';
export type DiaryMode = 'timeline' | 'ledger' | 'grid';

export interface ArchiveFilters {
  decade: string;
  favorite: string;
  genre: string;
  mediaType: string;
  rating: string;
  rewatch: string;
  sort: string;
  status: string;
  tag: string;
}

export interface ArchiveItem {
  current: boolean;
  displayTitle: string;
  episodeCode: string | null;
  favorite: boolean;
  film: FilmRecord | null;
  filmKey: string;
  filmRecordKeys: string[];
  latestViewing: WatchEntry;
  localSourcePaths: string[];
  mediaType: MediaType;
  rating: number | null;
  reviewed: boolean;
  rewatched: boolean;
  sourceKind: WatchEntry['sourceKind'];
  sourcePath: string;
  sourcePaths: string[];
  tags: string[];
  title: string;
  viewingFormat: string;
  viewings: WatchEntry[];
  year: number | null;
}

export interface SearchResultItem {
  catalogId?: string;
  catalogSource?: 'imdb' | 'wikipedia';
  director: string[];
  key: string;
  kind: 'diary' | 'library' | 'catalog';
  mediaType: MediaType;
  pageId: number | null;
  posterLookupComplete?: boolean;
  posterUrl: string | null;
  posterWidth?: number;
  sourcePath: string | null;
  status: string;
  title: string;
  year: number | null;
}

export interface SearchGroups {
  catalog: SearchResultItem[];
  diary: SearchResultItem[];
  flat: SearchResultItem[];
  library: SearchResultItem[];
}

export interface ArchiveStats {
  activity: Array<{
    count: number;
    date: string;
    week: number;
    weekday: number;
  }>;
  averageRating: number | null;
  decades: Array<{
    averageRating: number | null;
    count: number;
    label: string;
  }>;
  directors: Array<{ count: number; name: string }>;
  favorites: number;
  filmViewings: number;
  genres: Array<{ count: number; name: string }>;
  months: Array<{ count: number; key: string; label: string }>;
  ratings: Array<{ count: number; value: number }>;
  rewatches: number;
  seriesEpisodes: number;
  runtimeKnownCount: number;
  tags: Array<{ count: number; name: string }>;
  totalRuntimeMinutes: number;
  totalViewings: number;
  unknownViewings: number;
  years: Array<{ count: number; year: number }>;
}

export type MediaType = 'film' | 'series' | 'unknown';

export interface ArchiveCoverage {
  annotated: number;
  failed: number;
  matched: number;
  pending: number;
  retryScheduled: number;
  total: number;
  unmatched: number;
}

export const defaultArchiveFilters: ArchiveFilters = {
  decade: 'all',
  favorite: 'all',
  genre: 'all',
  mediaType: 'all',
  rating: 'all',
  rewatch: 'all',
  sort: 'recent',
  status: 'all',
  tag: 'all'
};

export function readEntryMediaType(entry: WatchEntry, films: MovieLogState['films']): MediaType {
  if (readEpisodeCode(entry.title)) {
    return 'series';
  }

  const film = readEntryFilm(entry, films);

  if (film?.mediaType) {
    return film.mediaType;
  }

  if (film?.status === 'matched' || isFilmSourcePath(entry.sourcePath)) {
    return 'film';
  }

  return 'unknown';
}

export function readMediaTypeLabel(item: Pick<ArchiveItem, 'episodeCode' | 'mediaType'>): string {
  if (item.mediaType === 'series') {
    return item.episodeCode ? `Series · ${item.episodeCode}` : 'Series';
  }

  return item.mediaType === 'film' ? 'Film' : 'Unknown media';
}

export const ratingFilterOptions = [
  { label: 'Any', value: 'all' },
  { label: '4.5+', value: '4.5-plus' },
  { label: '4.0+', value: '4-plus' },
  { label: '3.0+', value: '3-plus' },
  { label: '2.0+', value: '2-plus' },
  { label: 'Unrated', value: 'unrated' }
];

export function readEntryFilm(entry: WatchEntry, films: MovieLogState['films']): FilmRecord | null {
  return films?.[readFilmKey(parseFilmTitle(entry.title))] ?? null;
}

export function sumRuntime(
  entries: WatchEntry[],
  films: MovieLogState['films']
): { knownCount: number; minutes: number } {
  let minutes = 0;
  let knownCount = 0;

  for (const entry of entries) {
    const runtime = readEntryFilm(entry, films)?.runtimeMinutes;

    if (typeof runtime === 'number') {
      minutes += runtime;
      knownCount += 1;
    }
  }

  return { knownCount, minutes };
}

export function formatRuntime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function readLatestValue<T>(viewings: WatchEntry[], readValue: (entry: WatchEntry) => T | undefined): T | undefined {
  for (const viewing of viewings) {
    const value = readValue(viewing);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function isDiaryViewing(entry: WatchEntry): boolean {
  return !entry.id.startsWith('library:');
}

export function buildArchiveItems(state: MovieLogState): ArchiveItem[] {
  const currentPaths = new Set(state.libraryItems.map((item) => item.sourcePath));
  const viewingsByPath = new Map<string, WatchEntry[]>();

  for (const entry of state.history) {
    if (!isTrackableMediaItem(entry.sourcePath, entry.sourceKind)) {
      continue;
    }

    const viewings = viewingsByPath.get(entry.sourcePath) ?? [];
    viewings.push(entry);
    viewingsByPath.set(entry.sourcePath, viewings);
  }

  for (const item of state.libraryItems) {
    if (viewingsByPath.has(item.sourcePath)) {
      continue;
    }

    viewingsByPath.set(item.sourcePath, [
      {
        id: `library:${item.id}`,
        source: 'watch',
        sourceKind: item.sourceKind,
        sourcePath: item.sourcePath,
        title: item.title,
        watchedAt: item.firstSeenAt
      }
    ]);
  }

  const sources = [...viewingsByPath.entries()].map(([sourcePath, entries]) => {
    const viewings = [...entries].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
    const latestViewing = viewings[0] as WatchEntry;
    const parsed = parseFilmTitle(latestViewing.title);
    const filmRecordKey = readFilmKey(parsed);
    const film = state.films?.[filmRecordKey] ?? null;
    const baseFilmKey =
      film?.status === 'matched' ? readFilmKey({ title: film.title, year: film.year }) : filmRecordKey;
    const episodeCode = readEpisodeCode(latestViewing.title);
    const filmKey = episodeCode ? `${baseFilmKey}::${episodeCode.toLowerCase()}` : baseFilmKey;

    return {
      current: currentPaths.has(sourcePath),
      film,
      filmKey,
      filmRecordKey,
      latestViewing,
      sourcePath,
      viewings
    };
  });
  const sourcesByFilm = new Map<string, typeof sources>();

  for (const source of sources) {
    const groupedSources = sourcesByFilm.get(source.filmKey) ?? [];
    groupedSources.push(source);
    sourcesByFilm.set(source.filmKey, groupedSources);
  }

  return [...sourcesByFilm.entries()]
    .map(([filmKey, groupedSources]) => {
      const sortedSources = [...groupedSources].sort((left, right) =>
        right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt)
      );
      const sourceEntries = sortedSources
        .flatMap((source) => source.viewings)
        .sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
      const viewings = sourceEntries.filter(isDiaryViewing);
      const identityEntries = viewings.length > 0 ? viewings : sourceEntries;
      const latestViewing = (viewings[0] ?? sourceEntries[0]) as WatchEntry;
      const parsed = parseFilmTitle(latestViewing.title);
      const film =
        sortedSources.find((source) => source.film?.status === 'matched')?.film ??
        sortedSources.find((source) => source.film)?.film ??
        null;
      const sourcePaths = sortedSources.map((source) => source.sourcePath);
      const episodeCode = identityEntries.map((entry) => readEpisodeCode(entry.title)).find(Boolean) ?? null;
      const mediaTypes = identityEntries.map((entry) => readEntryMediaType(entry, state.films));
      const mediaType: MediaType = mediaTypes.includes('series')
        ? 'series'
        : mediaTypes.includes('film')
          ? 'film'
          : 'unknown';

      return {
        current: sortedSources.some((source) => source.current),
        displayTitle: film?.status === 'matched' ? film.title : parsed.title,
        episodeCode,
        favorite: readLatestValue(viewings, (entry) => entry.favorite) ?? false,
        film,
        filmKey,
        filmRecordKeys: [...new Set(sortedSources.map((source) => source.filmRecordKey))],
        latestViewing,
        localSourcePaths: sourcePaths.filter((sourcePath) => !isFilmSourcePath(sourcePath)),
        mediaType,
        rating: readLatestValue(viewings, (entry) => entry.rating) ?? null,
        reviewed: viewings.some((entry) => Boolean(entry.review?.trim())),
        rewatched: viewings.length > 1 || viewings.some((entry) => Boolean(entry.rewatch)),
        sourceKind: latestViewing.sourceKind,
        sourcePath: latestViewing.sourcePath,
        sourcePaths,
        tags: readLatestValue(viewings, (entry) => entry.tags) ?? [],
        title: latestViewing.title,
        viewingFormat: readLatestValue(viewings, (entry) => entry.viewingFormat) ?? '',
        viewings,
        year: film?.year ?? parsed.year
      };
    })
    .sort((left, right) => right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt));
}

export function readArchiveCoverageForItems(archiveItems: ArchiveItem[]): ArchiveCoverage {
  const itemsByFilm = new Map<string, ArchiveItem>();

  for (const item of archiveItems) {
    if (!itemsByFilm.has(item.filmKey)) {
      itemsByFilm.set(item.filmKey, item);
    }
  }

  const items = [...itemsByFilm.values()];
  const countStatus = (status: NonNullable<ArchiveItem['film']>['status']) =>
    items.filter((item) => item.film?.status === status).length;
  const annotated = items.filter((item) =>
    item.viewings.some(
      (entry) =>
        typeof entry.rating === 'number' ||
        Boolean(entry.review?.trim()) ||
        Boolean(entry.castNotes?.trim()) ||
        Boolean(entry.favorite) ||
        Boolean(entry.rewatch) ||
        Boolean(entry.tags?.length) ||
        Boolean(entry.viewingFormat?.trim()) ||
        Boolean(entry.location?.trim())
    )
  ).length;
  const matched = countStatus('matched');
  const unmatched = countStatus('unmatched');
  const failed = countStatus('failed');
  const retryScheduled = countStatus('retry-scheduled');
  const pending = countStatus('pending') + items.filter((item) => item.film === null).length;

  return {
    annotated,
    failed,
    matched,
    pending,
    retryScheduled,
    total: items.length,
    unmatched
  };
}

export function readArchiveCoverage(state: MovieLogState): ArchiveCoverage {
  return readArchiveCoverageForItems(buildArchiveItems(state));
}

function matchesRatingFilter(rating: number | null, filter: string): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'unrated') {
    return rating === null;
  }

  const threshold = Number(filter.replace('-plus', ''));
  return rating !== null && rating >= threshold;
}

export function filterArchiveItems(items: ArchiveItem[], filters: ArchiveFilters): ArchiveItem[] {
  const filtered = items.filter((item) => {
    const decade = item.year === null ? null : `${Math.floor(item.year / 10) * 10}s`;

    return (
      (filters.decade === 'all' || decade === filters.decade) &&
      (filters.favorite === 'all' || (filters.favorite === 'favorite') === item.favorite) &&
      (filters.genre === 'all' || (item.film?.genres ?? []).includes(filters.genre)) &&
      (filters.mediaType === 'all' || item.mediaType === filters.mediaType) &&
      matchesRatingFilter(item.rating, filters.rating) &&
      (filters.rewatch === 'all' || (filters.rewatch === 'rewatched') === item.rewatched) &&
      (filters.status === 'all' || (filters.status === 'current') === item.current) &&
      (filters.tag === 'all' || item.tags.includes(filters.tag))
    );
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === 'title') {
      return left.displayTitle.localeCompare(right.displayTitle);
    }

    if (filters.sort === 'rating') {
      return (right.rating ?? -1) - (left.rating ?? -1) || left.displayTitle.localeCompare(right.displayTitle);
    }

    if (filters.sort === 'year') {
      return (right.year ?? -1) - (left.year ?? -1) || left.displayTitle.localeCompare(right.displayTitle);
    }

    return right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt);
  });
}

const watchedDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function buildSearchResults(
  state: MovieLogState,
  query: string,
  catalogResults: CatalogSearchResult[],
  archiveItems = buildArchiveItems(state)
): SearchGroups {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return { catalog: [], diary: [], flat: [], library: [] };
  }

  const queryTerms = normalizedQuery.split(' ');
  const items = archiveItems;
  const matches = (item: ArchiveItem): boolean => {
    const film = item.film;
    const viewingText = item.viewings.flatMap((entry) => [
      entry.castNotes,
      entry.location,
      entry.review,
      entry.tags?.join(' '),
      entry.viewingFormat
    ]);
    const haystack = normalizeSearchText(
      [
        item.displayTitle,
        item.title,
        item.year,
        item.sourcePaths.join(' '),
        item.tags.join(' '),
        film?.title,
        film?.director.join(' '),
        film?.cast.join(' '),
        film?.genres.join(' '),
        film?.country.join(' '),
        film?.language.join(' '),
        ...viewingText
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
    );

    return queryTerms.every((term) => haystack.includes(term));
  };
  const toResult = (item: ArchiveItem, kind: 'diary' | 'library'): SearchResultItem => ({
    catalogId: item.film?.catalogId,
    catalogSource: item.film?.catalogSource,
    director: [...(item.film?.director ?? [])],
    key: `${kind}:${item.sourcePath}`,
    kind,
    pageId: item.film?.pageId ?? null,
    posterUrl: item.film?.posterUrl ?? null,
    sourcePath: item.sourcePath,
    status:
      kind === 'diary'
        ? `${readMediaTypeLabel(item)} · Watched ${watchedDateFormatter.format(new Date(item.latestViewing.watchedAt))}`
        : item.current
          ? `${readMediaTypeLabel(item)} · Indexed`
          : `${readMediaTypeLabel(item)} · Archived`,
    title: item.displayTitle,
    mediaType: item.mediaType,
    year: item.year
  });

  const diaryItems = items.filter((item) => item.viewings.length > 0 && matches(item));
  const libraryItems = items.filter((item) => item.current && item.viewings.length === 0 && matches(item));
  const localKeys = new Set(items.filter(matches).map((item) => item.filmKey));
  const catalog = catalogResults
    .filter((result) => !localKeys.has(readFilmKey({ title: result.title, year: result.year })))
    .map((result): SearchResultItem => {
      const mediaType =
        result.mediaType ?? (/\b(?:series|episode|television|tv)\b/i.test(result.description) ? 'series' : 'film');

      return {
        catalogId: result.catalogId,
        catalogSource: result.catalogSource,
        director: [...(result.director ?? [])],
        key: `catalog:${readCatalogResultKey(result)}`,
        kind: 'catalog',
        mediaType,
        pageId: result.pageId,
        posterLookupComplete: result.posterLookupComplete,
        posterUrl: result.posterUrl,
        posterWidth: result.posterWidth,
        sourcePath: null,
        status: `${mediaType === 'series' ? 'Series' : 'Film'} · ${result.description || 'Catalog match'}`,
        title: result.title,
        year: result.year
      };
    });

  const diary = diaryItems.map((item) => toResult(item, 'diary'));
  const library = libraryItems.map((item) => toResult(item, 'library'));

  return {
    catalog,
    diary,
    flat: [...diary, ...library, ...catalog],
    library
  };
}

export function readArchiveStats(state: MovieLogState, now = new Date()): ArchiveStats {
  const ratings = new Map<number, number>();
  const tags = new Map<string, number>();
  const months = new Map<string, number>();
  const days = new Map<string, number>();
  const genres = new Map<string, number>();
  const directors = new Map<string, number>();
  const years = new Map<number, number>();
  const decadeCounts = new Map<string, { count: number; ratingTotal: number; ratedCount: number }>();
  const ratedEntries = state.history.filter((entry) => typeof entry.rating === 'number');
  const runtime = sumRuntime(state.history, state.films);
  const mediaCounts = state.history.reduce(
    (counts, entry) => {
      counts[readEntryMediaType(entry, state.films)] += 1;
      return counts;
    },
    { film: 0, series: 0, unknown: 0 } as Record<MediaType, number>
  );

  for (const entry of state.history) {
    const month = readLocalCalendarMonthKey(entry.watchedAt);
    const day = readLocalCalendarDateKey(entry.watchedAt);
    const watchedYear = readLocalCalendarYear(entry.watchedAt);
    months.set(month, (months.get(month) ?? 0) + 1);
    days.set(day, (days.get(day) ?? 0) + 1);
    years.set(watchedYear, (years.get(watchedYear) ?? 0) + 1);

    if (typeof entry.rating === 'number') {
      ratings.set(entry.rating, (ratings.get(entry.rating) ?? 0) + 1);
    }

    for (const tag of entry.tags ?? []) {
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }

    const film = readEntryFilm(entry, state.films);

    for (const genre of film?.genres ?? []) {
      genres.set(genre, (genres.get(genre) ?? 0) + 1);
    }

    for (const director of film?.director ?? []) {
      directors.set(director, (directors.get(director) ?? 0) + 1);
    }

    const filmYear = film?.year ?? parseFilmTitle(entry.title).year;

    if (entry.favorite && filmYear !== null) {
      const label = `${Math.floor(filmYear / 10) * 10}s`;
      const decade = decadeCounts.get(label) ?? {
        count: 0,
        ratingTotal: 0,
        ratedCount: 0
      };
      decade.count += 1;

      if (typeof entry.rating === 'number') {
        decade.ratingTotal += entry.rating;
        decade.ratedCount += 1;
      }

      decadeCounts.set(label, decade);
    }
  }

  const today = readLocalCalendarParts(now);
  const activityStart = new Date(today.year, today.month - 1, today.day - 364, 12);
  const firstWeekday = activityStart.getDay();
  const activity = Array.from({ length: 365 }, (_value, index) => {
    const date = new Date(activityStart.getFullYear(), activityStart.getMonth(), activityStart.getDate() + index, 12);
    const dateKey = readLocalCalendarDateKey(date);
    const weekday = date.getDay();
    return {
      count: days.get(dateKey) ?? 0,
      date: dateKey,
      week: Math.floor((firstWeekday + index) / 7),
      weekday
    };
  });

  const sortByCount = <T extends { count: number; name: string }>(entries: T[]): T[] =>
    entries.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    activity,
    averageRating:
      ratedEntries.length === 0
        ? null
        : ratedEntries.reduce((total, entry) => total + (entry.rating ?? 0), 0) / ratedEntries.length,
    decades: [...decadeCounts.entries()]
      .map(([label, decade]) => ({
        averageRating: decade.ratedCount === 0 ? null : decade.ratingTotal / decade.ratedCount,
        count: decade.count,
        label
      }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          (right.averageRating ?? -1) - (left.averageRating ?? -1) ||
          left.label.localeCompare(right.label)
      ),
    directors: sortByCount([...directors.entries()].map(([name, count]) => ({ count, name }))),
    favorites: state.history.filter((entry) => entry.favorite).length,
    filmViewings: mediaCounts.film,
    genres: sortByCount([...genres.entries()].map(([name, count]) => ({ count, name }))),
    months: [...months.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => ({
        count,
        key,
        label: new Intl.DateTimeFormat(undefined, {
          month: 'short',
          year: 'numeric'
        }).format(createLocalCalendarDate(`${key}-01`))
      })),
    ratings: [...ratings.entries()].sort(([left], [right]) => left - right).map(([value, count]) => ({ count, value })),
    rewatches: state.history.filter((entry) => entry.rewatch).length,
    seriesEpisodes: mediaCounts.series,
    runtimeKnownCount: runtime.knownCount,
    tags: sortByCount([...tags.entries()].map(([name, count]) => ({ count, name }))),
    totalRuntimeMinutes: runtime.minutes,
    totalViewings: state.history.length,
    unknownViewings: mediaCounts.unknown,
    years: [...years.entries()].sort(([left], [right]) => left - right).map(([year, count]) => ({ count, year }))
  };
}

// ABOUTME: Builds the filterable film archive, search lanes, and viewing statistics from persisted state.
// ABOUTME: Joins diary history and watched-folder contents with cached catalog metadata for every view.
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import type { CatalogSearchResult, FilmRecord, MovieLogState, WatchEntry } from '../shared/types.js';

export type ArchiveView = 'diary' | 'library' | 'search' | 'statistics' | 'settings' | 'detail';
export type DiaryMode = 'timeline' | 'ledger' | 'grid';

export interface ArchiveFilters {
  decade: string;
  favorite: string;
  genre: string;
  rating: string;
  rewatch: string;
  sort: string;
  status: string;
  tag: string;
}

export interface ArchiveItem {
  current: boolean;
  displayTitle: string;
  favorite: boolean;
  film: FilmRecord | null;
  filmKey: string;
  latestViewing: WatchEntry;
  rating: number | null;
  reviewed: boolean;
  rewatched: boolean;
  sourceKind: WatchEntry['sourceKind'];
  sourcePath: string;
  tags: string[];
  title: string;
  viewingFormat: string;
  viewings: WatchEntry[];
  year: number | null;
}

export interface SearchResultItem {
  director: string | null;
  key: string;
  kind: 'diary' | 'library' | 'catalog';
  pageId: number | null;
  posterUrl: string | null;
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
  activity: Array<{ count: number; date: string }>;
  averageRating: number | null;
  decades: Array<{ averageRating: number | null; count: number; label: string }>;
  directors: Array<{ count: number; name: string }>;
  favorites: number;
  genres: Array<{ count: number; name: string }>;
  months: Array<{ count: number; key: string; label: string }>;
  ratings: Array<{ count: number; value: number }>;
  rewatches: number;
  runtimeKnownCount: number;
  tags: Array<{ count: number; name: string }>;
  totalRuntimeMinutes: number;
  totalViewings: number;
  years: Array<{ count: number; year: number }>;
}

export const defaultArchiveFilters: ArchiveFilters = {
  decade: 'all',
  favorite: 'all',
  genre: 'all',
  rating: 'all',
  rewatch: 'all',
  sort: 'recent',
  status: 'all',
  tag: 'all'
};

export const ratingFilterOptions = [
  { label: 'Any rating', value: 'all' },
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

export function buildArchiveItems(state: MovieLogState): ArchiveItem[] {
  const currentPaths = new Set(state.libraryItems.map((item) => item.sourcePath));
  const viewingsByPath = new Map<string, WatchEntry[]>();

  for (const entry of state.history) {
    const viewings = viewingsByPath.get(entry.sourcePath) ?? [];
    viewings.push(entry);
    viewingsByPath.set(entry.sourcePath, viewings);
  }

  for (const item of state.libraryItems) {
    if (viewingsByPath.has(item.sourcePath)) {
      continue;
    }

    viewingsByPath.set(item.sourcePath, [{
      id: `library:${item.id}`,
      source: 'watch',
      sourceKind: item.sourceKind,
      sourcePath: item.sourcePath,
      title: item.title,
      watchedAt: item.firstSeenAt
    }]);
  }

  return [...viewingsByPath.entries()]
    .map(([sourcePath, entries]) => {
      const viewings = [...entries].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
      const latestViewing = viewings[0] as WatchEntry;
      const parsed = parseFilmTitle(latestViewing.title);
      const filmKey = readFilmKey(parsed);
      const film = state.films?.[filmKey] ?? null;

      return {
        current: currentPaths.has(sourcePath),
        displayTitle: film?.status === 'matched' ? film.title : parsed.title,
        favorite: readLatestValue(viewings, (entry) => entry.favorite) ?? false,
        film,
        filmKey,
        latestViewing,
        rating: readLatestValue(viewings, (entry) => entry.rating) ?? null,
        reviewed: viewings.some((entry) => Boolean(entry.review?.trim())),
        rewatched: viewings.length > 1 || viewings.some((entry) => Boolean(entry.rewatch)),
        sourceKind: latestViewing.sourceKind,
        sourcePath,
        tags: readLatestValue(viewings, (entry) => entry.tags) ?? [],
        title: latestViewing.title,
        viewingFormat: readLatestValue(viewings, (entry) => entry.viewingFormat) ?? '',
        viewings,
        year: film?.year ?? parsed.year
      };
    })
    .sort((left, right) => right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt));
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

    return (filters.decade === 'all' || decade === filters.decade) &&
      (filters.favorite === 'all' || (filters.favorite === 'favorite') === item.favorite) &&
      (filters.genre === 'all' || (item.film?.genres ?? []).includes(filters.genre)) &&
      matchesRatingFilter(item.rating, filters.rating) &&
      (filters.rewatch === 'all' || (filters.rewatch === 'rewatched') === item.rewatched) &&
      (filters.status === 'all' || (filters.status === 'current') === item.current) &&
      (filters.tag === 'all' || item.tags.includes(filters.tag));
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

const watchedDateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

export function buildSearchResults(
  state: MovieLogState,
  query: string,
  catalogResults: CatalogSearchResult[]
): SearchGroups {
  const normalizedQuery = query.trim().toLowerCase();
  const items = buildArchiveItems(state);
  const matches = (item: ArchiveItem): boolean => {
    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${item.displayTitle} ${item.title} ${item.sourcePath} ${(item.tags ?? []).join(' ')}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  };
  const toResult = (item: ArchiveItem, kind: 'diary' | 'library'): SearchResultItem => ({
    director: item.film?.director[0] ?? null,
    key: `${kind}:${item.sourcePath}`,
    kind,
    pageId: item.film?.pageId ?? null,
    posterUrl: item.film?.posterUrl ?? null,
    sourcePath: item.sourcePath,
    status:
      kind === 'diary'
        ? `Watched ${watchedDateFormatter.format(new Date(item.latestViewing.watchedAt))}`
        : item.current
          ? 'Indexed'
          : 'Archived',
    title: item.displayTitle,
    year: item.year
  });

  const diaryItems = items.filter((item) => !item.latestViewing.id.startsWith('library:') && matches(item));
  const libraryItems = items.filter((item) => item.current && matches(item));
  const localKeys = new Set(items.filter(matches).map((item) => item.filmKey));
  const catalog = catalogResults
    .filter((result) => !localKeys.has(readFilmKey({ title: result.title, year: result.year })))
    .map((result): SearchResultItem => ({
      director: null,
      key: `catalog:${result.pageId}`,
      kind: 'catalog',
      pageId: result.pageId,
      posterUrl: result.posterUrl,
      sourcePath: null,
      status: result.description || 'Catalog match',
      title: result.title,
      year: result.year
    }));

  const diary = diaryItems.map((item) => toResult(item, 'diary'));
  const library = libraryItems.map((item) => toResult(item, 'library'));

  return {
    catalog,
    diary,
    flat: [...diary, ...library, ...catalog],
    library
  };
}

function readDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  for (const entry of state.history) {
    const month = entry.watchedAt.slice(0, 7);
    const day = entry.watchedAt.slice(0, 10);
    const watchedYear = Number(entry.watchedAt.slice(0, 4));
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

    if (filmYear !== null) {
      const label = `${Math.floor(filmYear / 10) * 10}s`;
      const decade = decadeCounts.get(label) ?? { count: 0, ratingTotal: 0, ratedCount: 0 };
      decade.count += 1;

      if (typeof entry.rating === 'number') {
        decade.ratingTotal += entry.rating;
        decade.ratedCount += 1;
      }

      decadeCounts.set(label, decade);
    }
  }

  const activity = Array.from({ length: 365 }, (_value, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (364 - index)));
    const dateKey = readDateKey(date);
    return { count: days.get(dateKey) ?? 0, date: dateKey };
  });

  const sortByCount = <T extends { count: number; name: string }>(entries: T[]): T[] =>
    entries.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return {
    activity,
    averageRating: ratedEntries.length === 0
      ? null
      : ratedEntries.reduce((total, entry) => total + (entry.rating ?? 0), 0) / ratedEntries.length,
    decades: [...decadeCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, decade]) => ({
        averageRating: decade.ratedCount === 0 ? null : decade.ratingTotal / decade.ratedCount,
        count: decade.count,
        label
      })),
    directors: sortByCount([...directors.entries()].map(([name, count]) => ({ count, name }))),
    favorites: state.history.filter((entry) => entry.favorite).length,
    genres: sortByCount([...genres.entries()].map(([name, count]) => ({ count, name }))),
    months: [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => ({
      count,
      key,
      label: new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00.000Z`))
    })),
    ratings: [...ratings.entries()].sort(([left], [right]) => left - right).map(([value, count]) => ({ count, value })),
    rewatches: state.history.filter((entry) => entry.rewatch).length,
    runtimeKnownCount: runtime.knownCount,
    tags: sortByCount([...tags.entries()].map(([name, count]) => ({ count, name }))),
    totalRuntimeMinutes: runtime.minutes,
    totalViewings: state.history.length,
    years: [...years.entries()].sort(([left], [right]) => left - right).map(([year, count]) => ({ count, year }))
  };
}

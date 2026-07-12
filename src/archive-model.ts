// ABOUTME: Builds the filterable archive and viewing statistics from persisted Movie Log state.
// ABOUTME: Keeps every product view grounded in real history and watched-folder contents.
import type { MovieLogState, WatchEntry } from '../shared/types.js';

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
  favorite: boolean;
  latestViewing: WatchEntry;
  rating: number | null;
  sourceKind: WatchEntry['sourceKind'];
  sourcePath: string;
  tags: string[];
  title: string;
  viewingFormat: string;
  viewings: WatchEntry[];
  year: number | null;
}

export interface ArchiveStats {
  activity: Array<{ count: number; date: string }>;
  averageRating: number | null;
  favorites: number;
  months: Array<{ count: number; key: string; label: string }>;
  ratings: Array<{ count: number; value: number }>;
  rewatches: number;
  tags: Array<{ count: number; name: string }>;
  totalViewings: number;
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

function readYear(title: string): number | null {
  const matches = [...title.matchAll(/(?:^|[^0-9])((?:19|20)\d{2})(?=$|[^0-9])/g)];
  const value = matches.at(-1)?.[1];
  return value ? Number(value) : null;
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

      return {
        current: currentPaths.has(sourcePath),
        favorite: readLatestValue(viewings, (entry) => entry.favorite) ?? false,
        latestViewing,
        rating: readLatestValue(viewings, (entry) => entry.rating) ?? null,
        sourceKind: latestViewing.sourceKind,
        sourcePath,
        tags: readLatestValue(viewings, (entry) => entry.tags) ?? [],
        title: latestViewing.title,
        viewingFormat: readLatestValue(viewings, (entry) => entry.viewingFormat) ?? '',
        viewings,
        year: readYear(latestViewing.title)
      };
    })
    .sort((left, right) => right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt));
}

export function filterArchiveItems(items: ArchiveItem[], filters: ArchiveFilters): ArchiveItem[] {
  const filtered = items.filter((item) => {
    const decade = item.year === null ? null : `${Math.floor(item.year / 10) * 10}s`;

    return (filters.decade === 'all' || decade === filters.decade) &&
      (filters.favorite === 'all' || (filters.favorite === 'favorite') === item.favorite) &&
      (filters.genre === 'all' || item.tags.includes(filters.genre)) &&
      (filters.rating === 'all' || (filters.rating === '4-plus' && (item.rating ?? 0) >= 4)) &&
      (filters.rewatch === 'all' || (filters.rewatch === 'rewatched') === (item.viewings.length > 1 || item.viewings.some((entry) => entry.rewatch))) &&
      (filters.status === 'all' || (filters.status === 'current') === item.current) &&
      (filters.tag === 'all' || item.tags.includes(filters.tag));
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === 'title') {
      return left.title.localeCompare(right.title);
    }

    if (filters.sort === 'rating') {
      return (right.rating ?? -1) - (left.rating ?? -1) || left.title.localeCompare(right.title);
    }

    return right.latestViewing.watchedAt.localeCompare(left.latestViewing.watchedAt);
  });
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
  const ratedEntries = state.history.filter((entry) => typeof entry.rating === 'number');

  for (const entry of state.history) {
    const month = entry.watchedAt.slice(0, 7);
    const day = entry.watchedAt.slice(0, 10);
    months.set(month, (months.get(month) ?? 0) + 1);
    days.set(day, (days.get(day) ?? 0) + 1);

    if (typeof entry.rating === 'number') {
      ratings.set(entry.rating, (ratings.get(entry.rating) ?? 0) + 1);
    }

    for (const tag of entry.tags ?? []) {
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
  }

  const activity = Array.from({ length: 84 }, (_value, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (83 - index)));
    const dateKey = readDateKey(date);
    return { count: days.get(dateKey) ?? 0, date: dateKey };
  });

  return {
    activity,
    averageRating: ratedEntries.length === 0
      ? null
      : ratedEntries.reduce((total, entry) => total + (entry.rating ?? 0), 0) / ratedEntries.length,
    favorites: state.history.filter((entry) => entry.favorite).length,
    months: [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => ({
      count,
      key,
      label: new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00.000Z`))
    })),
    ratings: [...ratings.entries()].sort(([left], [right]) => left - right).map(([value, count]) => ({ count, value })),
    rewatches: state.history.filter((entry) => entry.rewatch).length,
    tags: [...tags.entries()].map(([name, count]) => ({ count, name })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    totalViewings: state.history.length
  };
}

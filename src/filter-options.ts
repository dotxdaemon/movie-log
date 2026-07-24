// ABOUTME: Derives stable Library filter options from the complete archive.
// ABOUTME: Keeps data preparation outside the Fast Refresh component module.
import type { ArchiveItem } from './archive-model.js';
import type { FilterOptions } from './components/filters.js';

export function buildFilterOptions(items: ArchiveItem[]): FilterOptions {
  return {
    decades: [
      ...new Set(
        items.map((item) => (item.year === null ? null : `${Math.floor(item.year / 10) * 10}s`)).filter(Boolean)
      )
    ].sort() as string[],
    genres: [...new Set(items.flatMap((item) => item.film?.genres ?? []))].sort(),
    tags: [...new Set(items.flatMap((item) => item.tags))].sort()
  };
}

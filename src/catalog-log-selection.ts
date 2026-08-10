// ABOUTME: Converts global catalog search rows into the richer logging-sheet selection contract.
// ABOUTME: Preserves provider identity, credits, and poster-quality metadata for catalog-only viewings.
import type { CatalogSearchResult } from '../shared/types.js';
import type { ArchiveItem, SearchResultItem } from './archive-model.js';

export function createCatalogLogSelection(result: SearchResultItem): CatalogSearchResult {
  return {
    catalogId: result.catalogId,
    catalogSource: result.catalogSource,
    description: result.status,
    director: result.director.length > 0 ? [...result.director] : undefined,
    mediaType: result.mediaType === 'unknown' ? undefined : result.mediaType,
    pageId: result.pageId ?? 0,
    posterLookupComplete: result.posterLookupComplete,
    posterUrl: result.posterUrl,
    posterWidth: result.posterWidth,
    title: result.title,
    year: result.year
  };
}

export function createArchiveLogSelection(
  item: Pick<ArchiveItem, 'current' | 'film' | 'mediaType'>
): CatalogSearchResult | null {
  const film = item.film;

  if (!film || film.status !== 'matched' || film.pageId === null) {
    return null;
  }

  return {
    catalogId: film.catalogId,
    catalogSource: film.catalogSource,
    description: item.current ? 'From your Library' : 'From your viewing history',
    director: film.director.length > 0 ? [...film.director] : undefined,
    mediaType: film.mediaType ?? (item.mediaType === 'unknown' ? undefined : item.mediaType),
    pageId: film.pageId,
    posterUrl: film.posterUrl,
    posterWidth: film.posterWidth,
    title: film.title,
    year: film.year
  };
}

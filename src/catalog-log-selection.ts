// ABOUTME: Converts global catalog search rows into the richer logging-sheet selection contract.
// ABOUTME: Preserves provider identity, credits, and poster-quality metadata for catalog-only diary entries.
import type { CatalogSearchResult } from '../shared/types.js';
import type { SearchResultItem } from './archive-model.js';

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

// ABOUTME: Creates stable catalog row keys from provider identity plus human-readable fallback data.
// ABOUTME: Avoids React key collisions when catalogs reuse numeric page identifiers.
import type { CatalogSource } from '../shared/types.js';

interface CatalogResultIdentity {
  catalogId?: string;
  catalogSource?: CatalogSource;
  pageId: number | null;
  title: string;
  year: number | null;
}

export function readCatalogResultKey(result: CatalogResultIdentity): string {
  const source = result.catalogSource ?? 'legacy';
  const identity = result.catalogId?.trim().toLowerCase() || (result.pageId === null ? 'none' : String(result.pageId));
  const title = result.title.trim().toLowerCase().replace(/\s+/g, ' ');

  return `${source}:${identity}:${title}:${result.year ?? 'unknown'}`;
}

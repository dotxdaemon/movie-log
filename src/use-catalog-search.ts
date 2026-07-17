// ABOUTME: Debounces live catalog lookups and converts transport failures into safe renderer-facing copy.
// ABOUTME: Keeps search cancellation and pending state consistent across global search and the log sheet.
import { useEffect, useState } from 'react';
import type { CatalogSearchResult } from '../shared/types.js';
import { readCatalogFailureMessage } from './catalog-search.js';

export function useCatalogSearch(
  query: string,
  enabled: boolean
): { error: string | null; pending: boolean; results: CatalogSearchResult[] } {
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const active = enabled && trimmed.length >= 2;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        if (!active) {
          setError(null);
          setResults([]);
          setPending(false);
          return;
        }

        setPending(true);
        setError(null);
        window.movieLog
          .searchCatalog(`${trimmed} film`)
          .then((nextResults) => {
            if (!cancelled) {
              setResults(nextResults);
            }
          })
          .catch((catalogError: unknown) => {
            if (!cancelled) {
              setResults([]);
              setError(readCatalogFailureMessage(catalogError));
            }
          })
          .finally(() => {
            if (!cancelled) {
              setPending(false);
            }
          });
      },
      active ? 300 : 0
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, query]);

  return { error, pending, results };
}

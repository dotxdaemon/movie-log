// ABOUTME: Coordinates bounded background catalog enrichment independently from Electron window and IPC setup.
// ABOUTME: Collects stable film identities and lets an explicit retry replace lower-priority startup work.
import { parseFilmTitle, readCatalogMediaType, readFilmKey } from '../shared/film-title.js';
import type { MovieLogState } from '../shared/types.js';
import type { FilmEnrichmentRequest, FilmIndex } from './film-index.js';

export function collectFilmRequests(state: MovieLogState): FilmEnrichmentRequest[] {
  const requests = new Map<string, FilmEnrichmentRequest>();
  const titles = [...state.history.map((entry) => entry.title), ...state.libraryItems.map((item) => item.title)];

  for (const stem of titles) {
    if (stem.startsWith('.')) {
      continue;
    }

    const parsed = parseFilmTitle(stem);
    const mediaType = readCatalogMediaType(stem);

    if (!parsed.title || (mediaType === 'series' && /^S\d{1,2}E\d{1,3}\b/i.test(parsed.title))) {
      continue;
    }

    const key = readFilmKey(parsed);

    if (!requests.has(key)) {
      requests.set(key, { key, mediaType, title: parsed.title, year: parsed.year });
    }
  }

  return [...requests.values()];
}

interface CatalogOrchestratorOptions {
  broadcastState: () => Promise<void>;
  filmIndex: FilmIndex;
  readSourceState: () => Promise<MovieLogState>;
}

export function createCatalogOrchestrator({ broadcastState, filmIndex, readSourceState }: CatalogOrchestratorOptions) {
  async function enrich(forceRetry = false): Promise<void> {
    try {
      const state = await readSourceState();
      await filmIndex.enrichFilms(collectFilmRequests(state), {
        forceRetry,
        maxWork: forceRetry ? 48 : undefined,
        onProgress: broadcastState
      });
    } catch (error) {
      console.error('Film metadata enrichment stopped unexpectedly.', error);
    }
  }

  return {
    cancel: filmIndex.cancelEnrichment,
    enrich,
    retry: () => enrich(true)
  };
}

export type CatalogOrchestrator = ReturnType<typeof createCatalogOrchestrator>;

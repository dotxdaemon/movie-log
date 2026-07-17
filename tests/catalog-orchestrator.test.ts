// ABOUTME: Verifies stable catalog identity collection and force-retry coordination outside Electron lifecycle code.
// ABOUTME: Prevents startup work from swallowing a deliberate user retry or fragmenting episodic titles.
import { describe, expect, it, vi } from 'vitest';
import type { MovieLogState } from '../shared/types.js';
import { collectFilmRequests, createCatalogOrchestrator } from '../electron/catalog-orchestrator.js';
import type { FilmIndex } from '../electron/film-index.js';

const state: MovieLogState = {
  films: {},
  history: [
    {
      id: 'one',
      source: 'drop',
      sourceKind: 'file',
      sourcePath: '/Movies/Alien.3.1992.DC.mkv',
      title: 'Alien.3.1992.DC',
      watchedAt: '2026-07-16T00:00:00.000Z'
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-07-16T00:00:00.000Z',
      folderId: 'shows',
      folderPath: '/Shows',
      id: 'two',
      lastSeenAt: '2026-07-16T00:00:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Shows/PONIES.S01E02.2026.mkv',
      title: 'PONIES.S01E02.2026'
    }
  ],
  watchedFolders: []
};

describe('catalog orchestrator', () => {
  it('collects one stable request per film or series identity', () => {
    expect(collectFilmRequests(state)).toEqual([
      { key: 'alien 3::1992', mediaType: 'film', title: 'Alien 3', year: 1992 },
      { key: 'ponies::', mediaType: 'series', title: 'PONIES', year: null }
    ]);
  });

  it('starts a force retry while lower-priority coordination is still awaiting startup work', async () => {
    let finishStartup: (() => void) | undefined;
    const startup = new Promise<boolean>((resolve) => {
      finishStartup = () => resolve(true);
    });
    const enrichFilms = vi
      .fn()
      .mockImplementationOnce(() => startup)
      .mockResolvedValueOnce(true);
    const orchestrator = createCatalogOrchestrator({
      broadcastState: vi.fn(),
      filmIndex: { cancelEnrichment: vi.fn(), enrichFilms } as unknown as FilmIndex,
      readSourceState: async () => state
    });

    const startupJob = orchestrator.enrich();
    await Promise.resolve();
    const retryJob = orchestrator.retry();
    await Promise.resolve();

    expect(enrichFilms).toHaveBeenCalledTimes(2);
    expect(enrichFilms.mock.calls[1]?.[1]).toMatchObject({ forceRetry: true, maxWork: 48 });
    finishStartup?.();
    await Promise.all([startupJob, retryJob]);
  });
});

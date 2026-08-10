// ABOUTME: Owns installed-app capture profiles, interaction replay, and fail-closed screenshot validation.
// ABOUTME: Keeps proof-only automation outside the production Electron lifecycle and IPC entrypoint.
import { clipboard, type BrowserWindow } from 'electron';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { dossierPosterMinimumWidth } from '../shared/poster-policy.js';
import type { FilmRecord, MovieLogState, WatchEntry } from '../shared/types.js';
import {
  assertAbsolutePathOutsideApplicationSupport,
  captureSnapshotMarkerName,
  readProductionApplicationSupportDirectory,
  validateCaptureRuntimePaths
} from './capture-data-safety.js';

interface CaptureControllerOptions {
  dataDirectory: string;
  historyStore: { readState(): Promise<MovieLogState> };
  quitApp(): void;
  readState(): Promise<MovieLogState>;
}

export type CaptureDataMode = 'real' | 'scratch';

const captureMobileNavigationBreakpoint = 700;
const captureCompactFilterBreakpoint = 1024;
const captureInceptionEnglishPosterUrl =
  'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg';

export function resolveCaptureDataMode(captureRequested: boolean, value: string | undefined): CaptureDataMode | null {
  if (!captureRequested) {
    return null;
  }

  if (value === 'real' || value === 'scratch') {
    return value;
  }

  throw new Error('Installed captures require MOVIE_LOG_CAPTURE_DATA_MODE=real or scratch.');
}

export function assertCaptureWritable(dataMode: CaptureDataMode | null, operation: string): void {
  if (dataMode === 'real') {
    throw new Error(
      `Capture operation "${operation}" requires MOVIE_LOG_CAPTURE_DATA_MODE=scratch; real-data captures are read-only.`
    );
  }
}

export function isFrameOccluded(bitmap: Buffer, width: number, height: number): boolean {
  if (bitmap.length < width * height * 4 || width <= 0 || height <= 0) {
    return true;
  }

  const startX = Math.floor(width * 0.18);
  const step = Math.max(2, Math.floor(Math.min(width, height) / 160));
  let sampled = 0;
  let black = 0;
  let topSampled = 0;
  let topBlack = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = startX; x < width; x += step) {
      const offset = (y * width + x) * 4;
      const blue = bitmap[offset] ?? 0;
      const green = bitmap[offset + 1] ?? 0;
      const red = bitmap[offset + 2] ?? 0;
      const alpha = bitmap[offset + 3] ?? 0;
      const nearBlack = alpha < 245 || (red < 30 && green < 30 && blue < 30);
      sampled += 1;
      black += nearBlack ? 1 : 0;

      if (y < height * 0.18) {
        topSampled += 1;
        topBlack += nearBlack ? 1 : 0;
      }
    }
  }

  return black / Math.max(1, sampled) > 0.6 || topBlack / Math.max(1, topSampled) > 0.15;
}

export function createCaptureController({ dataDirectory, historyStore, quitApp, readState }: CaptureControllerOptions) {
  let mainWindow: BrowserWindow | null = null;
  const captureRequested = process.env.MOVIE_LOG_CAPTURE_PATH !== undefined;
  const captureDataMode = resolveCaptureDataMode(captureRequested, process.env.MOVIE_LOG_CAPTURE_DATA_MODE);
  const runtimePaths = validateCaptureRuntimePaths({
    captureDataMode,
    capturePath: process.env.MOVIE_LOG_CAPTURE_PATH,
    dataDirectory,
    persistenceProofPath: process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH,
    snapshotDirectory: process.env[captureSnapshotMarkerName]
  });
  const captureOutputPath = runtimePaths.capturePath;
  const persistenceProofPath = runtimePaths.persistenceProofPath;
  const captureWidth = Number(process.env.MOVIE_LOG_CAPTURE_WIDTH ?? 1180);
  const captureHeight = Number(process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? 788);
  const captureRequestedView = process.env.MOVIE_LOG_CAPTURE_VIEW ?? 'library';
  const watchedFolderOverride =
    captureRequestedView === 'watched-folder-flow'
      ? assertAbsolutePathOutsideApplicationSupport(
          process.env.MOVIE_LOG_CAPTURE_WATCHED_FOLDER,
          readProductionApplicationSupportDirectory(),
          'Capture watched folder'
        )
      : null;
  const dropPathOverrides = (() => {
    if (captureRequestedView !== 'drag-drop-flow') {
      return [];
    }

    let values: unknown;

    try {
      values = JSON.parse(process.env.MOVIE_LOG_CAPTURE_DROP_PATHS ?? '[]');
    } catch (error) {
      throw new Error('Capture drop paths must be a JSON array of isolated absolute paths.', { cause: error });
    }

    if (!Array.isArray(values) || values.length < 2 || values.some((value) => typeof value !== 'string')) {
      throw new Error('Capture drop paths must include supported and unsupported absolute paths.');
    }

    return values.map((value) =>
      assertAbsolutePathOutsideApplicationSupport(
        value,
        readProductionApplicationSupportDirectory(),
        'Capture drop path'
      )
    );
  })();
  const persistenceProof = {
    castNotes: 'Installed persistence proof cast notes',
    favorite: true,
    location: 'Home archive',
    rating: 4,
    review: 'Installed persistence proof · 2026-07-16',
    rewatch: true,
    tags: ['proof', 'archive'],
    viewingFormat: 'Digital file'
  } as const;
  const persistenceEditProof = {
    castNotes: 'Installed edited cast notes',
    favorite: true,
    location: 'Edited home archive',
    rating: 4.5,
    review: 'Installed edit persistence proof · 2026-07-16',
    rewatch: true,
    tags: ['proof', 'edited'],
    viewingFormat: 'Edited digital file'
  } as const;
  const captureViews = new Set([
    'aggregation-verify',
    'diary',
    'diary-ledger',
    'diary-grid',
    'empty-archive',
    'library',
    'library-filtered',
    'library-empty',
    'library-selected',
    'filters',
    'search',
    'search-results',
    'search-long',
    'catalog',
    'catalog-outage',
    'statistics',
    'statistics-lower',
    'settings',
    'detail',
    'detail-delete-confirmation',
    'detail-editor',
    'detail-imdb-match',
    'detail-missing',
    'detail-outage',
    'drag-drop-flow',
    'log',
    'log-selected',
    'log-ambiguity',
    'log-path-match',
    'log-multiple-paths',
    'log-rating-none',
    'log-rating-numeric',
    'metadata-retry',
    'loading',
    'load-error',
    'persistence-save',
    'persistence-verify',
    'persistence-edit',
    'persistence-edit-verify',
    'persistence-delete',
    'persistence-date-edit',
    'accessibility-audit',
    'layout-stability',
    'performance-history-large',
    'performance-large',
    'performance',
    'poster-performance',
    'poster-locale',
    'retry-backoff-verify',
    'slow-catalog',
    'watched-folder-flow'
  ]);

  if (
    captureRequested &&
    (!Number.isInteger(captureWidth) || !Number.isInteger(captureHeight) || captureWidth < 320 || captureHeight < 640)
  ) {
    throw new Error(
      `Capture dimensions must be whole numbers at least 320x640. Received ${captureWidth}x${captureHeight}.`
    );
  }

  if (captureRequested && !captureViews.has(captureRequestedView)) {
    throw new Error(`Unknown capture view: ${captureRequestedView}.`);
  }

  function entryMatchesPersistenceProof(entry: WatchEntry | undefined): boolean {
    return Boolean(
      entry &&
      entry.castNotes === persistenceProof.castNotes &&
      entry.favorite === persistenceProof.favorite &&
      entry.location === persistenceProof.location &&
      entry.rating === persistenceProof.rating &&
      entry.review === persistenceProof.review &&
      entry.rewatch === persistenceProof.rewatch &&
      JSON.stringify(entry.tags) === JSON.stringify(persistenceProof.tags) &&
      entry.viewingFormat === persistenceProof.viewingFormat
    );
  }

  function entryMatchesPersistenceEditProof(entry: WatchEntry | undefined): boolean {
    return Boolean(
      entry &&
      entry.castNotes === persistenceEditProof.castNotes &&
      entry.favorite === persistenceEditProof.favorite &&
      entry.location === persistenceEditProof.location &&
      entry.rating === persistenceEditProof.rating &&
      entry.review === persistenceEditProof.review &&
      entry.rewatch === persistenceEditProof.rewatch &&
      JSON.stringify(entry.tags) === JSON.stringify(persistenceEditProof.tags) &&
      entry.viewingFormat === persistenceEditProof.viewingFormat
    );
  }

  async function measureThrottledPosterResource(): Promise<{
    decodeMilliseconds: number;
    durationMilliseconds: number;
    geometryShift: number;
    layoutShift: number;
    naturalWidth: number;
    url: string;
  }> {
    if (!mainWindow) {
      throw new Error('Installed poster throttle could not find the capture window.');
    }

    const debugTarget = mainWindow.webContents.debugger;

    try {
      debugTarget.attach('1.3');
      await debugTarget.sendCommand('Network.enable');
      await debugTarget.sendCommand('Network.setCacheDisabled', { cacheDisabled: true });
      await debugTarget.sendCommand('Network.emulateNetworkConditions', {
        connectionType: 'cellular3g',
        downloadThroughput: 1024 * 1024,
        latency: 400,
        offline: false,
        uploadThroughput: 512 * 1024
      });

      return (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const sourceImage = [...document.querySelectorAll('img.poster-art')].find((image) =>
            /m\\.media-amazon\\.com|upload\\.wikimedia\\.org/.test(image.currentSrc || image.src)
          );

          if (!sourceImage) {
            throw new Error('The installed Library did not expose a remote poster for throttled proof.');
          }

          const source = new URL(sourceImage.currentSrc || sourceImage.src);
          source.searchParams.set('movieLogThrottleProof', String(Date.now()));
          const proofUrl = source.toString();
          const before = sourceImage.closest('.film-poster')?.getBoundingClientRect();
          let layoutShift = 0;
          const shiftObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) layoutShift += entry.value;
            }
          });
          shiftObserver.observe({ type: 'layout-shift', buffered: false });
          performance.clearResourceTimings();
          const loaded = await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('The throttled poster proof did not settle within 10 seconds.')),
              10_000
            );
            sourceImage.addEventListener(
              'load',
              () => {
                clearTimeout(timeout);
                resolve(true);
              },
              { once: true }
            );
            sourceImage.addEventListener(
              'error',
              () => {
                clearTimeout(timeout);
                reject(new Error('The throttled poster proof failed to decode its remote image.'));
              },
              { once: true }
            );
            sourceImage.removeAttribute('srcset');
            sourceImage.removeAttribute('sizes');
            sourceImage.loading = 'eager';
            sourceImage.src = proofUrl;
          });

          if (!loaded || sourceImage.naturalWidth === 0) {
            throw new Error('The throttled poster proof did not decode a real remote poster.');
          }
          const decodeStartedAt = performance.now();
          await sourceImage.decode();
          const decodeMilliseconds = performance.now() - decodeStartedAt;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          shiftObserver.disconnect();
          const after = sourceImage.closest('.film-poster')?.getBoundingClientRect();
          const geometryShift =
            before && after
              ? Math.max(
                  Math.abs(before.width - after.width),
                  Math.abs(before.height - after.height),
                  Math.abs(before.left - after.left),
                  Math.abs(before.top - after.top)
                )
              : Number.POSITIVE_INFINITY;

          const resource = performance
            .getEntriesByName(proofUrl, 'resource')
            .findLast((entry) => entry.name === proofUrl);

          return {
            decodeMilliseconds,
            durationMilliseconds: resource?.duration ?? 0,
            geometryShift,
            layoutShift,
            naturalWidth: sourceImage.naturalWidth,
            url: proofUrl
          };
        })()
      `)) as {
        decodeMilliseconds: number;
        durationMilliseconds: number;
        geometryShift: number;
        layoutShift: number;
        naturalWidth: number;
        url: string;
      };
    } catch (error) {
      throw new Error(`Could not complete the installed poster slow-network profile: ${String(error)}`, {
        cause: error
      });
    } finally {
      if (debugTarget.isAttached()) {
        debugTarget.detach();
      }
    }
  }

  async function selectCaptureView(): Promise<void> {
    if (!mainWindow) {
      return;
    }

    const logActionSelector =
      captureWidth <= captureMobileNavigationBreakpoint ? '.header-log-action' : '.archive-spine .log-action';
    const initialRawHistoryCount = (await historyStore.readState()).history.length;
    const navigationSelector = captureWidth <= captureMobileNavigationBreakpoint ? '.mobile-nav-item' : '.nav-item';
    const selected = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const requestedView = ${JSON.stringify(captureRequestedView)};
        const logActionSelector = ${JSON.stringify(logActionSelector)};
        const navigationSelector = ${JSON.stringify(navigationSelector)};
        const readLabel = (element) =>
          (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase();
        const navigationItems = [...document.querySelectorAll(navigationSelector)];

        if (
          requestedView === 'performance' ||
          requestedView === 'accessibility-audit' ||
          requestedView === 'layout-stability' ||
          requestedView === 'performance-history-large' ||
          requestedView === 'drag-drop-flow'
        ) {
          return true;
        }

        if (
          requestedView === 'log' ||
          requestedView === 'log-selected' ||
          requestedView === 'log-ambiguity' ||
          requestedView === 'log-path-match' ||
          requestedView === 'log-multiple-paths' ||
          requestedView === 'log-rating-none' ||
          requestedView === 'log-rating-numeric' ||
          requestedView === 'persistence-save'
        ) {
          const action = document.querySelector(logActionSelector);
          action?.focus();
          action?.click();
          return true;
        }

        if (
          requestedView === 'catalog' ||
          requestedView === 'catalog-outage' ||
          requestedView === 'slow-catalog' ||
          requestedView === 'search-results' ||
          requestedView === 'search-long'
        ) {
          const searchItem = navigationItems.find((item) => readLabel(item).includes('search'));
          searchItem?.focus();
          searchItem?.click();
          return true;
        }

        if (
          requestedView === 'detail' ||
          requestedView === 'detail-delete-confirmation' ||
          requestedView === 'detail-editor' ||
          requestedView === 'detail-imdb-match' ||
          requestedView === 'detail-missing' ||
          requestedView === 'detail-outage' ||
          requestedView === 'filters' ||
          requestedView.startsWith('library') ||
          requestedView === 'performance-large' ||
          requestedView === 'poster-performance' ||
          requestedView === 'persistence-edit' ||
          requestedView === 'persistence-delete' ||
          requestedView === 'persistence-date-edit' ||
          requestedView === 'aggregation-verify'
        ) {
          navigationItems.find((item) => readLabel(item).includes('library'))?.click();
          return true;
        }

        if (!requestedView.startsWith('diary')) {
          const navigationView = requestedView.startsWith('statistics')
            ? 'statistics'
            : requestedView === 'watched-folder-flow'
              ? 'settings'
              : requestedView;
          navigationItems.find((item) => readLabel(item).includes(navigationView))?.click();
        }

        return true;
      })()
    `)) as boolean;

    if (!selected) {
      throw new Error(`Capture view did not render: ${captureRequestedView}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 180));

    if (captureRequestedView === 'performance') {
      const measurements = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const readLabel = (element) =>
            (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase();
          const navigationItems = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})];
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const timings = [];

          for (const label of ['library', 'search', 'statistics', 'settings']) {
            const target = navigationItems.find((item) => readLabel(item).includes(label));
            const startedAt = performance.now();
            target?.click();
            await settlePaint();
            timings.push({ label, milliseconds: performance.now() - startedAt });
          }

          navigationItems.find((item) => readLabel(item).includes('search'))?.click();
          await settlePaint();
          const input = document.querySelector('.archive-search input');
          const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          const searchStartedAt = performance.now();
          valueSetter?.call(input, 'S01');
          input?.dispatchEvent(new Event('input', { bubbles: true }));
          await settlePaint();

          return {
            localResultCount: document.querySelectorAll('.search-result').length,
            localSearchMilliseconds: performance.now() - searchStartedAt,
            timings
          };
        })()
      `)) as {
        localResultCount: number;
        localSearchMilliseconds: number;
        timings: Array<{ label: string; milliseconds: number }>;
      };
      const maxNavigationMilliseconds = Math.max(...measurements.timings.map((timing) => timing.milliseconds));

      if (maxNavigationMilliseconds >= 100 || measurements.localSearchMilliseconds >= 100) {
        throw new Error(`Installed performance budget failed: ${JSON.stringify(measurements)}`);
      }

      if (measurements.localResultCount === 0) {
        throw new Error('Installed local Search did not render results inside the performance budget.');
      }

      process.stdout.write(`installed performance: ${JSON.stringify(measurements)}\n`);
    }

    if (captureRequestedView === 'slow-catalog') {
      const measurements = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const input = document.querySelector('.archive-search input');
          const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          const startedAt = performance.now();
          valueSetter?.call(input, 'ring');
          input?.dispatchEvent(new Event('input', { bubbles: true }));
          await settlePaint();
          const localResultCount = document.querySelectorAll('.search-result').length;
          const localSearchMilliseconds = performance.now() - startedAt;
          await new Promise((resolve) => setTimeout(resolve, 360));
          return {
            localResultCount,
            localSearchMilliseconds,
            pending:
              document.querySelector('.search-group-catalog .search-group-empty')?.textContent?.includes(
                'Searching the catalog'
              ) === true
          };
        })()
      `)) as { localResultCount: number; localSearchMilliseconds: number; pending: boolean };

      if (measurements.localResultCount === 0 || measurements.localSearchMilliseconds >= 100 || !measurements.pending) {
        throw new Error(`Installed slow-catalog behavior failed: ${JSON.stringify(measurements)}`);
      }

      process.stdout.write(`installed slow catalog: ${JSON.stringify(measurements)}\n`);
    }

    if (captureRequestedView === 'performance-large') {
      const measurements = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          document.documentElement.style.scrollBehavior = 'auto';
          const initialCardCount = document.querySelectorAll('.movie-card').length;
          const batchDurations = [];
          const loadStartedAt = performance.now();

          while (document.querySelector('.library-load-more')) {
            const batchStartedAt = performance.now();
            document.querySelector('.library-load-more')?.click();
            await settlePaint();
            batchDurations.push(performance.now() - batchStartedAt);
          }

          const loadMilliseconds = performance.now() - loadStartedAt;
          const cardCount = document.querySelectorAll('.movie-card').length;
          const startedAt = performance.now();
          const frameDurations = [];
          let previousFrame = performance.now();

          for (let step = 1; step <= 12; step += 1) {
            window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * (step / 12));
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const now = performance.now();
            frameDurations.push(now - previousFrame);
            previousFrame = now;
          }

          await settlePaint();
          const totalMilliseconds = performance.now() - startedAt;
          const maxFrameMilliseconds = Math.max(...frameDurations);
          window.scrollTo(0, 0);
          await settlePaint();
          return {
            batchCount: batchDurations.length,
            cardCount,
            initialCardCount,
            loadMilliseconds,
            maxBatchMilliseconds: Math.max(0, ...batchDurations),
            maxFrameMilliseconds,
            totalMilliseconds
          };
        })()
      `)) as {
        batchCount: number;
        cardCount: number;
        initialCardCount: number;
        loadMilliseconds: number;
        maxBatchMilliseconds: number;
        maxFrameMilliseconds: number;
        totalMilliseconds: number;
      };

      if (
        measurements.initialCardCount > 120 ||
        measurements.cardCount < 1_000 ||
        measurements.batchCount < 1 ||
        measurements.maxBatchMilliseconds >= 250 ||
        measurements.loadMilliseconds >= 4_000 ||
        measurements.maxFrameMilliseconds >= 100 ||
        measurements.totalMilliseconds >= 2_000
      ) {
        throw new Error(`Installed large-library budget failed: ${JSON.stringify(measurements)}`);
      }

      process.stdout.write(`installed large library: ${JSON.stringify(measurements)}\n`);
    }

    if (captureRequestedView === 'performance-history-large') {
      const historyCount = (await historyStore.readState()).history.length;
      const rendererMeasurements = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const navigationItems = [...document.querySelectorAll('.nav-item')];
          const readLabel = (element) => (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase();
          const timings = {};
          const navigate = async (label) => {
            const startedAt = performance.now();
            navigationItems.find((item) => readLabel(item).includes(label))?.click();
            await settlePaint();
            timings[label] = performance.now() - startedAt;
          };

          await navigate('statistics');
          const statisticsText = document.querySelector('.statistics-view')?.textContent ?? '';
          await navigate('search');
          const input = document.querySelector('.archive-search input');
          const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          const searchStartedAt = performance.now();
          valueSetter?.call(input, 'Stress Film 0999');
          input?.dispatchEvent(new Event('input', { bubbles: true }));
          await settlePaint();
          const searchMilliseconds = performance.now() - searchStartedAt;
          const searchResultCount = document.querySelectorAll('.search-result').length;
          await navigate('library');
          document.querySelector('.movie-card .movie-card-face')?.click();
          await settlePaint();
          document.querySelector('.movie-card-selected .movie-card-face')?.click();
          await settlePaint();

          return {
            dossierViewingCount: document.querySelectorAll('.movie-dossier .viewing-row').length,
            readyMilliseconds: performance.now(),
            searchMilliseconds,
            searchResultCount,
            statisticsShowsHistoryCount: statisticsText.includes('1,000') || statisticsText.includes('1000'),
            timings
          };
        })()
      `)) as {
        dossierViewingCount: number;
        readyMilliseconds: number;
        searchMilliseconds: number;
        searchResultCount: number;
        statisticsShowsHistoryCount: boolean;
        timings: Record<string, number>;
      };
      const captureStartedAt = Number(process.env.MOVIE_LOG_CAPTURE_STARTED_AT);
      const measurements = {
        historyCount,
        ...rendererMeasurements,
        launchReadyMilliseconds: Number.isFinite(captureStartedAt) ? Date.now() - captureStartedAt : -1
      };
      const maxNavigationMilliseconds = Math.max(...Object.values(measurements.timings));

      if (
        measurements.historyCount < 1_000 ||
        !measurements.statisticsShowsHistoryCount ||
        measurements.searchResultCount < 1 ||
        measurements.dossierViewingCount < 1 ||
        maxNavigationMilliseconds >= 100 ||
        measurements.searchMilliseconds >= 100 ||
        measurements.readyMilliseconds >= 3_000 ||
        measurements.launchReadyMilliseconds < 0 ||
        measurements.launchReadyMilliseconds >= 4_000
      ) {
        throw new Error(`Installed large-history budget failed: ${JSON.stringify(measurements)}`);
      }

      process.stdout.write(`installed large history: ${JSON.stringify(measurements)}\n`);
    }

    if (captureRequestedView === 'watched-folder-flow') {
      if (!watchedFolderOverride) {
        throw new Error('Installed watched-folder flow requires an isolated watched-folder override.');
      }

      const startingState = await historyStore.readState();
      const startingHistoryCount = startingState.history.length;
      const startingLibraryIds = new Set(startingState.libraryItems.map((item) => item.id));
      const watchedFolderWindow = mainWindow;
      const waitForState = async (
        label: string,
        predicate: (state: MovieLogState) => boolean,
        maximumAttempts = 120
      ): Promise<MovieLogState> => {
        for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
          const state = await historyStore.readState();

          if (predicate(state)) {
            return state;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        throw new Error(`Installed watched-folder flow timed out waiting for ${label}.`);
      };
      const clickSettingsButton = async (label: string): Promise<boolean> =>
        (await watchedFolderWindow.webContents.executeJavaScript(`
          (() => {
            const button = [...document.querySelectorAll('.settings-view button')].find(
              (candidate) => candidate.textContent?.trim().toLowerCase() === ${JSON.stringify(label.toLowerCase())}
            );
            button?.click();
            return Boolean(button);
          })()
        `)) as boolean;

      if (!(await clickSettingsButton('Add folder'))) {
        throw new Error('Installed Settings did not expose Add folder.');
      }

      const addedState = await waitForState(
        'the selected folder to be added and initially indexed',
        (state) =>
          state.watchedFolders.some((folder) => folder.path === watchedFolderOverride) &&
          state.libraryItems.some((item) => item.sourcePath === `${watchedFolderOverride}/Baseline.mkv`)
      );
      const watchedFolder = addedState.watchedFolders.find((folder) => folder.path === watchedFolderOverride);

      if (!watchedFolder) {
        throw new Error('Installed Add folder did not persist the selected watched folder.');
      }

      if (
        addedState.libraryItems.some(
          (item) => item.sourcePath.includes('/.Hidden') || item.sourcePath.endsWith('/Unsupported.jpg')
        )
      ) {
        throw new Error('Installed watched-folder scan indexed hidden or unsupported files.');
      }

      const arrivalOne = `${watchedFolderOverride}/Arrival One.mkv`;
      const arrivalTwo = `${watchedFolderOverride}/Arrival Two.mkv`;
      await Promise.all([writeFile(arrivalOne, 'movie'), writeFile(arrivalTwo, 'movie')]);
      const arrivalState = await waitForState('two coalesced filesystem arrivals', (state) =>
        [arrivalOne, arrivalTwo].every((path) => state.history.some((entry) => entry.sourcePath === path))
      );
      const arrivalEntries = arrivalState.history.filter((entry) =>
        [arrivalOne, arrivalTwo].includes(entry.sourcePath)
      );

      if (arrivalEntries.length !== 2 || new Set(arrivalEntries.map((entry) => entry.watchedAt)).size !== 1) {
        throw new Error('Installed filesystem arrivals did not settle into one folder refresh.');
      }

      await mainWindow.webContents.executeJavaScript(`window.movieLog.copyPath(${JSON.stringify(arrivalOne)})`);

      if (clipboard.readText() !== arrivalOne) {
        throw new Error('Installed Copy path did not place the exact local path on the clipboard.');
      }

      await mainWindow.webContents.executeJavaScript(`window.movieLog.openInFinder(${JSON.stringify(arrivalOne)})`);
      await mainWindow.webContents.executeJavaScript(
        `window.movieLog.openItem(${JSON.stringify(watchedFolderOverride)})`
      );

      const manualScanPath = `${watchedFolderOverride}/Manual Scan.mkv`;
      await writeFile(manualScanPath, 'movie');

      if (!(await clickSettingsButton('Scan now'))) {
        throw new Error('Installed Settings did not expose Scan now.');
      }

      await waitForState('the manual scan result', (state) =>
        state.history.some((entry) => entry.sourcePath === manualScanPath)
      );

      const missingPath = `${watchedFolderOverride}-offline`;
      await rename(watchedFolderOverride, missingPath);
      const missingState = await waitForState(
        'the missing folder to clear its current index',
        (state) => !state.libraryItems.some((item) => item.folderId === watchedFolder.id)
      );
      const historyWhileMissing = missingState.history.length;
      await rename(missingPath, watchedFolderOverride);
      await waitForState(
        'the remounted folder to restore its current index',
        (state) => state.libraryItems.filter((item) => item.folderId === watchedFolder.id).length >= 4
      );

      const afterRemountPath = `${watchedFolderOverride}/After Remount.mkv`;
      await writeFile(afterRemountPath, 'movie');
      const remountedState = await waitForState('an arrival after remount', (state) =>
        state.history.some((entry) => entry.sourcePath === afterRemountPath)
      );

      if (remountedState.history.length !== historyWhileMissing + 1) {
        throw new Error('Installed remount duplicated history or lost the post-remount arrival.');
      }

      const removedByControl = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const row = [...document.querySelectorAll('.watched-folder-row')].find(
            (candidate) => candidate.textContent?.includes(${JSON.stringify(watchedFolderOverride)})
          );
          const button = row?.querySelector('.folder-remove');
          button?.click();
          return Boolean(button);
        })()
      `)) as boolean;

      if (!removedByControl) {
        throw new Error('Installed Settings did not expose Remove for the added watched folder.');
      }

      const removedState = await waitForState(
        'the watched folder to be removed',
        (state) =>
          !state.watchedFolders.some((folder) => folder.id === watchedFolder.id) &&
          !state.libraryItems.some((item) => item.folderId === watchedFolder.id)
      );
      const expectedUnrelatedLibraryCount = startingState.libraryItems.filter((item) =>
        startingLibraryIds.has(item.id)
      ).length;

      if (
        removedState.history.length !== remountedState.history.length ||
        removedState.libraryItems.length !== expectedUnrelatedLibraryCount
      ) {
        throw new Error('Installed watched-folder removal changed history or unrelated indexed media.');
      }

      const afterRemovalPath = `${watchedFolderOverride}/After Removal.mkv`;
      await writeFile(afterRemovalPath, 'movie');
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const finalState = await historyStore.readState();

      if (finalState.history.some((entry) => entry.sourcePath === afterRemovalPath)) {
        throw new Error('Removed watched folder continued recording filesystem arrivals.');
      }

      process.stdout.write(
        `installed watched folder flow: ${JSON.stringify({
          arrivalBatchSize: arrivalEntries.length,
          copiedPath: clipboard.readText(),
          finalHistoryCount: finalState.history.length,
          historyAdded: finalState.history.length - startingHistoryCount,
          remounted: true,
          removed: true
        })}\n`
      );
    }

    if (captureRequestedView === 'drag-drop-flow') {
      const [supportedPath, unsupportedPath] = dropPathOverrides;
      const startingHistoryCount = (await historyStore.readState()).history.length;
      mainWindow.setPosition(0, 80);
      const contentBounds = mainWindow.getContentBounds();
      const dropTarget = {
        x: Math.round(contentBounds.x + contentBounds.width / 2),
        y: Math.round(contentBounds.y + contentBounds.height / 2)
      };

      if (!supportedPath || !unsupportedPath) {
        throw new Error('Installed drag/drop flow could not resolve its target and fixture paths.');
      }

      await mainWindow.webContents.executeJavaScript(`
        (() => {
          window.__movieLogDropEvents = [];
          for (const type of ['dragenter', 'dragover', 'drop']) {
            document.addEventListener(type, (event) => {
              window.__movieLogDropEvents.push({
                fileCount: event.dataTransfer?.files.length ?? -1,
                fileNames: [...(event.dataTransfer?.files ?? [])].map((file) => file.name),
                target: event.target?.className ?? event.target?.nodeName ?? '',
                type,
                types: [...(event.dataTransfer?.types ?? [])]
              });
            }, true);
          }
        })()
      `);
      mainWindow.show();
      mainWindow.focus();
      process.stdout.write(`installed Finder drop waiting: ${JSON.stringify({ dropTarget })}\n`);
      await waitForCaptureSelector('.log-sheet', true, 300);

      const dropEvents = (await mainWindow.webContents.executeJavaScript(
        `window.__movieLogDropEvents ?? []`
      )) as Array<{ fileCount: number; fileNames: string[]; target: string; type: string; types: string[] }>;

      if (!dropEvents.some((event) => event.type === 'drop' && event.fileCount === dropPathOverrides.length)) {
        throw new Error(
          `Installed Finder drag did not reach the renderer with real files: ${JSON.stringify(dropEvents)}`
        );
      }

      const selectedMedia = (await mainWindow.webContents.executeJavaScript(`
        [...document.querySelectorAll('.selected-media p')].map((item) => item.textContent?.trim() ?? '')
      `)) as string[];

      if (
        !selectedMedia.includes(supportedPath.split('/').at(-1) ?? '') ||
        !selectedMedia.includes(unsupportedPath.split('/').at(-1) ?? '')
      ) {
        throw new Error(`Installed Finder drop did not preserve every dropped path: ${JSON.stringify(selectedMedia)}`);
      }

      const submitted = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const button = [...document.querySelectorAll('.log-sheet button')].find(
            (candidate) => candidate.textContent?.trim() === 'Log viewing'
          );
          button?.click();
          return Boolean(button && !button.disabled);
        })()
      `)) as boolean;

      if (!submitted) {
        throw new Error('Installed Log sheet did not enable Log viewing for dropped local media.');
      }

      await waitForCaptureSelector('.log-sheet', false, 120);
      await waitForCaptureSelector('.status-banner', true, 120);
      const finalState = await historyStore.readState();
      const feedbackText = (await mainWindow.webContents.executeJavaScript(
        `document.querySelector('.status-banner')?.textContent?.trim() ?? ''`
      )) as string;

      if (
        finalState.history.length !== startingHistoryCount + 1 ||
        !finalState.history.some((entry) => entry.sourcePath === supportedPath) ||
        finalState.history.some((entry) => entry.sourcePath === unsupportedPath) ||
        !feedbackText.includes('Logged 1 item') ||
        !feedbackText.includes('Skipped 1 path')
      ) {
        throw new Error(
          `Installed Finder drop did not save the supported path and report the unsupported path: ${JSON.stringify({ feedbackText })}`
        );
      }

      process.stdout.write(
        `installed Finder drop: ${JSON.stringify({ feedbackText, selectedMedia, supportedPath, unsupportedPath })}\n`
      );
    }

    if (captureRequestedView === 'diary' && captureWidth <= captureMobileNavigationBreakpoint) {
      const viewport = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const firstEntry = document.querySelector('.diary-entry');
          const navigation = document.querySelector('.mobile-nav');
          const switcher = document.querySelector('.view-switcher');
          return {
            firstEntryTop: firstEntry?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
            navigationTop: navigation?.getBoundingClientRect().top ?? 0,
            switcherBottom: switcher?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY
          };
        })()
      `)) as { firstEntryTop: number; navigationTop: number; switcherBottom: number };

      if (viewport.firstEntryTop >= viewport.navigationTop || viewport.switcherBottom >= viewport.navigationTop) {
        throw new Error(`Installed mobile Diary first-viewport proof failed: ${JSON.stringify(viewport)}`);
      }

      process.stdout.write(`installed mobile diary viewport: ${JSON.stringify(viewport)}\n`);
    }

    if (captureRequestedView === 'poster-performance') {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const throttledPosterResource = await measureThrottledPosterResource();
      const rendererMeasurements = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const images = [...document.querySelectorAll('img.poster-art')];
          await Promise.all(images.map(async (image) => {
            if (!image.complete) {
              await new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 3_000);
              });
            }
            if (image.complete && image.naturalWidth > 0 && image.style.display !== 'none') {
              await image.decode().catch(() => undefined);
            }
          }));

          const density = Math.min(Math.max(window.devicePixelRatio, 1), 2);
          const visibleImages = images.filter((image) => image.style.display !== 'none' && image.naturalWidth > 0);
          const resolutionRatios = visibleImages.map((image) => {
            const renderedWidth = image.getBoundingClientRect().width;
            const available = image.srcset ? image.naturalWidth : image.naturalWidth / density;
            return renderedWidth > 0 ? available / renderedWidth : 1;
          });
          const posters = [...document.querySelectorAll('.film-poster')];
          const aspectRatios = posters
            .map((poster) => poster.getBoundingClientRect())
            .filter((rect) => rect.width > 0)
            .map((rect) => rect.width / rect.height);

          let fallbackLayoutShift = 0;
          const sample = visibleImages[0];
          if (sample) {
            const poster = sample.closest('.film-poster');
            const before = poster?.getBoundingClientRect();
            sample.dispatchEvent(new Event('error'));
            await settlePaint();
            const after = poster?.getBoundingClientRect();
            if (before && after) {
              fallbackLayoutShift = Math.max(
                Math.abs(before.width - after.width),
                Math.abs(before.height - after.height),
                Math.abs(before.left - after.left),
                Math.abs(before.top - after.top)
              );
            }
          }

          return {
            aspectRatioDeviation: Math.max(0, ...aspectRatios.map((ratio) => Math.abs(ratio - 2 / 3))),
            fallbackCount: posters.filter((poster) => poster.getAttribute('data-poster') === 'plate').length,
            fallbackLayoutShift,
            minimumResolutionRatio: resolutionRatios.length ? Math.min(...resolutionRatios) : null,
            posterCount: posters.length,
            visiblePosterCount: visibleImages.length
          };
        })()
      `)) as {
        aspectRatioDeviation: number;
        fallbackCount: number;
        fallbackLayoutShift: number;
        minimumResolutionRatio: number | null;
        posterCount: number;
        visiblePosterCount: number;
      };
      const measurements = {
        ...rendererMeasurements,
        remoteResourceCount: 1,
        slowestResourceMilliseconds: throttledPosterResource.durationMilliseconds,
        throttledPosterDecodeMilliseconds: throttledPosterResource.decodeMilliseconds,
        throttledPosterGeometryShift: throttledPosterResource.geometryShift,
        throttledPosterLayoutShift: throttledPosterResource.layoutShift,
        throttledPosterNaturalWidth: throttledPosterResource.naturalWidth,
        throttledPosterUrl: throttledPosterResource.url
      };

      if (
        measurements.posterCount === 0 ||
        measurements.visiblePosterCount === 0 ||
        measurements.minimumResolutionRatio === null ||
        measurements.minimumResolutionRatio < 0.99 ||
        measurements.aspectRatioDeviation > 0.01 ||
        measurements.fallbackLayoutShift > 0.5 ||
        measurements.slowestResourceMilliseconds < 350 ||
        measurements.throttledPosterDecodeMilliseconds >= 1_000 ||
        measurements.throttledPosterGeometryShift > 0.5 ||
        measurements.throttledPosterLayoutShift > 0.001 ||
        measurements.throttledPosterNaturalWidth === 0
      ) {
        throw new Error(`Installed poster acceptance failed: ${JSON.stringify(measurements)}`);
      }

      process.stdout.write(`installed poster performance: ${JSON.stringify(measurements)}\n`);
    }

    if (captureRequestedView === 'accessibility-audit') {
      const audit = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const readLabel = (element) =>
            (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase();
          const navigationItems = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})];
          const settlePaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const results = [];
          const isVisible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };
          const accessibleName = (element) => {
            const labelledBy = element.getAttribute('aria-labelledby');
            const labelledText = labelledBy
              ? labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
              : '';
            const explicitLabel = element.id
              ? document.querySelector('label[for="' + CSS.escape(element.id) + '"]')?.textContent ?? ''
              : '';
            return (
              element.getAttribute('aria-label') ||
              labelledText ||
              explicitLabel ||
              element.closest('label')?.textContent ||
              element.getAttribute('alt') ||
              element.getAttribute('title') ||
              element.textContent ||
              ''
            ).trim();
          };
          const parseColor = (value) => {
            const match = value.match(/rgba?\\(([^)]+)\\)/);
            if (!match) return null;
            const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
            return { red: parts[0], green: parts[1], blue: parts[2], alpha: parts[3] ?? 1 };
          };
          const composite = (foreground, background) => ({
            red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
            green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
            blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
            alpha: 1
          });
          const luminance = (color) => {
            const channel = (value) => {
              const normalized = value / 255;
              return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
          };
          const contrastRatio = (left, right) => {
            const lighter = Math.max(luminance(left), luminance(right));
            const darker = Math.min(luminance(left), luminance(right));
            return (lighter + 0.05) / (darker + 0.05);
          };
          const readBackground = (element) => {
            if (element.classList?.contains('rating-segment-readout')) {
              const mark = element.parentElement?.querySelector('.rating-segment-mark');
              const markColor = mark ? parseColor(getComputedStyle(mark).backgroundColor) : null;
              if (markColor && markColor.alpha > 0) return markColor;
            }
            let current = element;
            const layers = [];
            while (current) {
              const style = getComputedStyle(current);
              if (style.backgroundImage !== 'none') return null;
              const color = parseColor(style.backgroundColor);
              if (color && color.alpha > 0) {
                layers.push(color);
                if (color.alpha >= 1) break;
              }
              current = current.parentElement;
            }
            let background = layers.pop() ?? { red: 255, green: 255, blue: 255, alpha: 1 };
            while (layers.length > 0) {
              background = composite(layers.pop(), background);
            }
            return background;
          };
          const auditSurface = (label) => {
            const interactive = [...document.querySelectorAll(
              'button, input:not([type="hidden"]), select, textarea, a[href], [role="button"], [role="tab"], [role="option"]'
            )].filter(isVisible);
            const missingNames = interactive
              .filter((element) => !accessibleName(element))
              .map((element) => element.outerHTML.slice(0, 160));
            const hiddenFocusable = interactive
              .filter(
                (element) =>
                  element.closest('[aria-hidden="true"]') && !element.closest('[inert][aria-hidden="true"]')
              )
              .map((element) => element.outerHTML.slice(0, 160));
            const modalBackgroundIssues = document.querySelector('[aria-modal="true"]')
              ? ['.archive-background', '.archive-spine', '.mobile-nav']
                  .filter((selector) => {
                    const element = document.querySelector(selector);
                    return !element?.hasAttribute('inert') || element.getAttribute('aria-hidden') !== 'true';
                  })
              : [];
            const imagesMissingAlternatives = [...document.querySelectorAll('img')]
              .filter(isVisible)
              .filter((image) => !image.hasAttribute('alt') && image.getAttribute('aria-hidden') !== 'true')
              .map((image) => image.outerHTML.slice(0, 160));
            const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
            const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
            const contrastFailures = [...document.querySelectorAll('body *')]
              .filter(isVisible)
              .filter((element) =>
                [...element.childNodes].some(
                  (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
                )
              )
              .flatMap((element) => {
                const style = getComputedStyle(element);
                const foreground = parseColor(style.color);
                const background = readBackground(element);
                if (!foreground || !background) return [];
                const ratio = contrastRatio(composite(foreground, background), background);
                const fontSize = Number.parseFloat(style.fontSize);
                const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
                const threshold = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
                return ratio + 0.01 < threshold
                  ? [(element.textContent?.trim().slice(0, 80) ?? '') + ':' + ratio.toFixed(2)]
                  : [];
              });
            const undersizedMajorTargets = window.innerWidth > ${captureMobileNavigationBreakpoint}
              ? []
              : [...document.querySelectorAll('.mobile-nav-item, .header-log-action, .filter-sheet-trigger, .sheet-close')]
                  .filter(isVisible)
                  .filter((element) => {
                    const rect = element.getBoundingClientRect();
                    return rect.width < 44 || rect.height < 44;
                  })
                  .map((element) => element.className);
            results.push({
              contrastFailures,
              duplicateIds,
              hiddenFocusable,
              imagesMissingAlternatives,
              interactiveCount: interactive.length,
              label,
              missingNames,
              modalBackgroundIssues,
              undersizedMajorTargets
            });
          };

          for (const label of ['library', 'search', 'statistics', 'settings']) {
            navigationItems.find((item) => readLabel(item).includes(label))?.click();
            await settlePaint();
            auditSurface(label);
          }

          navigationItems.find((item) => readLabel(item).includes('library'))?.click();
          await settlePaint();
          document.querySelector('.movie-card-face')?.click();
          await settlePaint();
          document.querySelector('.movie-card-selected .movie-card-face')?.click();
          await settlePaint();
          if (document.querySelector('.movie-dossier')) {
            auditSurface('dossier');
            document.querySelector('.dossier-back-action')?.click();
            await settlePaint();
          }

          document.querySelector(${JSON.stringify(logActionSelector)})?.click();
          await settlePaint();
          if (document.querySelector('.log-sheet')) {
            auditSurface('log');
            document.querySelector('.sheet-close')?.click();
            await settlePaint();
          }

          navigationItems.find((item) => readLabel(item).includes('library'))?.click();
          await settlePaint();
          const issues = results.flatMap((result) =>
            [
              'contrastFailures',
              'duplicateIds',
              'hiddenFocusable',
              'imagesMissingAlternatives',
              'missingNames',
              'modalBackgroundIssues',
              'undersizedMajorTargets'
            ]
              .flatMap((key) => result[key].map((value) => result.label + ':' + key + ':' + value))
          );
          return { issues, results };
        })()
      `)) as {
        issues: string[];
        results: Array<{ interactiveCount: number; label: string }>;
      };

      if (audit.issues.length > 0) {
        throw new Error(`Installed accessibility audit failed: ${JSON.stringify(audit)}`);
      }

      process.stdout.write(`installed accessibility: ${JSON.stringify(audit)}\n`);
    }

    if (captureRequestedView === 'diary-ledger' || captureRequestedView === 'diary-grid') {
      const requestedMode = captureRequestedView === 'diary-ledger' ? 'ledger' : 'grid';
      await mainWindow.webContents.executeJavaScript(`document.querySelector('#diary-tab-timeline')?.focus()`);
      const arrowCount = requestedMode === 'ledger' ? 1 : 2;

      for (let index = 0; index < arrowCount; index += 1) {
        mainWindow.webContents.sendInputEvent({ keyCode: 'Right', type: 'keyDown' });
        mainWindow.webContents.sendInputEvent({ keyCode: 'Right', type: 'keyUp' });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await waitForCaptureSelector(`#diary-panel-${requestedMode}`);
      const keyboardTabSelected = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const tab = document.querySelector(${JSON.stringify(`#diary-tab-${requestedMode}`)});
          return tab?.getAttribute('aria-selected') === 'true' && document.activeElement === tab;
        })()
      `)) as boolean;

      if (!keyboardTabSelected) {
        throw new Error(`Diary keyboard navigation did not select and focus the ${requestedMode} tab.`);
      }
    }

    if (captureRequestedView === 'library-filtered' || captureRequestedView === 'library-empty') {
      const filterSurface = captureWidth <= captureCompactFilterBreakpoint ? '.filter-sheet' : '.filter-toolbar';

      if (captureWidth <= captureCompactFilterBreakpoint) {
        await mainWindow.webContents.executeJavaScript(`document.querySelector('.filter-sheet-trigger')?.click()`);
      }

      await waitForCaptureSelector(filterSurface);
      const filtered = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const filterSurface = ${JSON.stringify(filterSurface)};
          const setCaptureSelect = (selector, value) => {
            const select = document.querySelector(selector);
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            setter?.call(select, value);
            select?.dispatchEvent(new Event('change', { bubbles: true }));
          };

          if (${JSON.stringify(captureRequestedView)} === 'library-empty') {
            const genre = document.querySelector(filterSurface + ' select[name="genre"]');
            const value = genre?.options[1]?.value ?? '';
            setCaptureSelect(filterSurface + ' select[name="genre"]', value);
            setCaptureSelect(filterSurface + ' select[name="mediaType"]', 'unknown');
          } else {
            const genre = document.querySelector(filterSurface + ' select[name="genre"]');
            const value = genre?.options[1]?.value ?? '';
            setCaptureSelect(filterSurface + ' select[name="genre"]', value);
          }

          if (filterSurface === '.filter-sheet') {
            document.querySelector('.filter-sheet-actions button:last-child')?.click();
          }
          return true;
        })()
      `)) as boolean;

      if (!filtered) {
        throw new Error(`Capture view did not apply filters: ${captureRequestedView}.`);
      }

      if (captureWidth <= captureCompactFilterBreakpoint) {
        await waitForCaptureSelector('.filter-sheet', false);
      }

      if (captureRequestedView === 'library-empty') {
        await waitForCaptureSelector('.library-film-field .blank-slate');
      }

      if (captureRequestedView === 'library-filtered' && captureWidth > captureCompactFilterBreakpoint) {
        await waitForCaptureSelector('.filter-chip');
        await mainWindow.webContents.executeJavaScript(`document.querySelector('.filter-chip')?.click()`);
        await waitForCaptureSelector('.filter-chip', false);
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            const select = document.querySelector('.filter-toolbar select[name="genre"]');
            const value = select?.options[1]?.value ?? '';
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            setter?.call(select, value);
            select?.dispatchEvent(new Event('change', { bubbles: true }));
          })()
        `);
        await waitForCaptureSelector('.filter-chip');
      }
    }

    if (captureRequestedView === 'search-long') {
      const setLongSearchQuery = `
        (() => {
          const input = document.querySelector('.archive-search input');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, 'a');
          input?.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `;
      await mainWindow.webContents.executeJavaScript(setLongSearchQuery);
      await waitForCaptureSelector('.search-result');
      const moveToLongSearchResult = `
        (() => {
          const input = document.querySelector('.archive-search input');

          for (let index = 0; index < 18; index += 1) {
            input?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' }));
          }

          const active = document.querySelector('.search-result-active');
          const bounds = active?.getBoundingClientRect();
          return Boolean(bounds && bounds.top >= 0 && bounds.bottom <= window.innerHeight);
        })()
      `;
      const activeResultVisible = (await mainWindow.webContents.executeJavaScript(moveToLongSearchResult)) as boolean;

      if (!activeResultVisible) {
        throw new Error('Long Search keyboard navigation did not keep the active result visible.');
      }

      mainWindow.webContents.sendInputEvent({ keyCode: 'Enter', type: 'keyDown' });
      mainWindow.webContents.sendInputEvent({ keyCode: 'Enter', type: 'keyUp' });
      await waitForCaptureSelector('.movie-dossier');

      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const libraryItem = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})]
            .find((item) => (item.getAttribute('aria-label') || item.textContent || '').trim().toLowerCase().includes('library'));
          libraryItem?.click();
        })()
      `);
      await waitForCaptureSelector('.library-view');
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const searchItem = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})]
            .find((item) => (item.getAttribute('aria-label') || item.textContent || '').trim().toLowerCase().includes('search'));
          searchItem?.focus();
          searchItem?.click();
        })()
      `);
      await waitForCaptureSelector('.search-view');
      await mainWindow.webContents.executeJavaScript(setLongSearchQuery);
      await waitForCaptureSelector('.search-result');

      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.archive-search input')?.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
        )
      `);
      await waitForCaptureSelector('.search-view', false);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const searchFocusRestored = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const searchItem = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})]
            .find((item) => item.textContent?.trim().toLowerCase().includes('search'));
          return Boolean(document.querySelector('.library-view') && document.activeElement === searchItem);
        })()
      `)) as boolean;

      if (!searchFocusRestored) {
        throw new Error('Search Escape did not return to the previous view and restore focus to its opener.');
      }

      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const searchItem = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})]
            .find((item) => item.textContent?.trim().toLowerCase().includes('search'));
          searchItem?.focus();
          searchItem?.click();
        })()
      `);
      await waitForCaptureSelector('.search-view');

      await mainWindow.webContents.executeJavaScript(setLongSearchQuery);
      await waitForCaptureSelector('.search-result');

      if (!((await mainWindow.webContents.executeJavaScript(moveToLongSearchResult)) as boolean)) {
        throw new Error('Long Search keyboard navigation did not remain visible after reopening Search.');
      }
    }

    if (captureRequestedView === 'search-results') {
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const input = document.querySelector('.archive-search input');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, 'ring');
          input?.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `);
      await waitForCaptureSelector('.search-result');
    }

    if (
      captureRequestedView === 'log' ||
      captureRequestedView === 'log-selected' ||
      captureRequestedView === 'log-ambiguity' ||
      captureRequestedView === 'log-path-match' ||
      captureRequestedView === 'log-multiple-paths' ||
      captureRequestedView === 'log-rating-none' ||
      captureRequestedView === 'log-rating-numeric' ||
      captureRequestedView === 'persistence-save'
    ) {
      await verifyLogDialogKeyboard(logActionSelector);
    }

    if (
      captureWidth <= captureMobileNavigationBreakpoint &&
      (captureRequestedView === 'log' || captureRequestedView === 'log-selected')
    ) {
      await verifyMobileSheetLifecycle({
        actionSelector: '.log-sheet .entry-form-footer button[type="submit"]',
        backdropSelector: '.log-backdrop',
        inputSelector: '.film-search-block input, .log-sheet input',
        scrollSelector: '.log-sheet-body',
        sheetSelector: '.log-sheet',
        triggerSelector: logActionSelector
      });
      const touchSupported = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          if (typeof TouchEvent !== 'function') {
            return false;
          }
          const dispatchSheetTouch = (selector, startY, endY) => {
            const target = document.querySelector(selector);
            const dispatch = (type, clientY) => {
              const event = new TouchEvent(type, { bubbles: true, cancelable: true });
              Object.defineProperty(event, 'changedTouches', { value: [{ clientY }] });
              target?.dispatchEvent(event);
            };
            dispatch('touchstart', startY);
            dispatch('touchend', endY);
          };
          dispatchSheetTouch('.log-sheet-head', 24, 112);
          return true;
        })()
      `)) as boolean;

      if (!touchSupported) {
        throw new Error('Mobile capture environment does not expose TouchEvent.');
      }

      await waitForCaptureSelector('.log-sheet', false);
      await mainWindow.webContents.executeJavaScript(
        `document.querySelector(${JSON.stringify(logActionSelector)})?.click()`
      );
      await waitForCaptureSelector('.log-sheet');
    }

    if (captureRequestedView === 'log') {
      const formFlow = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const footer = document.querySelector('.log-sheet .entry-form-footer');
          const previous = footer?.previousElementSibling;
          return {
            footerTop: footer?.offsetTop ?? -1,
            position: footer ? getComputedStyle(footer).position : '',
            previousBottom: previous ? previous.offsetTop + previous.offsetHeight : -1
          };
        })()
      `)) as { footerTop: number; position: string; previousBottom: number };

      if (formFlow.position !== 'static' || formFlow.footerTop < formFlow.previousBottom) {
        throw new Error(`Installed Log action flow failed: ${JSON.stringify(formFlow)}`);
      }

      process.stdout.write(`installed log action flow: ${JSON.stringify(formFlow)}\n`);
    }

    if (captureRequestedView === 'catalog' || captureRequestedView === 'catalog-outage') {
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const setCaptureInput = (selector, value) => {
            const input = document.querySelector(selector);
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(input, value);
            input?.dispatchEvent(new Event('input', { bubbles: true }));
          };
          setCaptureInput(
            '.archive-search input',
            ${JSON.stringify(captureRequestedView === 'catalog-outage' ? 'Catalog Outage Proof' : 'The Ring')}
          );
        })()
      `);

      if (captureRequestedView === 'catalog-outage') {
        await waitForCaptureSelector('.catalog-error');
      } else {
        await waitForCaptureSelector('.search-group-catalog .poster-art', true, 300);
        const liveCatalog = (await mainWindow.webContents.executeJavaScript(`
          (() => {
            const rows = [...document.querySelectorAll('.search-group-catalog .search-result')];
            const first = rows[0];
            const meta = first?.querySelector('.search-result-meta')?.textContent?.trim() ?? '';
            const poster = first?.querySelector('img.poster-art');
            return {
              directorVisible: meta.split('·').length >= 3,
              meta,
              posterWidth: poster?.naturalWidth ?? 0,
              resultCount: rows.length,
              title: first?.querySelector('.search-result-title')?.textContent?.trim() ?? ''
            };
          })()
        `)) as {
          directorVisible: boolean;
          meta: string;
          posterWidth: number;
          resultCount: number;
          title: string;
        };

        if (
          liveCatalog.resultCount === 0 ||
          !liveCatalog.directorVisible ||
          liveCatalog.posterWidth === 0 ||
          !liveCatalog.title
        ) {
          throw new Error(`Installed live catalog proof failed: ${JSON.stringify(liveCatalog)}`);
        }

        process.stdout.write(`installed live catalog: ${JSON.stringify(liveCatalog)}\n`);
      }
    }

    if (
      captureRequestedView === 'log-selected' ||
      captureRequestedView === 'log-ambiguity' ||
      captureRequestedView === 'log-path-match' ||
      captureRequestedView === 'persistence-save'
    ) {
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const setCaptureInput = (selector, value) => {
            const input = document.querySelector(selector);
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(input, value);
            input?.dispatchEvent(new Event('input', { bubbles: true }));
          };
          setCaptureInput('.film-search-block input', 'The Ring');
        })()
      `);
      await waitForCaptureSelector('.film-search-results button');
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.film-search-results button')?.click()`);
      await waitForCaptureSelector('.selected-film .poster-art');
    }

    if (captureRequestedView === 'log-ambiguity') {
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.media-chooser')?.click()`);
      await waitForCaptureSelector('.log-ambiguity-error');
      const blocked = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const submit = document.querySelector('.log-sheet .entry-form button[type="submit"]');
          return document.querySelectorAll('.selected-media p').length > 1 && submit?.disabled === true;
        })()
      `)) as boolean;

      if (!blocked) {
        throw new Error('Ambiguous multi-media logging did not remain visibly blocked without submission.');
      }

      if ((await historyStore.readState()).history.length !== initialRawHistoryCount) {
        throw new Error('Ambiguous multi-media logging changed history before the blocked submission was resolved.');
      }
    }

    if (captureRequestedView === 'log-path-match' || captureRequestedView === 'log-multiple-paths') {
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.media-chooser')?.click()`);
      const expectedPathCount = captureRequestedView === 'log-path-match' ? 1 : 2;
      await waitForCaptureSelector('.selected-media');
      const selectedPathCount = (await mainWindow.webContents.executeJavaScript(
        `document.querySelectorAll('.selected-media p').length`
      )) as number;

      if (selectedPathCount !== expectedPathCount) {
        throw new Error(`${captureRequestedView} selected ${selectedPathCount} paths instead of ${expectedPathCount}.`);
      }

      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.log-sheet .entry-form button[type="submit"]')?.click()
      `);
      await waitForCaptureSelector('.log-sheet', false);
      const nextState = await readState();

      if (nextState.history.length !== initialRawHistoryCount + expectedPathCount) {
        throw new Error(`${captureRequestedView} did not persist exactly ${expectedPathCount} accepted paths.`);
      }

      if (captureRequestedView === 'log-path-match') {
        const sourcePath = nextState.libraryItems[0]?.sourcePath;
        const entry = nextState.history.find(
          (candidate) => candidate.source === 'drop' && candidate.sourcePath === sourcePath
        );
        const film = entry ? nextState.films?.[readFilmKey(parseFilmTitle(entry.title))] : null;

        if (!entry || film?.status !== 'matched' || film.title !== 'The Ring') {
          throw new Error('The accepted single media path did not receive the selected catalog match.');
        }
      }
    }

    if (captureRequestedView === 'filters') {
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.filter-sheet-trigger')?.click()
      `);
      await waitForCaptureSelector('.filter-sheet');
      await verifyMobileSheetLifecycle({
        actionSelector: '.filter-sheet-actions button:last-child',
        backdropSelector: '.filter-sheet-backdrop',
        inputSelector: '.filter-sheet select',
        scrollSelector: '.filter-sheet-body',
        sheetSelector: '.filter-sheet',
        triggerSelector: '.filter-sheet-trigger'
      });
      const filterApplyResetPassed = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const select = document.querySelector('.filter-sheet select[name="genre"]');
          const value = select?.options[1]?.value ?? '';
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter?.call(select, value);
          select?.dispatchEvent(new Event('change', { bubbles: true }));
          document.querySelector('.filter-sheet-actions button:last-child')?.click();
          return Boolean(value);
        })()
      `)) as boolean;

      if (!filterApplyResetPassed) {
        throw new Error('Mobile filters did not expose a real genre option for Apply verification.');
      }

      await waitForCaptureSelector('.filter-sheet', false);
      await waitForCaptureSelector('.filter-chip');
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.filter-sheet-trigger')?.click()`);
      await waitForCaptureSelector('.filter-sheet');
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.filter-sheet-actions button:first-child')?.click()
      `);
      const resetVisible = (await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.filter-sheet select[name="genre"]')?.value === 'all'
      `)) as boolean;

      if (!resetVisible) {
        throw new Error('Mobile filter Reset did not restore the default genre value.');
      }

      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.filter-sheet-actions button:last-child')?.click()
      `);
      await waitForCaptureSelector('.filter-sheet', false);
      await waitForCaptureSelector('.filter-chip', false);
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.filter-sheet-trigger')?.click()`);
      await waitForCaptureSelector('.filter-sheet');
      const touchSupported = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          if (typeof TouchEvent !== 'function') {
            return false;
          }
          const dispatchSheetTouch = (selector, startY, endY) => {
            const target = document.querySelector(selector);
            const dispatch = (type, clientY) => {
              const event = new TouchEvent(type, { bubbles: true, cancelable: true });
              Object.defineProperty(event, 'changedTouches', { value: [{ clientY }] });
              target?.dispatchEvent(event);
            };
            dispatch('touchstart', startY);
            dispatch('touchend', endY);
          };
          dispatchSheetTouch('.filter-sheet-head', 24, 112);
          return true;
        })()
      `)) as boolean;

      if (!touchSupported) {
        throw new Error('Mobile capture environment does not expose TouchEvent.');
      }

      await waitForCaptureSelector('.filter-sheet', false);
      await mainWindow.webContents.executeJavaScript(`document.querySelector('.filter-sheet-trigger')?.click()`);
      await waitForCaptureSelector('.filter-sheet');
    }

    if (captureRequestedView === 'library-selected') {
      const selectedMovie = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const face = document.querySelector('.movie-card:has(.poster-art) .movie-card-face');
          face?.click();
          return Boolean(face);
        })()
      `)) as boolean;

      if (!selectedMovie) {
        throw new Error('Capture view did not render: library-selected has no movie card to select.');
      }

      await waitForCaptureSelector('.movie-card-selected');
      await waitForCaptureSelector('.library-inspector');
    }

    if (captureRequestedView === 'poster-locale') {
      const filmKey = 'inception::2010';
      const beforeFilm = (await readState()).films?.[filmKey];
      const beforePosterUrl = beforeFilm?.posterUrl;
      const migrationNeeded =
        beforeFilm?.posterLookupVersion !== 4 || beforePosterUrl !== captureInceptionEnglishPosterUrl;

      if (migrationNeeded) {
        assertCaptureWritable(captureDataMode, 'poster locale migration');
        await mainWindow.webContents.executeJavaScript(`window.movieLog.retryFilmEnrichment()`);
      }

      const migratedFilm = (await readState()).films?.[filmKey];

      if (
        !migratedFilm ||
        migratedFilm.posterLookupVersion !== 4 ||
        migratedFilm.posterUrl !== captureInceptionEnglishPosterUrl
      ) {
        throw new Error(
          `Installed poster locale migration failed: ${JSON.stringify({
            after: migratedFilm,
            beforePosterUrl
          })}`
        );
      }

      const selectedMovie = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const card = [...document.querySelectorAll('.movie-card')].find(
            (candidate) => candidate.querySelector('.movie-card-title')?.textContent?.trim() === 'Inception'
          );
          const face = card?.querySelector('.movie-card-face');
          face?.click();
          return Boolean(face);
        })()
      `)) as boolean;

      if (!selectedMovie) {
        throw new Error('Installed poster locale proof could not select Inception.');
      }

      await waitForCaptureSelector('.movie-card-selected');
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.movie-card-selected .movie-card-face')?.click()
      `);
      await waitForCaptureSelector('.movie-dossier');
      process.stdout.write(
        `installed poster locale: ${JSON.stringify({
          afterPosterUrl: migratedFilm.posterUrl,
          beforePosterUrl,
          migrationNeeded,
          posterLookupVersion: migratedFilm.posterLookupVersion,
          posterWidth: migratedFilm.posterWidth
        })}\n`
      );
    }

    if (
      captureRequestedView === 'detail' ||
      captureRequestedView === 'detail-delete-confirmation' ||
      captureRequestedView === 'detail-editor' ||
      captureRequestedView === 'detail-imdb-match' ||
      captureRequestedView === 'detail-missing' ||
      captureRequestedView === 'detail-outage' ||
      captureRequestedView === 'persistence-edit' ||
      captureRequestedView === 'persistence-delete' ||
      captureRequestedView === 'persistence-date-edit'
    ) {
      const persistenceSourcePath =
        captureRequestedView === 'persistence-edit'
          ? (await historyStore.readState()).history.find((entry) => entry.review === persistenceProof.review)
              ?.sourcePath
          : undefined;
      const selectedMovie = (await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const requestedView = ${JSON.stringify(captureRequestedView)};
          const persistenceSourcePath = ${JSON.stringify(persistenceSourcePath)};
          let face;

          if (requestedView === 'persistence-edit') {
            face = [...document.querySelectorAll('.movie-card')]
              .find((card) => card.getAttribute('data-path') === persistenceSourcePath)
              ?.querySelector('.movie-card-face');
          } else if (requestedView === 'detail-missing') {
            face = [...document.querySelectorAll('.movie-card:not(:has(.poster-art)) .movie-card-face')]
              .sort((left, right) => (right.textContent?.length ?? 0) - (left.textContent?.length ?? 0))[0];
          } else if (
            requestedView === 'detail' ||
            requestedView === 'detail-delete-confirmation' ||
            requestedView === 'detail-editor' ||
            requestedView === 'persistence-delete' ||
            requestedView === 'persistence-date-edit'
          ) {
            const qualifiedPosters = [...document.querySelectorAll(
              '.movie-card .film-poster[data-poster-source-width]'
            )]
              .filter(
                (poster) =>
                  Number(poster.getAttribute('data-poster-source-width')) >= ${dossierPosterMinimumWidth}
              )
              .sort(
                (left, right) =>
                  Number(right.getAttribute('data-poster-source-width')) -
                  Number(left.getAttribute('data-poster-source-width'))
              );
            const qualifiedPoster =
              requestedView === 'detail'
                ? qualifiedPosters[0]
                : qualifiedPosters.find((poster) => {
                    const status = poster.closest('.movie-card')?.querySelector('.movie-card-status')?.textContent?.trim();
                    return status !== 'Indexed' && status !== 'Archived';
                  });
            face = qualifiedPoster?.closest('.movie-card')?.querySelector('.movie-card-face');
          } else {
            face = document.querySelector('.movie-card:has(.poster-art) .movie-card-face');
          }

          face?.click();
          return Boolean(face);
        })()
      `)) as boolean;

      if (!selectedMovie) {
        throw new Error(`Capture view did not render: ${captureRequestedView} has no matching movie card to select.`);
      }

      await new Promise((resolve) => setTimeout(resolve, 180));
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.movie-card-selected .movie-card-face')?.click()
      `);
      await new Promise((resolve) => setTimeout(resolve, 180));

      if (captureRequestedView === 'detail') {
        const dossierPoster = (await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const image = document.querySelector('.movie-dossier img.poster-art');
            if (image && !image.complete) {
              await Promise.race([
                new Promise((resolve) => {
                  image.addEventListener('load', resolve, { once: true });
                  image.addEventListener('error', resolve, { once: true });
                }),
                new Promise((resolve) => setTimeout(resolve, 10_000))
              ]);
            }
            if (image?.complete && image.naturalWidth > 0) {
              await image.decode().catch(() => undefined);
            }
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const poster = image?.closest('.film-poster');
            const posterBounds = poster?.getBoundingClientRect();
            return {
              aspectRatio:
                posterBounds && posterBounds.height > 0 ? posterBounds.width / posterBounds.height : 0,
              clientWidth: image?.clientWidth ?? 0,
              currentSource: image?.currentSrc ?? '',
              naturalWidth: image?.naturalWidth ?? 0,
              quality: poster?.getAttribute('data-poster-quality') ?? '',
              state: poster?.getAttribute('data-poster') ?? '',
              visible: Boolean(image && getComputedStyle(image).display !== 'none')
            };
          })()
        `)) as {
          aspectRatio: number;
          clientWidth: number;
          currentSource: string;
          naturalWidth: number;
          quality: string;
          state: string;
          visible: boolean;
        };

        const requiresDecodedArt = captureWidth > 700;
        const decodedArtPassed =
          dossierPoster.visible &&
          dossierPoster.state === 'art' &&
          dossierPoster.naturalWidth > 0 &&
          dossierPoster.clientWidth > 0;
        const truthfulFallbackPassed =
          !dossierPoster.visible &&
          dossierPoster.state === 'plate' &&
          (dossierPoster.quality === 'low-resolution' || dossierPoster.quality === 'load-error') &&
          Math.abs(dossierPoster.aspectRatio - 2 / 3) <= 0.01;

        if (
          (requiresDecodedArt && !decodedArtPassed) ||
          (!requiresDecodedArt && !decodedArtPassed && !truthfulFallbackPassed)
        ) {
          throw new Error(`Installed Dossier poster anchor failed: ${JSON.stringify(dossierPoster)}`);
        }

        process.stdout.write(`installed dossier poster: ${JSON.stringify(dossierPoster)}\n`);
      }

      if (
        captureRequestedView === 'detail-editor' ||
        captureRequestedView === 'detail-delete-confirmation' ||
        captureRequestedView === 'persistence-edit' ||
        captureRequestedView === 'persistence-delete' ||
        captureRequestedView === 'persistence-date-edit'
      ) {
        const editorOpened = (await mainWindow.webContents.executeJavaScript(`
          (() => {
            const editor = document.querySelector('.viewing-editor');
            const summary = editor?.querySelector('summary');
            summary?.click();
            editor?.scrollIntoView({ block: 'center' });
            return Boolean(editor && summary);
          })()
        `)) as boolean;

        if (!editorOpened) {
          throw new Error(`Capture view did not render an editable viewing: ${captureRequestedView}.`);
        }

        await waitForCaptureSelector('.viewing-editor[open] .field-block-date');

        if (captureRequestedView === 'persistence-date-edit') {
          if (captureDataMode !== 'scratch') {
            throw new Error('Installed date-edit proof requires MOVIE_LOG_CAPTURE_DATA_MODE=scratch.');
          }

          const dateProof = '2026-05-17';
          const editTarget = (await mainWindow.webContents.executeJavaScript(`
            (() => {
              const editor = document.querySelector('.viewing-editor[open]');
              const row = editor?.closest('.viewing-row');
              const input = editor?.querySelector('input[name="watchedAt"]');
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
              const before = input?.value ?? '';
              setter?.call(input, ${JSON.stringify(dateProof)});
              input?.dispatchEvent(new Event('input', { bubbles: true }));
              editor?.querySelector('.entry-form')?.requestSubmit();
              return { before, entryId: row?.getAttribute('data-entry-id') ?? '' };
            })()
          `)) as { before: string; entryId: string };
          const expectedWatchedAt = new Date(`${dateProof}T12:00:00`).toISOString();
          let editedEntry: WatchEntry | undefined;

          for (let attempt = 0; attempt < 60; attempt += 1) {
            editedEntry = (await historyStore.readState()).history.find((entry) => entry.id === editTarget.entryId);

            if (editedEntry?.watchedAt === expectedWatchedAt) {
              break;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          if (!editTarget.entryId || editedEntry?.watchedAt !== expectedWatchedAt) {
            throw new Error(
              `Installed viewing-date edit did not persist: ${JSON.stringify({ editTarget, expectedWatchedAt, watchedAt: editedEntry?.watchedAt })}.`
            );
          }

          await waitForCaptureSelector('.status-banner');
          await mainWindow.webContents.executeJavaScript('window.scrollTo(0, 0)');
          process.stdout.write(
            `installed viewing date edit: ${JSON.stringify({ after: editedEntry.watchedAt, before: editTarget.before })}\n`
          );
        }

        if (captureRequestedView === 'detail-editor') {
          await mainWindow.webContents.executeJavaScript(`
            (() => {
              document.querySelector('.viewing-editor[open] .field-block-date')?.scrollIntoView({ block: 'start' });
              window.scrollBy(0, -24);
            })()
          `);
        }

        if (captureRequestedView === 'detail-delete-confirmation' || captureRequestedView === 'persistence-delete') {
          await mainWindow.webContents.executeJavaScript(`
            document.querySelector('.viewing-editor[open] .viewing-delete-action')?.click()
          `);
          await waitForCaptureSelector('.confirmation-dialog');
          const confirmation = (await mainWindow.webContents.executeJavaScript(`
            (() => ({
              backgroundInert: document.querySelector('.archive-background')?.inert === true,
              focusInside:
                document.querySelector('.confirmation-dialog')?.contains(document.activeElement) === true,
              modal: document.querySelector('.confirmation-dialog')?.getAttribute('aria-modal') === 'true'
            }))()
          `)) as { backgroundInert: boolean; focusInside: boolean; modal: boolean };

          if (!confirmation.backgroundInert || !confirmation.focusInside || !confirmation.modal) {
            throw new Error(`Installed delete confirmation accessibility failed: ${JSON.stringify(confirmation)}.`);
          }

          process.stdout.write(`installed delete confirmation: ${JSON.stringify(confirmation)}\n`);
        }

        if (captureRequestedView === 'persistence-delete') {
          if (captureDataMode !== 'scratch') {
            throw new Error('Installed deletion proof requires MOVIE_LOG_CAPTURE_DATA_MODE=scratch.');
          }

          await mainWindow.webContents.executeJavaScript(`
            document.querySelector('.confirmation-confirm')?.click()
          `);
          await waitForCaptureSelector('.status-banner');
          await mainWindow.webContents.executeJavaScript('window.scrollTo(0, 0)');
          const nextHistoryCount = (await historyStore.readState()).history.length;

          if (nextHistoryCount !== initialRawHistoryCount - 1) {
            throw new Error(
              `Installed deletion changed history from ${initialRawHistoryCount} to ${nextHistoryCount} instead of removing one viewing.`
            );
          }

          process.stdout.write(
            `installed viewing deletion: ${JSON.stringify({ after: nextHistoryCount, before: initialRawHistoryCount })}\n`
          );
        }
      }

      if (captureRequestedView === 'detail-missing') {
        const fallbackPoster = (await mainWindow.webContents.executeJavaScript(`
          (() => {
            const poster = document.querySelector('.movie-dossier .film-poster');
            const image = poster?.querySelector('img.poster-art');
            const bounds = poster?.getBoundingClientRect();
            return {
              aspectRatio: bounds && bounds.height > 0 ? bounds.width / bounds.height : 0,
              imageVisible: Boolean(image && getComputedStyle(image).display !== 'none'),
              state: poster?.getAttribute('data-poster') ?? ''
            };
          })()
        `)) as { aspectRatio: number; imageVisible: boolean; state: string };

        if (
          fallbackPoster.state !== 'plate' ||
          fallbackPoster.imageVisible ||
          Math.abs(fallbackPoster.aspectRatio - 2 / 3) > 0.01
        ) {
          throw new Error(`Installed Dossier fallback poster failed: ${JSON.stringify(fallbackPoster)}`);
        }

        process.stdout.write(`installed dossier fallback: ${JSON.stringify(fallbackPoster)}\n`);
      }

      if (captureRequestedView === 'detail-outage') {
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            const details = document.querySelector('.match-study');
            if (details) details.open = true;
            document.querySelector('.match-search')?.requestSubmit();
          })()
        `);
        await waitForCaptureSelector('.dossier-match-error');
        await mainWindow.webContents.executeJavaScript(`
          document.querySelector('.dossier-match-error')?.scrollIntoView({ block: 'center' })
        `);
      }

      if (captureRequestedView === 'detail-imdb-match') {
        const beforeFilms = (await readState()).films ?? {};
        const targetKeys = (await mainWindow.webContents.executeJavaScript(`
          JSON.parse(document.querySelector('.movie-dossier')?.getAttribute('data-film-record-keys') ?? '[]')
        `)) as string[];
        const beforeIdentities = new Map(
          targetKeys.map((key) => {
            const record = beforeFilms[key];
            return [key, `${record?.catalogSource ?? 'wikipedia'}:${record?.catalogId ?? record?.pageId ?? ''}`];
          })
        );

        if (targetKeys.length === 0) {
          throw new Error('Installed IMDb Dossier proof could not identify the selected film keys.');
        }

        const searchSubmitted = (await mainWindow.webContents.executeJavaScript(`
          (() => {
            const details = document.querySelector('.match-study');
            if (details) details.open = true;
            const form = document.querySelector('.match-search');
            form?.requestSubmit();
            return Boolean(form);
          })()
        `)) as boolean;

        if (!searchSubmitted) {
          throw new Error('Installed IMDb Dossier proof could not submit a catalog match search.');
        }

        await waitForCaptureSelector('.match-results button', true, 150);
        await mainWindow.webContents.executeJavaScript(`
          document.querySelector('.match-results button')?.click()
        `);

        let matchedRecords: FilmRecord[] = [];

        for (let attempt = 0; attempt < 100; attempt += 1) {
          const currentFilms = (await readState()).films ?? {};
          matchedRecords = targetKeys
            .map((key) => currentFilms[key])
            .filter((record): record is FilmRecord => Boolean(record));
          const everyTargetChangedToImdb =
            matchedRecords.length === targetKeys.length &&
            targetKeys.every((key) => {
              const record = currentFilms[key];
              return (
                record?.catalogSource === 'imdb' &&
                beforeIdentities.get(key) !==
                  `${record.catalogSource ?? 'wikipedia'}:${record.catalogId ?? record.pageId ?? ''}`
              );
            });

          if (everyTargetChangedToImdb) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const matchedRecord = matchedRecords[0];
        const chosenIdentity = matchedRecord
          ? `${matchedRecord.catalogSource}:${matchedRecord.catalogId}:${matchedRecord.pageId}`
          : '';
        const validTargets =
          matchedRecords.length === targetKeys.length &&
          matchedRecords.every(
            (record) =>
              record.catalogSource === 'imdb' &&
              record.catalogId?.startsWith('tt') &&
              record.pageId !== null &&
              record.pageId < 0 &&
              Boolean(record.posterUrl) &&
              record.director.length > 0 &&
              `${record.catalogSource}:${record.catalogId}:${record.pageId}` === chosenIdentity
          );

        if (!matchedRecord || !validTargets) {
          throw new Error(
            `Installed IMDb Dossier match did not preserve provider identity: ${JSON.stringify(matchedRecords)}`
          );
        }

        process.stdout.write(
          `installed IMDb dossier match: ${JSON.stringify({
            catalogId: matchedRecord.catalogId,
            catalogSource: matchedRecord.catalogSource,
            director: matchedRecord.director,
            pageId: matchedRecord.pageId,
            posterWidth: matchedRecord.posterWidth,
            title: matchedRecord.title
          })}\n`
        );
      }
    }

    if (captureRequestedView === 'statistics-lower') {
      await waitForCaptureSelector('.activity-panel');
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.activity-panel')?.scrollIntoView({ block: 'start' })
      `);
    }

    if (captureRequestedView === 'log-rating-none' || captureRequestedView === 'log-rating-numeric') {
      await verifyRatingKeyboardFocus(captureRequestedView);
    }

    if (
      captureRequestedView === 'log' ||
      captureRequestedView === 'log-selected' ||
      captureRequestedView === 'persistence-save'
    ) {
      const ratingSelectionState = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const input = document.querySelectorAll('.log-sheet .rating-segment input')[7];
          input?.click();
          const output = document.querySelector('.log-sheet .rating-current-value');
          const mark = input?.closest('label')?.querySelector('.rating-segment-mark');
          const readout = input?.closest('label')?.querySelector('.rating-segment-readout');
          const readColor = (value) => {
            const channels = value.match(/\\d+(?:\\.\\d+)?/g)?.map(Number) ?? [];
            return {
              alpha: channels[3] ?? 1,
              blue: channels[2] ?? 0,
              green: channels[1] ?? 0,
              red: channels[0] ?? 0
            };
          };
          const compositeOnWhite = (color) => [
            color.red * color.alpha + 255 * (1 - color.alpha),
            color.green * color.alpha + 255 * (1 - color.alpha),
            color.blue * color.alpha + 255 * (1 - color.alpha)
          ];
          const luminance = (channels) => {
            const values = channels.map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
          };
          const contrastRatio = (foreground, background) => {
            const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
            return (values[0] + 0.05) / (values[1] + 0.05);
          };
          const foreground = readout ? compositeOnWhite(readColor(getComputedStyle(readout).color)) : [];
          const background = mark ? compositeOnWhite(readColor(getComputedStyle(mark).backgroundColor)) : [];
          return {
            checked: input?.checked === true,
            contrast: foreground.length && background.length ? contrastRatio(foreground, background) : 0,
            fontWeight: readout ? Number.parseInt(getComputedStyle(readout).fontWeight, 10) : 0,
            markHeight: mark?.getBoundingClientRect().height ?? 0,
            nonColorCue: Boolean(mark && getComputedStyle(mark).boxShadow !== 'none'),
            output: output?.textContent?.trim() ?? '',
          };
        })()
      `)) as {
        checked: boolean;
        contrast: number;
        fontWeight: number;
        markHeight: number;
        nonColorCue: boolean;
        output: string;
      };
      const ratingSelectionVisible =
        ratingSelectionState.checked &&
        ratingSelectionState.output === 'Current 4.0' &&
        ratingSelectionState.markHeight > 0 &&
        ratingSelectionState.nonColorCue &&
        ratingSelectionState.fontWeight >= 700 &&
        ratingSelectionState.contrast >= 4.5;

      if (!ratingSelectionVisible) {
        throw new Error(
          `Log dialog did not expose a semantic, readable selected 4.0 rating: ${JSON.stringify(ratingSelectionState)}`
        );
      }
    }

    if (captureRequestedView === 'persistence-save') {
      const populated = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const proof = ${JSON.stringify(persistenceProof)};
          const setValue = (selector, value) => {
            const control = document.querySelector(selector);
            const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(control, value);
            control?.dispatchEvent(new Event('input', { bubbles: true }));
          };
          setValue('.log-sheet .entry-form textarea[name="review"]', proof.review);
          setValue('.log-sheet .entry-form textarea[name="castNotes"]', proof.castNotes);
          setValue('.log-sheet .entry-form input[name="tags"]', proof.tags.join(', '));
          setValue('.log-sheet .entry-form input[name="viewingFormat"]', proof.viewingFormat);
          setValue('.log-sheet .entry-form input[name="location"]', proof.location);
          for (const name of ['favorite', 'rewatch']) {
            const checkbox = document.querySelector('.log-sheet .entry-form input[name="' + name + '"]');
            if (checkbox && !checkbox.checked) checkbox.click();
          }
          return (
            document.querySelector('.log-sheet textarea[name="review"]')?.value === proof.review &&
            document.querySelector('.log-sheet textarea[name="castNotes"]')?.value === proof.castNotes &&
            document.querySelector('.log-sheet input[name="tags"]')?.value === proof.tags.join(', ') &&
            document.querySelector('.log-sheet input[name="viewingFormat"]')?.value === proof.viewingFormat &&
            document.querySelector('.log-sheet input[name="location"]')?.value === proof.location &&
            document.querySelector('.log-sheet input[name="favorite"]')?.checked === true &&
            document.querySelector('.log-sheet input[name="rewatch"]')?.checked === true
          );
        })()
      `)) as boolean;

      if (!populated) {
        throw new Error('The installed Log Film form did not accept every persistence proof value.');
      }
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.log-sheet .entry-form button[type="submit"]')?.click()
      `);
      await waitForCaptureSelector('.log-sheet', false);
      await waitForCaptureSelector('.library-view');
      const savedEntry = (await historyStore.readState()).history.find(
        (entry) => entry.review === persistenceProof.review
      );

      if (!entryMatchesPersistenceProof(savedEntry)) {
        throw new Error('The installed Log Film flow did not persist every annotation exactly.');
      }

      if (persistenceProofPath) {
        await writeFile(persistenceProofPath, `${JSON.stringify(savedEntry, null, 2)}\n`, 'utf8');
      }
    }

    if (captureRequestedView === 'persistence-verify') {
      const entrySurvivedRelaunch = entryMatchesPersistenceProof(
        (await historyStore.readState()).history.find((entry) => entry.review === persistenceProof.review)
      );

      if (!entrySurvivedRelaunch) {
        throw new Error('The scratch Log Film entry did not survive the installed-app relaunch.');
      }
    }

    if (captureRequestedView === 'persistence-edit') {
      const editAccepted = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const edit = ${JSON.stringify(persistenceEditProof)};
          const form = document.querySelector('.viewing-editor[open] .entry-form');
          const setValue = (selector, value) => {
            const control = form?.querySelector(selector);
            const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(control, value);
            control?.dispatchEvent(new Event('input', { bubbles: true }));
          };
          setValue('textarea[name="review"]', edit.review);
          setValue('textarea[name="castNotes"]', edit.castNotes);
          setValue('input[name="tags"]', edit.tags.join(', '));
          setValue('input[name="viewingFormat"]', edit.viewingFormat);
          setValue('input[name="location"]', edit.location);
          form?.querySelectorAll('.rating-segment input')[8]?.click();
          for (const name of ['favorite', 'rewatch']) {
            const checkbox = form?.querySelector('input[name="' + name + '"]');
            if (checkbox && !checkbox.checked) checkbox.click();
          }
          form?.requestSubmit();
          return Boolean(form);
        })()
      `)) as boolean;

      if (!editAccepted) {
        throw new Error('The installed Dossier edit form did not accept the persistence proof update.');
      }

      let editedEntry: WatchEntry | undefined;

      for (let attempt = 0; attempt < 60; attempt += 1) {
        editedEntry = (await historyStore.readState()).history.find(
          (entry) => entry.review === persistenceEditProof.review
        );

        if (entryMatchesPersistenceEditProof(editedEntry)) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!entryMatchesPersistenceEditProof(editedEntry)) {
        throw new Error('The installed Dossier edit did not persist every changed field exactly.');
      }

      if (persistenceProofPath) {
        await writeFile(persistenceProofPath, `${JSON.stringify(editedEntry, null, 2)}\n`, 'utf8');
      }
    }

    if (captureRequestedView === 'persistence-edit-verify') {
      const editedEntry = (await historyStore.readState()).history.find(
        (entry) => entry.review === persistenceEditProof.review
      );
      const editSurvivedRelaunch = entryMatchesPersistenceEditProof(editedEntry);

      if (!editSurvivedRelaunch) {
        throw new Error('The edited diary entry did not survive the installed-app relaunch.');
      }
    }

    if (captureRequestedView === 'retry-backoff-verify') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const record = (await readState()).films?.['the ring::2002'];

      if (record?.status !== 'retry-scheduled' || record.attempts !== 2) {
        throw new Error('Installed-app relaunch ignored the persisted retry schedule or changed its attempt count.');
      }
    }

    if (captureRequestedView === 'metadata-retry') {
      const beforeRetry = (await readState()).films?.['the ring::2002'];

      if (beforeRetry?.status !== 'retry-scheduled' || beforeRetry.attempts !== 2) {
        throw new Error('Metadata retry fixture did not begin from its persisted scheduled state.');
      }

      const retryAvailable = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const retry = document.querySelector('.metadata-retry');
          retry?.click();
          return Boolean(retry);
        })()
      `)) as boolean;

      if (!retryAvailable) {
        throw new Error('The installed app did not expose metadata Retry for a scheduled failure.');
      }

      await waitForCaptureSelector('.status-banner', true, 300);
      const afterRetry = (await readState()).films?.['the ring::2002'];

      if (afterRetry?.status !== 'matched' || !afterRetry.posterUrl || (afterRetry.attempts ?? 0) <= 2) {
        throw new Error(
          'Installed metadata Retry did not replace the scheduled failure with a persisted poster match.'
        );
      }
    }

    if (captureRequestedView === 'aggregation-verify') {
      const aggregationOpened = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const cards = [...document.querySelectorAll('.movie-card')]
            .filter((card) => card.querySelector('.movie-card-title')?.textContent?.trim() === 'The Ring');
          cards[0]?.querySelector('.movie-card-face')?.click();
          return cards.length;
        })()
      `)) as number;

      if (aggregationOpened !== 1) {
        throw new Error(`Film aggregation rendered ${aggregationOpened} The Ring cards instead of one.`);
      }

      await waitForCaptureSelector('.movie-card-selected');
      await mainWindow.webContents.executeJavaScript(`
        document.querySelector('.movie-card-selected .movie-card-face')?.click()
      `);
      await waitForCaptureSelector('.movie-dossier');
      const aggregation = (await mainWindow.webContents.executeJavaScript(`
        ({
          sourceCount: document.querySelectorAll('.dossier-source-actions').length,
          title: document.querySelector('.dossier-copy h2')?.textContent?.trim() ?? '',
          viewingCount: document.querySelectorAll('.viewing-row').length
        })
      `)) as { sourceCount: number; title: string; viewingCount: number };

      if (aggregation.title !== 'The Ring' || aggregation.sourceCount < 2 || aggregation.viewingCount < 2) {
        throw new Error(`Installed film aggregation did not survive relaunch: ${JSON.stringify(aggregation)}.`);
      }
    }

    const viewSelector = {
      'accessibility-audit': '.library-view',
      'aggregation-verify': '.movie-dossier',
      catalog: '.search-view',
      'catalog-outage': '.catalog-error',
      detail: '.movie-dossier',
      'detail-delete-confirmation': '.confirmation-dialog',
      'detail-editor': '.viewing-editor[open] .field-block-date',
      'detail-imdb-match': '.movie-dossier',
      'detail-missing': '.movie-dossier',
      'detail-outage': '.dossier-match-error',
      'drag-drop-flow': '.status-banner',
      diary: '.diary-view',
      'diary-grid': '#diary-panel-grid',
      'diary-ledger': '#diary-panel-ledger',
      'empty-archive': '.blank-slate',
      filters: '.filter-sheet',
      library: '.library-view',
      'library-empty': '.library-film-field .blank-slate',
      'library-filtered': '.library-view',
      'library-selected': '.library-inspector',
      log: '.log-sheet',
      'log-selected': '.selected-film',
      'log-ambiguity': '.log-ambiguity-error',
      'log-path-match': '.library-view',
      'log-multiple-paths': '.library-view',
      'log-rating-none': '.rating-none:has(input:focus-visible)',
      'log-rating-numeric': '.rating-segment:has(input:focus-visible)',
      'metadata-retry': '.status-banner',
      loading: '.screen-loading',
      'layout-stability': '.library-view',
      'load-error': '.error-state',
      'persistence-save': '.library-view',
      'persistence-verify': '.library-view',
      'persistence-edit': '.movie-dossier',
      'persistence-edit-verify': '.library-view',
      'persistence-delete': '.status-banner',
      'persistence-date-edit': '.status-banner',
      performance: '.search-result',
      'performance-history-large': '.movie-dossier',
      'performance-large': '.movie-card',
      'poster-performance': '.library-view',
      'poster-locale': '.movie-dossier',
      'retry-backoff-verify': '.metadata-retry',
      search: '.search-view',
      'search-results': '.search-result',
      'search-long': '.search-result-active',
      settings: '.settings-view',
      'slow-catalog': '.search-result',
      statistics: '.statistics-view',
      'statistics-lower': '.activity-panel',
      'watched-folder-flow': '.settings-view'
    }[captureRequestedView];
    const viewRendered = (await mainWindow.webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(viewSelector)}))`
    )) as boolean;

    if (!viewRendered) {
      throw new Error(`Capture view did not render: ${captureRequestedView}.`);
    }
  }

  async function verifyLogDialogKeyboard(logActionSelector: string): Promise<void> {
    if (!mainWindow) {
      return;
    }

    const initialFocusInside = (await mainWindow.webContents.executeJavaScript(`
      document.querySelector('.log-sheet')?.contains(document.activeElement) === true
    `)) as boolean;

    if (!initialFocusInside) {
      throw new Error('Log dialog did not move focus inside when opened.');
    }

    await mainWindow.webContents.executeJavaScript(`
      document.querySelector('.log-sheet button')?.focus()
    `);
    mainWindow.webContents.sendInputEvent({
      keyCode: 'Tab',
      modifiers: ['shift'],
      type: 'keyDown'
    });
    mainWindow.webContents.sendInputEvent({
      keyCode: 'Tab',
      modifiers: ['shift'],
      type: 'keyUp'
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const wrappedToLast = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const focusable = [...document.querySelectorAll('.log-sheet button, .log-sheet input, .log-sheet select, .log-sheet textarea, .log-sheet summary')]
          .filter((element) => !element.hasAttribute('disabled'));
        return document.activeElement === focusable.at(-1);
      })()
    `)) as boolean;

    if (!wrappedToLast) {
      throw new Error('Log dialog did not trap backward focus at its final control.');
    }

    mainWindow.webContents.sendInputEvent({ keyCode: 'Escape', type: 'keyDown' });
    mainWindow.webContents.sendInputEvent({ keyCode: 'Escape', type: 'keyUp' });
    await waitForCaptureSelector('.log-sheet', false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const focusRestored = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const logActionSelector = ${JSON.stringify(logActionSelector)};
        return document.querySelector(logActionSelector) === document.activeElement;
      })()
    `)) as boolean;

    if (!focusRestored) {
      throw new Error('Log dialog did not restore focus to its opening action.');
    }

    await mainWindow.webContents.executeJavaScript(
      `document.querySelector(${JSON.stringify(logActionSelector)})?.click()`
    );
    await waitForCaptureSelector('.log-sheet');
  }

  async function verifyRatingKeyboardFocus(profile: 'log-rating-none' | 'log-rating-numeric'): Promise<void> {
    if (!mainWindow) {
      return;
    }

    const focusSelector =
      profile === 'log-rating-none'
        ? '.log-sheet .rating-none input'
        : '.log-sheet .rating-segment input:first-of-type';

    if (profile === 'log-rating-none') {
      await mainWindow.webContents.executeJavaScript(`
        document.querySelectorAll('.log-sheet .rating-segment input')[3]?.focus()
      `);
      mainWindow.webContents.sendInputEvent({ keyCode: 'Space', type: 'keyDown' });
      mainWindow.webContents.sendInputEvent({ keyCode: 'Space', type: 'keyUp' });
    }

    await mainWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(focusSelector)})?.focus()`);
    mainWindow.webContents.sendInputEvent({ keyCode: 'Space', type: 'keyDown' });
    mainWindow.webContents.sendInputEvent({ keyCode: 'Space', type: 'keyUp' });

    if (profile === 'log-rating-numeric') {
      mainWindow.webContents.sendInputEvent({ keyCode: 'Right', type: 'keyDown' });
      mainWindow.webContents.sendInputEvent({ keyCode: 'Right', type: 'keyUp' });
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
    const focusVisible = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const input =
          ${JSON.stringify(profile)} === 'log-rating-none'
            ? document.querySelector('.log-sheet .rating-none input')
            : document.querySelector('.log-sheet .rating-segment input:checked');
        const control = input?.closest('label');
        const style = control ? getComputedStyle(control) : null;
        return Boolean(
          input?.checked &&
          document.activeElement === input &&
          style &&
          style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) >= 2
        );
      })()
    `)) as boolean;

    if (!focusVisible) {
      throw new Error(`${profile} did not preserve a structural focus outline after keyboard selection.`);
    }
  }

  async function verifyMobileSheetLifecycle({
    actionSelector,
    backdropSelector,
    inputSelector,
    scrollSelector,
    sheetSelector,
    triggerSelector
  }: {
    actionSelector: string;
    backdropSelector: string;
    inputSelector: string;
    scrollSelector: string;
    sheetSelector: string;
    triggerSelector: string;
  }): Promise<void> {
    if (!mainWindow) {
      return;
    }

    const focusStart = (await mainWindow.webContents.executeJavaScript(`
      ({ height: window.visualViewport?.height ?? window.innerHeight, width: window.visualViewport?.width ?? window.innerWidth })
    `)) as { height: number; width: number };
    await mainWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(inputSelector)})?.focus()`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const sheetMetrics = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const backdrop = document.querySelector(${JSON.stringify(backdropSelector)});
        const action = document.querySelector(${JSON.stringify(actionSelector)});
        const input = document.querySelector(${JSON.stringify(inputSelector)});
        const scroll = document.querySelector(${JSON.stringify(scrollSelector)});
        const sheet = document.querySelector(${JSON.stringify(sheetSelector)});
        const navigationSelector = window.innerWidth <= ${captureMobileNavigationBreakpoint} ? '.mobile-nav' : '.archive-spine';
        const navigation = document.querySelector(navigationSelector);
        const navigationBounds = navigation?.getBoundingClientRect();
        const navigationTarget = navigationBounds
          ? document.elementFromPoint(navigationBounds.left + navigationBounds.width / 2, navigationBounds.top + navigationBounds.height / 2)
          : null;
        const internalScroll = Boolean(scroll && scroll.scrollHeight > scroll.clientHeight);

        if (scroll) {
          scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        }

        const scrolled = Boolean(scroll && scroll.scrollTop > 0);
        const actionBounds = action?.getBoundingClientRect();
        const sheetBounds = sheet?.getBoundingClientRect();
        const actionReachable = Boolean(
          actionBounds &&
          sheetBounds &&
          actionBounds.top >= sheetBounds.top - 1 &&
          actionBounds.bottom <= sheetBounds.bottom + 1
        );

        if (scroll) {
          scroll.scrollTop = 0;
        }

        return {
          focusHeight: window.visualViewport?.height ?? window.innerHeight,
          focusWidth: window.visualViewport?.width ?? window.innerWidth,
          inputFontSize: input ? Number.parseFloat(getComputedStyle(input).fontSize) : 0,
          internalScroll: internalScroll && scrolled,
          actionReachable,
          mobileNavigationBlocked:
            Boolean(backdrop && navigation && !navigationTarget?.closest(navigationSelector)) &&
            (Number.parseFloat(getComputedStyle(backdrop).zIndex) || 0) >
              (Number.parseFloat(getComputedStyle(navigation).zIndex) || 0)
        };
      })()
    `)) as {
      focusHeight: number;
      focusWidth: number;
      inputFontSize: number;
      internalScroll: boolean;
      actionReachable: boolean;
      mobileNavigationBlocked: boolean;
    };
    const focusLayoutStable =
      sheetMetrics.focusHeight === focusStart.height && sheetMetrics.focusWidth === focusStart.width;

    if (!sheetMetrics.internalScroll) {
      throw new Error(`${sheetSelector} did not preserve internal scrolling.`);
    }

    if (!sheetMetrics.actionReachable) {
      throw new Error(`${sheetSelector} did not keep its final action reachable inside the sheet.`);
    }

    if (!sheetMetrics.mobileNavigationBlocked) {
      throw new Error(`${sheetSelector} did not prevent mobile navigation interference.`);
    }

    if (!focusLayoutStable || sheetMetrics.inputFontSize < 16) {
      throw new Error(`${sheetSelector} input focus changed the mobile viewport or exposed zoom-prone text.`);
    }

    await mainWindow.webContents.executeJavaScript(`
      (() => {
        const backdropSelector = ${JSON.stringify(backdropSelector)};
        document.querySelector(backdropSelector)?.click();
      })()
    `);
    await waitForCaptureSelector(sheetSelector, false);
    await mainWindow.webContents.executeJavaScript(
      `document.querySelector(${JSON.stringify(triggerSelector)})?.click()`
    );
    await waitForCaptureSelector(sheetSelector);
  }

  async function waitForCaptureSelector(selector: string, expected = true, maximumAttempts = 60): Promise<void> {
    if (!mainWindow) {
      return;
    }

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      const found = (await mainWindow.webContents.executeJavaScript(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`
      )) as boolean;

      if (found === expected) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const context = (await mainWindow.webContents.executeJavaScript(`
      (() => ({
        catalogText: document.querySelector('.search-group-catalog')?.textContent?.trim() ?? '',
        inputValue: document.querySelector('.archive-search input')?.value ?? '',
        pendingText: [...document.querySelectorAll('.search-group-empty')].map((element) => element.textContent?.trim()),
        selector: ${JSON.stringify(selector)}
      }))()
    `)) as { catalogText: string; inputValue: string; pendingText: Array<string | undefined>; selector: string };

    throw new Error(`Capture view did not render selector: ${selector}. Context: ${JSON.stringify(context)}`);
  }

  async function captureIfRequested(captureWindow: BrowserWindow): Promise<void> {
    mainWindow = captureWindow;
    if (!mainWindow || !captureOutputPath) {
      return;
    }

    if (captureRequestedView === 'layout-stability') {
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          window.__movieLogCaptureLayoutShift = 0;
          window.__movieLogCaptureLayoutSources = [];
          window.__movieLogCaptureObservedSkeleton = Boolean(document.querySelector('.screen-loading'));
          window.__movieLogCaptureLayoutObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                window.__movieLogCaptureLayoutShift += entry.value;
                window.__movieLogCaptureLayoutSources.push({
                  sources: (entry.sources ?? []).map((source) => ({
                    currentRect: source.currentRect?.toJSON?.() ?? source.currentRect,
                    node: source.node?.className ?? source.node?.nodeName ?? '',
                    previousRect: source.previousRect?.toJSON?.() ?? source.previousRect
                  })),
                  value: entry.value
                });
              }
            }
          });
          window.__movieLogCaptureLayoutObserver.observe({ buffered: true, type: 'layout-shift' });
        })()
      `);
    }

    let isReady = false;
    let latestReadyState = '';
    let latestText = '';

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const snapshot = (await mainWindow.webContents.executeJavaScript(`
        ({
          bodyText: document.body ? document.body.innerText.toLowerCase() : '',
          readyState: document.documentElement?.dataset?.movieLogCaptureReady ?? ''
        })
      `)) as { bodyText: string; readyState: string };
      latestText = snapshot.bodyText;
      latestReadyState = snapshot.readyState;
      isReady = latestReadyState === 'true';

      if (isReady) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!isReady) {
      throw new Error(
        `Renderer content never became ready for capture. Ready state: ${latestReadyState || '[unset]'} Latest body text: ${latestText || '[empty]'}`
      );
    }

    await selectCaptureView();
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (captureRequestedView === 'layout-stability') {
      const stability = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          window.__movieLogCaptureLayoutObserver?.disconnect();
          return {
            cumulativeLayoutShift: window.__movieLogCaptureLayoutShift ?? -1,
            observedSkeleton: window.__movieLogCaptureObservedSkeleton === true,
            sources: window.__movieLogCaptureLayoutSources ?? []
          };
        })()
      `)) as {
        cumulativeLayoutShift: number;
        observedSkeleton: boolean;
        sources: Array<{ sources: unknown[]; value: number }>;
      };

      if (
        !stability.observedSkeleton ||
        stability.cumulativeLayoutShift < 0 ||
        stability.cumulativeLayoutShift > 0.01
      ) {
        throw new Error(`Installed loading layout-stability proof failed: ${JSON.stringify(stability)}`);
      }

      process.stdout.write(`installed layout stability: ${JSON.stringify(stability)}\n`);
    }

    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const layout = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const root = document.documentElement;
        const body = document.body;
        const archiveSpine = document.querySelector('.archive-spine');
        const mobileNavigation = document.querySelector('.mobile-nav');
        const overflowElements = [...document.querySelectorAll('*')]
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.width > 0 && (rect.left < -0.5 || rect.right > root.clientWidth + 0.5))
          .slice(0, 6)
          .map(({ element, rect }) =>
            [
              element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).trim().replace(/\\s+/g, '.') : ''),
              Math.round(rect.left),
              Math.round(rect.right),
              Math.round(rect.width)
            ].join(':')
          );
        return {
          archiveSpineDisplay: archiveSpine ? getComputedStyle(archiveSpine).display : '',
          clientWidth: root.clientWidth,
          mobileNavigationDisplay: mobileNavigation ? getComputedStyle(mobileNavigation).display : '',
          overflowElements,
          scrollWidth: Math.max(root.scrollWidth, body ? body.scrollWidth : 0)
        };
      })()
    `)) as {
      archiveSpineDisplay: string;
      clientWidth: number;
      mobileNavigationDisplay: string;
      overflowElements: string[];
      scrollWidth: number;
    };

    if (layout.scrollWidth > layout.clientWidth) {
      throw new Error(
        `Capture has horizontal overflow: ${layout.scrollWidth}px content in a ${layout.clientWidth}px viewport. ${layout.overflowElements.join(', ')}`
      );
    }

    if (
      captureWidth <= captureMobileNavigationBreakpoint &&
      (layout.archiveSpineDisplay !== 'none' || layout.mobileNavigationDisplay === 'none')
    ) {
      throw new Error('Mobile capture did not replace the desktop spine with the mobile navigation.');
    }

    if (
      captureWidth > captureMobileNavigationBreakpoint &&
      (layout.archiveSpineDisplay === 'none' || layout.mobileNavigationDisplay !== 'none')
    ) {
      throw new Error('Desktop capture did not keep the structural spine visible and mobile navigation hidden.');
    }

    // The first capture after a tab or focus transition can contain incomplete
    // compositor layers on macOS. Warm the surface, then reject every black or occluded frame.
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: 2, y: 2 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await mainWindow.webContents.capturePage();
    let image = await mainWindow.webContents.capturePage();

    for (let attempt = 0; attempt < 4 && isFrameOccluded(image.toBitmap(), captureWidth, captureHeight); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 140));
      mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: 2 + attempt, y: 2 + attempt });
      image = await mainWindow.webContents.capturePage();
    }

    if (isFrameOccluded(image.toBitmap(), captureWidth, captureHeight)) {
      throw new Error('Capture remained black or compositor-occluded after four settled attempts.');
    }
    const imageSize = image.getSize();

    if (imageSize.width !== captureWidth || imageSize.height !== captureHeight) {
      throw new Error(
        `Capture dimensions ${imageSize.width}x${imageSize.height} did not match ${captureWidth}x${captureHeight}.`
      );
    }

    await mkdir(dirname(captureOutputPath), { recursive: true });
    await writeFile(captureOutputPath, image.toPNG());
    if (mainWindow.webContents.debugger.isAttached()) {
      mainWindow.webContents.debugger.detach();
    }
    quitApp();
  }

  return {
    assertWritable: (operation: string) => assertCaptureWritable(captureDataMode, operation),
    beforeCatalogSearch: async () => {
      if (captureRequestedView === 'slow-catalog') {
        await new Promise((resolve) => setTimeout(resolve, 4_000));
      }
    },
    beforeReadState: async () => {
      if (captureRequestedView === 'loading') {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }

      if (captureRequestedView === 'layout-stability') {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }

      if (captureRequestedView === 'load-error') {
        throw new Error("Error invoking remote method 'movie-log:get-state': ENOENT /private/archive.json");
      }
    },
    captureIfRequested,
    forceCatalogOutage: captureRequestedView === 'catalog-outage' || captureRequestedView === 'detail-outage',
    forceCatalogPrimaryFailure: captureRequestedView === 'detail-imdb-match',
    height: captureHeight,
    isReadOnly: captureDataMode === 'real',
    isRequested: captureRequested,
    requireLiveCatalogSuccess: captureRequestedView === 'catalog' || captureRequestedView === 'detail-imdb-match',
    readLogPathOverride: async (): Promise<string[] | null> => {
      if (
        captureRequestedView !== 'log-ambiguity' &&
        captureRequestedView !== 'log-path-match' &&
        captureRequestedView !== 'log-multiple-paths'
      ) {
        return null;
      }

      const limit = captureRequestedView === 'log-path-match' ? 1 : 2;
      return (await historyStore.readState()).libraryItems.slice(0, limit).map((item) => item.sourcePath);
    },
    readWatchedFolderOverride: async (): Promise<string[] | null> =>
      watchedFolderOverride ? [watchedFolderOverride] : null,
    rendererQuery: captureRequestedView,
    transformReadState: (state: MovieLogState): MovieLogState =>
      captureRequestedView === 'empty-archive'
        ? { ...state, films: {}, history: [], libraryItems: [], watchedFolders: [] }
        : state,
    width: captureWidth
  };
}

export type CaptureController = ReturnType<typeof createCaptureController>;

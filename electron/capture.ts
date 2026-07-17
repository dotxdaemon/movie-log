// ABOUTME: Owns installed-app capture profiles, interaction replay, and fail-closed screenshot validation.
// ABOUTME: Keeps proof-only automation outside the production Electron lifecycle and IPC entrypoint.
import type { BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import type { MovieLogState, WatchEntry } from '../shared/types.js';

interface CaptureControllerOptions {
  historyStore: { readState(): Promise<MovieLogState> };
  quitApp(): void;
  readState(): Promise<MovieLogState>;
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

export function createCaptureController({ historyStore, quitApp, readState }: CaptureControllerOptions) {
  let mainWindow: BrowserWindow | null = null;
  const captureRequested = Boolean(process.env.MOVIE_LOG_CAPTURE_PATH);
  const captureWidth = Number(process.env.MOVIE_LOG_CAPTURE_WIDTH ?? 1180);
  const captureHeight = Number(process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? 788);
  const captureRequestedView = process.env.MOVIE_LOG_CAPTURE_VIEW ?? 'diary';
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
    'detail-missing',
    'detail-outage',
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
    'performance',
    'retry-backoff-verify'
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

  async function selectCaptureView(): Promise<void> {
    if (!mainWindow) {
      return;
    }

    const logActionSelector = captureWidth <= 700 ? '.header-log-action' : '.archive-spine .log-action';
    const initialRawHistoryCount = (await historyStore.readState()).history.length;
    const navigationSelector = captureWidth <= 700 ? '.mobile-nav-item' : '.nav-item';
    const selected = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const requestedView = ${JSON.stringify(captureRequestedView)};
        const logActionSelector = ${JSON.stringify(logActionSelector)};
        const navigationSelector = ${JSON.stringify(navigationSelector)};
        const readLabel = (element) =>
          (element.getAttribute('aria-label') || element.textContent || '').trim().toLowerCase();
        const navigationItems = [...document.querySelectorAll(navigationSelector)];

        if (requestedView === 'performance') {
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
          requestedView === 'detail-missing' ||
          requestedView === 'detail-outage' ||
          requestedView === 'filters' ||
          requestedView.startsWith('library') ||
          requestedView === 'aggregation-verify'
        ) {
          navigationItems.find((item) => readLabel(item).includes('library'))?.click();
          return true;
        }

        if (!requestedView.startsWith('diary')) {
          const navigationView = requestedView.startsWith('statistics') ? 'statistics' : requestedView;
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

          for (const label of ['library', 'search', 'statistics', 'settings', 'diary']) {
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
      const filterSurface = captureWidth <= 700 ? '.filter-sheet' : '.filter-toolbar';

      if (captureWidth <= 700) {
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

      if (captureWidth <= 700) {
        await waitForCaptureSelector('.filter-sheet', false);
      }

      if (captureRequestedView === 'library-empty') {
        await waitForCaptureSelector('.library-film-field .blank-slate');
      }

      if (captureRequestedView === 'library-filtered' && captureWidth > 700) {
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
          const diaryItem = [...document.querySelectorAll(${JSON.stringify(navigationSelector)})]
            .find((item) => (item.getAttribute('aria-label') || item.textContent || '').trim().toLowerCase().includes('diary'));
          diaryItem?.click();
        })()
      `);
      await waitForCaptureSelector('.diary-view');
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
          return Boolean(document.querySelector('.diary-view') && document.activeElement === searchItem);
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

    if (captureWidth <= 700 && (captureRequestedView === 'log' || captureRequestedView === 'log-selected')) {
      await verifyMobileSheetLifecycle({
        backdropSelector: '.log-backdrop',
        bodySelector: '.log-sheet-body',
        inputSelector: '.film-search-block input, .log-sheet input',
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
        backdropSelector: '.filter-sheet-backdrop',
        bodySelector: '.filter-sheet-body',
        inputSelector: '.filter-sheet select',
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

    if (
      captureRequestedView === 'detail' ||
      captureRequestedView === 'detail-missing' ||
      captureRequestedView === 'detail-outage'
    ) {
      const movieSelector = '.movie-card:has(.poster-art) .movie-card-face';
      const selectedMovie = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const face =
            ${JSON.stringify(captureRequestedView)} === 'detail-missing'
              ? [...document.querySelectorAll('.movie-card:not(:has(.poster-art)) .movie-card-face')]
                  .sort((left, right) => (right.textContent?.length ?? 0) - (left.textContent?.length ?? 0))[0]
              : document.querySelector(${JSON.stringify(movieSelector)});
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
          const readChannels = (value) => value.match(/\\d+(?:\\.\\d+)?/g)?.map(Number) ?? [];
          const background = mark ? readChannels(getComputedStyle(mark).backgroundColor).slice(0, 3) : [];
          const foreground = readout ? readChannels(getComputedStyle(readout).color) : [];
          const readoutBackground = readout ? readChannels(getComputedStyle(readout).backgroundColor) : [];
          return {
            background,
            checked: input?.checked === true,
            foreground,
            output: output?.textContent?.trim() ?? '',
            readoutBackground
          };
        })()
      `)) as {
        background: number[];
        checked: boolean;
        foreground: number[];
        output: string;
        readoutBackground: number[];
      };
      const ratingSelectionVisible =
        ratingSelectionState.checked &&
        ratingSelectionState.output === 'Current 4.0' &&
        ratingSelectionState.background.length === 3 &&
        ratingSelectionState.background.every((channel) => channel < 80) &&
        ratingSelectionState.foreground.length === 3 &&
        ratingSelectionState.foreground.every((channel) => channel > 230) &&
        ratingSelectionState.readoutBackground.length === 4 &&
        ratingSelectionState.readoutBackground[3] === 0;

      if (!ratingSelectionVisible) {
        throw new Error(
          `Log dialog did not expose the selected 4.0 rating value with its high-contrast selection plate: ${JSON.stringify(ratingSelectionState)}`
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
      await waitForCaptureSelector('.diary-view');
      const savedEntry = (await historyStore.readState()).history.find(
        (entry) => entry.review === persistenceProof.review
      );

      if (!entryMatchesPersistenceProof(savedEntry)) {
        throw new Error('The installed Log Film flow did not persist every annotation exactly.');
      }

      if (process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH) {
        await writeFile(
          process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH,
          `${JSON.stringify(savedEntry, null, 2)}\n`,
          'utf8'
        );
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
      const editingOpened = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const proofReview = ${JSON.stringify(persistenceProof.review)};
          const article = [...document.querySelectorAll('.diary-entry')]
            .find((candidate) => candidate.textContent?.includes(proofReview));
          article?.querySelector('.entry-expand summary')?.click();
          return Boolean(article);
        })()
      `)) as boolean;

      if (!editingOpened) {
        throw new Error('The saved persistence entry was not available for installed-app editing.');
      }

      await waitForCaptureSelector('.entry-expand[open] .entry-form');
      const editAccepted = (await mainWindow.webContents.executeJavaScript(`
        (() => {
          const originalReview = ${JSON.stringify(persistenceProof.review)};
          const edit = ${JSON.stringify(persistenceEditProof)};
          const article = [...document.querySelectorAll('.diary-entry')]
            .find((candidate) => candidate.textContent?.includes(originalReview));
          const form = article?.querySelector('.entry-form');
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
        throw new Error('The installed diary edit form did not accept the persistence proof update.');
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
        throw new Error('The installed diary edit did not persist every changed field exactly.');
      }

      if (process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH) {
        await writeFile(
          process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH,
          `${JSON.stringify(editedEntry, null, 2)}\n`,
          'utf8'
        );
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
      'aggregation-verify': '.movie-dossier',
      catalog: '.search-view',
      'catalog-outage': '.catalog-error',
      detail: '.movie-dossier',
      'detail-missing': '.movie-dossier',
      'detail-outage': '.dossier-match-error',
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
      'log-path-match': '.diary-view',
      'log-multiple-paths': '.diary-view',
      'log-rating-none': '.rating-none:has(input:focus-visible)',
      'log-rating-numeric': '.rating-segment:has(input:focus-visible)',
      'metadata-retry': '.status-banner',
      loading: '.screen-loading',
      'load-error': '.error-state',
      'persistence-save': '.diary-view',
      'persistence-verify': '.diary-view',
      'persistence-edit': '.diary-view',
      'persistence-edit-verify': '.diary-view',
      performance: '.search-result',
      'retry-backoff-verify': '.metadata-retry',
      search: '.search-view',
      'search-results': '.search-result',
      'search-long': '.search-result-active',
      settings: '.settings-view',
      statistics: '.statistics-view',
      'statistics-lower': '.activity-panel'
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
    backdropSelector,
    bodySelector,
    inputSelector,
    sheetSelector,
    triggerSelector
  }: {
    backdropSelector: string;
    bodySelector: string;
    inputSelector: string;
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
        const body = document.querySelector(${JSON.stringify(bodySelector)});
        const input = document.querySelector(${JSON.stringify(inputSelector)});
        const mobileNavigation = document.querySelector('.mobile-nav');
        const navigationBounds = mobileNavigation?.getBoundingClientRect();
        const navigationTarget = navigationBounds
          ? document.elementFromPoint(navigationBounds.left + navigationBounds.width / 2, navigationBounds.top + navigationBounds.height / 2)
          : null;
        const internalScroll = Boolean(body && body.scrollHeight > body.clientHeight);

        if (body) {
          body.scrollTop = Math.min(48, body.scrollHeight - body.clientHeight);
        }

        const scrolled = Boolean(body && body.scrollTop > 0);

        if (body) {
          body.scrollTop = 0;
        }

        return {
          focusHeight: window.visualViewport?.height ?? window.innerHeight,
          focusWidth: window.visualViewport?.width ?? window.innerWidth,
          inputFontSize: input ? Number.parseFloat(getComputedStyle(input).fontSize) : 0,
          internalScroll: internalScroll && scrolled,
          mobileNavigationBlocked:
            Boolean(backdrop && mobileNavigation && !navigationTarget?.closest('.mobile-nav')) &&
            Number(getComputedStyle(backdrop).zIndex) > Number(getComputedStyle(mobileNavigation).zIndex)
        };
      })()
    `)) as {
      focusHeight: number;
      focusWidth: number;
      inputFontSize: number;
      internalScroll: boolean;
      mobileNavigationBlocked: boolean;
    };
    const focusLayoutStable =
      sheetMetrics.focusHeight === focusStart.height && sheetMetrics.focusWidth === focusStart.width;

    if (!sheetMetrics.internalScroll) {
      throw new Error(`${sheetSelector} did not preserve internal scrolling.`);
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
    if (!mainWindow || !process.env.MOVIE_LOG_CAPTURE_PATH) {
      return;
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

    if (captureWidth <= 700 && (layout.archiveSpineDisplay !== 'none' || layout.mobileNavigationDisplay === 'none')) {
      throw new Error('Mobile capture did not replace the desktop spine with the mobile navigation.');
    }

    if (captureWidth > 700 && (layout.archiveSpineDisplay === 'none' || layout.mobileNavigationDisplay !== 'none')) {
      throw new Error('Desktop capture did not keep the structural spine visible and mobile navigation hidden.');
    }

    // The first capture after a tab or focus transition can contain incomplete
    // compositor layers on macOS. Warm the surface, then reject every black or occluded frame.
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

    await mkdir(dirname(process.env.MOVIE_LOG_CAPTURE_PATH), { recursive: true });
    await writeFile(process.env.MOVIE_LOG_CAPTURE_PATH, image.toPNG());
    quitApp();
  }

  return {
    beforeReadState: async () => {
      if (captureRequestedView === 'loading') {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }

      if (captureRequestedView === 'load-error') {
        throw new Error("Error invoking remote method 'movie-log:get-state': ENOENT /private/archive.json");
      }
    },
    captureIfRequested,
    forceCatalogOutage: captureRequestedView === 'catalog-outage' || captureRequestedView === 'detail-outage',
    height: captureHeight,
    isRequested: captureRequested,
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
    rendererQuery: captureRequestedView,
    width: captureWidth
  };
}

export type CaptureController = ReturnType<typeof createCaptureController>;

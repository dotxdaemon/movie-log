// ABOUTME: Runs the Electron desktop shell, local JSON store, and watched-folder integrations.
// ABOUTME: Bridges native dialogs and file watching to the React renderer through a small IPC surface.
import { Menu, Tray, app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, screen, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createFilmCatalog } from './film-catalog.js';
import { createFilmIndex, type FilmEnrichmentRequest } from './film-index.js';
import { createFolderMonitor } from './folder-monitor.js';
import { addWatchedFolderPath, logPathsFromDrop, searchCatalogWithFallback } from './main-actions.js';
import { handleMovieLogWindowsClosed, showMovieLog } from './app-lifecycle.js';
import { prepareAppRuntime } from './runtime.js';
import { scanFolderContents } from './folder-scan.js';
import { createStatusItem } from './status-item.js';
import { createHistoryStore } from './store.js';
import { createWatchedFolderSync } from './watched-folder-sync.js';
import { revealWindow } from './window-visibility.js';
import { closeMovieLog, handleWindowCloseRequest } from './window-close.js';
import { buildFilmSourcePath, parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type {
  EntryDetails,
  EntryKind,
  LogEntryDetails,
  LogFilmRequest,
  MovieLogState,
  WatchEntry
} from '../shared/types.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
prepareAppRuntime(app, {
  showWindow: () => {
    void showMainWindow();
  }
});
const dataDirectory = process.env.MOVIE_LOG_DATA_DIR ?? join(app.getPath('userData'), 'movie-log');
const historyStore = createHistoryStore(dataDirectory);
const filmCatalog = createFilmCatalog();
const filmIndex = createFilmIndex({ catalog: filmCatalog, dataDirectory });
let filmEnrichmentRunning = false;
let watchedFolderSync: ReturnType<typeof createWatchedFolderSync>;
const folderMonitor = createFolderMonitor({
  loadKnownPaths: historyStore.readKnownPaths,
  saveKnownPaths: historyStore.writeKnownPaths,
  onChange: async (folderPath) => {
    await watchedFolderSync.queueRefresh(folderPath);
  }
});

let mainWindow: BrowserWindow | null = null;
let backgroundWorkRunning = false;
let isQuitting = false;
let statusItem: Tray | null = null;
const captureRequested = Boolean(process.env.MOVIE_LOG_CAPTURE_PATH);
const captureWidth = Number(process.env.MOVIE_LOG_CAPTURE_WIDTH ?? 1180);
const captureHeight = Number(process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? 788);
const captureRequestedView = process.env.MOVIE_LOG_CAPTURE_VIEW ?? 'diary';
const captureViews = new Set([
  'diary',
  'diary-ledger',
  'diary-grid',
  'library',
  'library-filtered',
  'library-empty',
  'library-selected',
  'filters',
  'search',
  'search-long',
  'catalog',
  'catalog-outage',
  'statistics',
  'settings',
  'detail',
  'detail-missing',
  'log',
  'log-selected',
  'persistence-save',
  'persistence-verify'
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

async function createEntryForPath(
  itemPath: string,
  source: 'drop' | 'watch',
  details: LogEntryDetails = {}
): Promise<WatchEntry | null> {
  const itemStats = await stat(itemPath);
  const sourceKind: EntryKind = itemStats.isDirectory() ? 'directory' : 'file';

  if (!isTrackableMediaItem(itemPath, sourceKind)) {
    return null;
  }

  const { watchedAt = new Date().toISOString(), ...annotations } = details;
  return {
    ...createEntryFromPath(itemPath, source, watchedAt, sourceKind),
    ...annotations,
    tags: annotations.tags ? [...annotations.tags] : undefined
  };
}

async function readState(): Promise<MovieLogState> {
  const [state, films] = await Promise.all([historyStore.readState(), filmIndex.readFilms()]);
  return { ...state, films };
}

function collectFilmRequests(state: MovieLogState): FilmEnrichmentRequest[] {
  const requests = new Map<string, FilmEnrichmentRequest>();
  const titles = [...state.history.map((entry) => entry.title), ...state.libraryItems.map((item) => item.title)];

  for (const stem of titles) {
    const parsed = parseFilmTitle(stem);

    if (!parsed.title) {
      continue;
    }

    const key = readFilmKey(parsed);

    if (!requests.has(key)) {
      requests.set(key, { key, title: parsed.title, year: parsed.year });
    }
  }

  return [...requests.values()];
}

async function enrichFilms(): Promise<void> {
  if (filmEnrichmentRunning) {
    return;
  }

  filmEnrichmentRunning = true;

  try {
    const state = await historyStore.readState();
    const changed = await filmIndex.enrichFilms(collectFilmRequests({ ...state, films: {} }));

    if (changed) {
      await broadcastState();
    }
  } catch {
    return;
  } finally {
    filmEnrichmentRunning = false;
  }
}

async function broadcastState(): Promise<void> {
  const windowToNotify = mainWindow;

  if (!windowToNotify) {
    return;
  }

  const state = await readState();

  if (windowToNotify.isDestroyed() || windowToNotify.webContents.isDestroyed()) {
    return;
  }

  windowToNotify.webContents.send('movie-log:state-changed', state);
}

async function openPath(itemPath: string): Promise<void> {
  const errorMessage = await shell.openPath(itemPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function selectCaptureView(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const logActionSelector = captureWidth <= 700 ? '.mobile-log-action' : '.archive-spine .log-action';
  const selected = (await mainWindow.webContents.executeJavaScript(`
    (() => {
      const requestedView = ${JSON.stringify(captureRequestedView)};
      const logActionSelector = ${JSON.stringify(logActionSelector)};
      const readLabel = (element) => element.textContent?.trim().toLowerCase() ?? '';
      const navigationItems = [...document.querySelectorAll('.nav-item')];

      if (requestedView === 'log' || requestedView === 'log-selected' || requestedView === 'persistence-save') {
        const action = document.querySelector(logActionSelector);
        action?.focus();
        action?.click();
        return true;
      }

      if (requestedView === 'catalog' || requestedView === 'catalog-outage' || requestedView === 'search-long') {
        const searchItem = navigationItems.find((item) => readLabel(item).includes('search'));
        searchItem?.focus();
        searchItem?.click();
        return true;
      }

      if (
        requestedView === 'detail' ||
        requestedView === 'detail-missing' ||
        requestedView === 'filters' ||
        requestedView.startsWith('library')
      ) {
        navigationItems.find((item) => readLabel(item).includes('library'))?.click();
        return true;
      }

      if (!requestedView.startsWith('diary')) {
        navigationItems.find((item) => readLabel(item).includes(requestedView))?.click();
      }

      return true;
    })()
  `)) as boolean;

  if (!selected) {
    throw new Error(`Capture view did not render: ${captureRequestedView}.`);
  }

  await new Promise((resolve) => setTimeout(resolve, 180));

  if (captureRequestedView === 'diary-ledger' || captureRequestedView === 'diary-grid') {
    const requestedMode = captureRequestedView === 'diary-ledger' ? 'ledger' : 'grid';
    await mainWindow.webContents.executeJavaScript(`
      [...document.querySelectorAll('.view-switcher [role="tab"]')]
        .find((tab) => tab.textContent?.trim().toLowerCase() === ${JSON.stringify(requestedMode)})
        ?.click()
    `);
    await waitForCaptureSelector(`#diary-panel-${requestedMode}`);
  }

  if (captureRequestedView === 'library-filtered' || captureRequestedView === 'library-empty') {
    await mainWindow.webContents.executeJavaScript(`document.querySelector('.header-filters')?.click()`);
    await waitForCaptureSelector('.filter-sheet');
    const filtered = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const setCaptureSelect = (selector, value) => {
          const select = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter?.call(select, value);
          select?.dispatchEvent(new Event('change', { bubbles: true }));
        };

        if (${JSON.stringify(captureRequestedView)} === 'library-empty') {
          setCaptureSelect('.filter-sheet select[name="rating"]', '4.5-plus');
        } else {
          const genre = document.querySelector('.filter-sheet select[name="genre"]');
          const value = genre?.options[1]?.value ?? '';
          setCaptureSelect('.filter-sheet select[name="genre"]', value);
        }

        document.querySelector('.filter-sheet-actions button:last-child')?.click();
        return true;
      })()
    `)) as boolean;

    if (!filtered) {
      throw new Error(`Capture view did not apply filters: ${captureRequestedView}.`);
    }

    await waitForCaptureSelector('.filter-sheet', false);

    if (captureRequestedView === 'library-empty') {
      await waitForCaptureSelector('.library-film-field .blank-slate');
    }
  }

  if (captureRequestedView === 'search-long') {
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

    await mainWindow.webContents.executeJavaScript(`
      document.querySelector('.archive-search input')?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
      )
    `);
    await waitForCaptureSelector('.search-view', false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const searchFocusRestored = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const searchItem = [...document.querySelectorAll('.nav-item')]
          .find((item) => item.textContent?.trim().toLowerCase().includes('search'));
        return Boolean(document.querySelector('.diary-view') && document.activeElement === searchItem);
      })()
    `)) as boolean;

    if (!searchFocusRestored) {
      throw new Error('Search Escape did not return to the previous view and restore focus to its opener.');
    }

    await mainWindow.webContents.executeJavaScript(`
      (() => {
        const searchItem = [...document.querySelectorAll('.nav-item')]
          .find((item) => item.textContent?.trim().toLowerCase().includes('search'));
        searchItem?.focus();
        searchItem?.click();
      })()
    `);
    await waitForCaptureSelector('.search-view');

    if (!((await mainWindow.webContents.executeJavaScript(moveToLongSearchResult)) as boolean)) {
      throw new Error('Long Search keyboard navigation did not remain visible after reopening Search.');
    }
  }

  if (
    captureRequestedView === 'log' ||
    captureRequestedView === 'log-selected' ||
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

  if (captureRequestedView === 'log-selected' || captureRequestedView === 'persistence-save') {
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

  if (captureRequestedView === 'detail' || captureRequestedView === 'detail-missing') {
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
  }

  if (
    captureRequestedView === 'log' ||
    captureRequestedView === 'log-selected' ||
    captureRequestedView === 'persistence-save'
  ) {
    const ratingSelectionVisible = (await mainWindow.webContents.executeJavaScript(`
      (() => {
        const input = document.querySelectorAll('.log-sheet .rating-segment input')[7];
        input?.click();
        const output = document.querySelector('.log-sheet .rating-current-option[data-rating="4.0"]');
        return input?.checked === true && output?.textContent?.trim() === 'Current 4.0' && getComputedStyle(output).display !== 'none';
      })()
    `)) as boolean;

    if (!ratingSelectionVisible) {
      throw new Error('Log dialog did not expose the selected 4.0 rating value.');
    }
  }

  if (captureRequestedView === 'persistence-save') {
    await mainWindow.webContents.executeJavaScript(`
      document.querySelector('.log-sheet .entry-form button[type="submit"]')?.click()
    `);
    await waitForCaptureSelector('.log-sheet', false);
    await waitForCaptureSelector('.diary-view');
  }

  if (captureRequestedView === 'persistence-verify') {
    const expectedEntryId = process.env.MOVIE_LOG_PERSISTENCE_ENTRY_ID;

    if (!expectedEntryId) {
      throw new Error('Persistence verification requires MOVIE_LOG_PERSISTENCE_ENTRY_ID.');
    }

    const entrySurvivedRelaunch = (await mainWindow.webContents.executeJavaScript(`
      window.movieLog.getState().then((state) =>
        state.history.some((entry) => entry.id === ${JSON.stringify(expectedEntryId)})
      )
    `)) as boolean;

    if (!entrySurvivedRelaunch) {
      throw new Error('The scratch Log Film entry did not survive the installed-app relaunch.');
    }
  }

  const viewSelector = {
    catalog: '.search-view',
    'catalog-outage': '.catalog-error',
    detail: '.movie-dossier',
    'detail-missing': '.movie-dossier',
    diary: '.diary-view',
    'diary-grid': '#diary-panel-grid',
    'diary-ledger': '#diary-panel-ledger',
    filters: '.filter-sheet',
    library: '.library-view',
    'library-empty': '.library-film-field .blank-slate',
    'library-filtered': '.library-view',
    'library-selected': '.library-inspector',
    log: '.log-sheet',
    'log-selected': '.selected-film',
    'persistence-save': '.diary-view',
    'persistence-verify': '.diary-view',
    search: '.search-view',
    'search-long': '.search-result-active',
    settings: '.settings-view',
    statistics: '.statistics-view'
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
  await mainWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(triggerSelector)})?.click()`);
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

async function captureIfRequested(): Promise<void> {
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
  const layout = (await mainWindow.webContents.executeJavaScript(`
    (() => {
      const root = document.documentElement;
      const body = document.body;
      const archiveSpine = document.querySelector('.archive-spine');
      const mobileNavigation = document.querySelector('.mobile-nav');
      return {
        archiveSpineDisplay: archiveSpine ? getComputedStyle(archiveSpine).display : '',
        clientWidth: root.clientWidth,
        mobileNavigationDisplay: mobileNavigation ? getComputedStyle(mobileNavigation).display : '',
        scrollWidth: Math.max(root.scrollWidth, body ? body.scrollWidth : 0)
      };
    })()
  `)) as {
    archiveSpineDisplay: string;
    clientWidth: number;
    mobileNavigationDisplay: string;
    scrollWidth: number;
  };

  if (layout.scrollWidth > layout.clientWidth) {
    throw new Error(
      `Capture has horizontal overflow: ${layout.scrollWidth}px content in a ${layout.clientWidth}px viewport.`
    );
  }

  if (captureWidth <= 700 && (layout.archiveSpineDisplay !== 'none' || layout.mobileNavigationDisplay === 'none')) {
    throw new Error('Mobile capture did not replace the desktop spine with the mobile navigation.');
  }

  if (captureWidth > 700 && (layout.archiveSpineDisplay === 'none' || layout.mobileNavigationDisplay !== 'none')) {
    throw new Error('Desktop capture did not keep the structural spine visible and mobile navigation hidden.');
  }

  const image = await mainWindow.webContents.capturePage();
  const imageSize = image.getSize();

  if (imageSize.width !== captureWidth || imageSize.height !== captureHeight) {
    throw new Error(
      `Capture dimensions ${imageSize.width}x${imageSize.height} did not match ${captureWidth}x${captureHeight}.`
    );
  }

  await mkdir(dirname(process.env.MOVIE_LOG_CAPTURE_PATH), { recursive: true });
  await writeFile(process.env.MOVIE_LOG_CAPTURE_PATH, image.toPNG());
  app.quit();
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: captureRequested ? captureWidth : 1180,
    height: captureRequested ? captureHeight : 820,
    minWidth: 390,
    minHeight: 640,
    useContentSize: captureRequested,
    backgroundColor: '#f5f3f6',
    title: 'Movie Log',
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs')
    }
  });

  if (process.env.MOVIE_LOG_CAPTURE_PATH) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.error(`renderer: ${message}`);
    });

    mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error(`preload-error: ${preloadPath} ${error.message}`);
    });
  }

  mainWindow.webContents.once('did-finish-load', () => {
    void broadcastState();
    void enrichFilms();
    void captureIfRequested().catch((error) => {
      console.error(error);
      app.exit(1);
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(currentDirectory, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    handleWindowCloseRequest({
      closeWindow: () => {
        mainWindow?.destroy();
      },
      hideWindow: () => {
        mainWindow?.hide();
      },
      isCaptureRun: Boolean(process.env.MOVIE_LOG_CAPTURE_PATH),
      isQuitting,
      preventDefault: () => event.preventDefault()
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function showMainWindow(): Promise<void> {
  await showMovieLog({
    createWindow,
    hasWindow: mainWindow !== null,
    revealWindow: () => {
      if (!mainWindow) {
        return;
      }

      const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      revealWindow(mainWindow, activeDisplay.workArea);
    },
    startBackgroundWork
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('movie-log:add-watched-folders', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    const folders = [];

    for (const selectedPath of result.filePaths) {
      const folder = await addWatchedFolderPath(selectedPath, {
        queueFolderRefresh: async (folderPath) => {
          await watchedFolderSync.queueRefresh(folderPath);
        },
        removeWatchedFolder: async (folderId) => historyStore.removeWatchedFolder(folderId),
        saveWatchedFolder: async (folderPath) => historyStore.addWatchedFolder(folderPath),
        unwatchFolder: async (folderPath) => {
          await folderMonitor.unwatchFolder(folderPath);
        },
        watchFolder: async (folderPath) => {
          await folderMonitor.watchFolder(folderPath);
        }
      });
      folders.push(folder);
    }

    await broadcastState();
    void enrichFilms();
    return folders;
  });

  ipcMain.handle('movie-log:copy-path', async (_event, itemPath: string) => {
    clipboard.writeText(itemPath);
  });

  ipcMain.handle('movie-log:choose-log-paths', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory', 'multiSelections']
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('movie-log:get-data-file-path', async () => historyStore.getDataFilePath());

  ipcMain.handle('movie-log:get-note-file-path', async () => historyStore.getNoteFilePath());

  ipcMain.handle('movie-log:get-state', async () => readState());

  ipcMain.handle('movie-log:log-paths', async (_event, paths: string[], details?: LogEntryDetails) => {
    const result = await logPathsFromDrop(paths, {
      addHistoryEntries: async (entries) => historyStore.addHistoryEntries(entries),
      broadcastState,
      createEntryForPath: async (itemPath) => createEntryForPath(itemPath, 'drop', details)
    });
    void enrichFilms();
    return result;
  });

  ipcMain.handle('movie-log:log-film', async (_event, film: LogFilmRequest, details?: LogEntryDetails) => {
    const { watchedAt = new Date().toISOString(), ...annotations } = details ?? {};
    const sourcePath = buildFilmSourcePath({ title: film.title, year: film.year }, film.pageId);
    const entry: WatchEntry = {
      ...createEntryFromPath(sourcePath, 'drop', watchedAt, 'directory'),
      ...annotations,
      tags: annotations.tags ? [...annotations.tags] : undefined
    };
    await historyStore.addHistoryEntry(entry);

    try {
      await filmIndex.matchFilm(readFilmKey({ title: film.title, year: film.year }), film, film.pageId);
    } catch {
      // The diary entry is saved even when the catalog is unreachable; metadata fills in on the next enrichment.
    }

    await broadcastState();
  });

  ipcMain.handle('movie-log:search-catalog', async (_event, query: string) => {
    const captureCatalogOutage = captureRequestedView === 'catalog-outage';
    return searchCatalogWithFallback(query, {
      searchCachedFilms: captureCatalogOutage ? async () => [] : filmIndex.searchFilms,
      searchLiveFilms: captureCatalogOutage
        ? async () => {
            throw new Error('Catalog connection unavailable.');
          }
        : filmCatalog.searchFilms
    });
  });

  ipcMain.handle(
    'movie-log:match-film',
    async (_event, filmKey: string, film: { title: string; year: number | null }, pageId: number | null) => {
      await filmIndex.matchFilm(filmKey, film, pageId);
      await broadcastState();
    }
  );

  ipcMain.handle('movie-log:update-entry', async (_event, entryId: string, details: EntryDetails) => {
    const entry = await historyStore.updateHistoryEntry(entryId, details);

    if (entry) {
      await broadcastState();
    }

    return entry;
  });

  ipcMain.handle('movie-log:open-in-finder', async (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath);
  });

  ipcMain.handle('movie-log:open-item', async (_event, itemPath: string) => {
    await openPath(itemPath);
  });

  ipcMain.handle('movie-log:scan-now', async () => {
    await watchedFolderSync.refreshWatchedFolders();
    void enrichFilms();
  });

  ipcMain.handle('movie-log:remove-watched-folder', async (_event, folderId: string) => {
    const removedFolder = await historyStore.removeWatchedFolder(folderId);

    if (removedFolder) {
      watchedFolderSync.forgetFolder(removedFolder.path);
      await folderMonitor.unwatchFolder(removedFolder.path);
      await broadcastState();
    }
  });
}

async function startExistingWatchers(): Promise<void> {
  await watchedFolderSync.catchUpWatchedFolders();
}

async function startBackgroundWork(): Promise<void> {
  if (backgroundWorkRunning) {
    return;
  }

  await startExistingWatchers();
  backgroundWorkRunning = true;
}

async function pauseBackgroundWork(): Promise<void> {
  if (!backgroundWorkRunning) {
    return;
  }

  await folderMonitor.dispose();
  backgroundWorkRunning = false;
}

app.whenReady().then(async () => {
  watchedFolderSync = createWatchedFolderSync({
    broadcastState: async () => {
      await broadcastState();
      void enrichFilms();
    },
    listWatchedFolders: async () => (await readState()).watchedFolders,
    now: () => new Date().toISOString(),
    saveFolderContents: async (folderPath, items, scannedAt) => {
      await historyStore.syncWatchedFolderContents(folderPath, items, scannedAt);
    },
    scanFolder: scanFolderContents,
    watchFolder: async (folderPath) => {
      await folderMonitor.watchFolder(folderPath);
    }
  });
  registerIpcHandlers();
  await startBackgroundWork();
  statusItem = createStatusItem({
    TrayConstructor: Tray,
    imageFactory: nativeImage,
    menu: Menu,
    quitApp: () => app.quit(),
    showWindow: () => {
      void showMainWindow();
    }
  });
  await createWindow();
});

app.on('activate', () => {
  void showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  statusItem?.destroy();
  statusItem = null;
});

app.on('window-all-closed', () => {
  void handleMovieLogWindowsClosed({
    closeMovieLog: () =>
      closeMovieLog({
        disposeFolderMonitor: () => folderMonitor.dispose(),
        quitApp: () => app.quit()
      }),
    hasStatusItem: statusItem !== null,
    isQuitting,
    pauseBackgroundWork
  });
});

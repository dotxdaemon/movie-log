// ABOUTME: Verifies that screenshot capture uses the real Movie Log data directory instead of seeded fixture data.
// ABOUTME: Reads the live capture pipeline source so fake screenshot titles and fake data overrides cannot return silently.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const captureScript = readFileSync(new URL('../scripts/capture.mjs', import.meta.url), 'utf8');
const packagedCaptureScript = readFileSync(new URL('../scripts/capture-packaged.mjs', import.meta.url), 'utf8');
const captureProcess = readFileSync(new URL('../electron/capture.ts', import.meta.url), 'utf8');
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};
const mainProcess = readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
const mainWindow = readFileSync(new URL('../electron/main-window.ts', import.meta.url), 'utf8');

describe('capture pipeline', () => {
  it('does not force seeded fixture data or require seeded titles before screenshot capture', () => {
    expect(captureScript).not.toContain('MOVIE_LOG_DATA_DIR');
    expect(packagedCaptureScript).not.toMatch(/MOVIE_LOG_DATA_DIR\s*:/);
    expect(captureScript).not.toContain('Severance');
    expect(packagedCaptureScript).not.toContain('Severance');
    expect(captureScript).not.toContain('The Brutalist');
    expect(packagedCaptureScript).not.toContain('The Brutalist');
    expect(captureProcess).not.toContain("latestText.includes('media inbox')");
    expect(captureProcess).not.toContain("latestText.includes('severance')");
    expect(captureProcess).not.toContain("latestText.includes('the brutalist')");
  });

  it('fails closed on stale packaged screenshots and stops any resident packaged app first', () => {
    expect(packagedCaptureScript).toContain('pkill');
    expect(packagedCaptureScript).toContain('rm(capturePath');
    expect(packagedCaptureScript).toContain('stat(capturePath');
    expect(packagedCaptureScript).toContain('captureStartedAt');
    expect(packagedCaptureScript).toContain('overallTimeoutMs');
    expect(packagedCaptureScript).toContain('terminateProcessTree');
    expect(packagedCaptureScript).toContain('process.kill(-child.pid');
    expect(packagedCaptureScript).toContain('capture stage:');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_DATA_MODE');
    expect(packagedCaptureScript).toContain('data-${captureDataMode}');
    expect(packagedCaptureScript).toContain('readPngDimensions');
    expect(packagedCaptureScript).toContain('installedAppPath');
    expect(packagedCaptureScript).toContain('resolveInstalledAppPath');
    expect(packagedCaptureScript).toContain("'Contents', 'MacOS', 'Electron'");
    expect(packagedCaptureScript).not.toContain("join(process.cwd(), 'release', 'mac', 'Movie Log.app'");
    expect(packageManifest.scripts['open:mac']).toContain('/Applications/Movie Log.app');
  });

  it('supports exact installed-app capture profiles and rejects overflow or wrong dimensions', () => {
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_PATH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_WIDTH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_HEIGHT');
    expect(mainWindow).toContain('useContentSize');
    expect(captureProcess).toContain('scrollWidth');
    expect(captureProcess).toContain('clientWidth');
    expect(captureProcess).toContain('image.getSize()');
    expect(captureProcess).toContain('Capture dimensions');
    expect(captureProcess).toContain('horizontal overflow');
    expect(captureProcess).toContain('isFrameOccluded');
  });

  it('can select every product surface before taking installed-app proof', () => {
    expect(captureProcess).toContain('MOVIE_LOG_CAPTURE_VIEW');
    expect(captureProcess).toContain("'.nav-item'");
    expect(captureProcess).toContain("'.movie-card:has(.poster-art) .movie-card-face'");
    expect(captureProcess).toContain("'.movie-card-selected .movie-card-face'");
    expect(captureProcess).toContain("'.log-sheet'");
    expect(captureProcess).toContain('Capture view did not render');
    expect(mainProcess).not.toContain('const captureViews');
  });

  it('keeps the executable entrypoint as coordination instead of embedded window, IPC, or capture implementations', () => {
    expect(mainProcess).toContain('registerMovieLogIpcHandlers');
    expect(mainProcess).toContain('createMovieLogWindow');
    expect(mainProcess).toContain('createCatalogOrchestrator');
    expect(mainProcess).not.toContain('ipcMain.handle');
    expect(mainProcess).not.toContain('new BrowserWindow');
    expect(mainProcess.split('\n').length).toBeLessThan(220);
  });

  it('can open the mobile library filter sheet before capture', () => {
    expect(captureProcess).toContain("'filters'");
    expect(captureProcess).toContain("document.querySelector('.filter-sheet-trigger')?.click()");
    expect(captureProcess).toContain("filters: '.filter-sheet'");
  });

  it('can populate live catalog search and the selected-film logging unit before capture', () => {
    expect(captureProcess).toContain("'catalog'");
    expect(captureProcess).toContain("'log-selected'");
    expect(captureProcess).toContain("'.archive-search input'");
    expect(captureProcess).toContain("'The Ring'");
    expect(captureProcess).toContain("setCaptureInput('.film-search-block input', 'The Ring')");
    expect(captureProcess).toContain("'.film-search-results button'");
    expect(captureProcess).toContain("'.selected-film .poster-art'");
  });

  it('replays touch dismissal in mobile sheets before taking proof', () => {
    expect(captureProcess).toContain('verifyMobileSheetLifecycle');
    expect(captureProcess).toContain('body.scrollHeight > body.clientHeight');
    expect(captureProcess).toContain('mobileNavigationBlocked');
    expect(captureProcess).toContain('focusLayoutStable');
    expect(captureProcess).toContain('document.querySelector(backdropSelector)?.click()');
    expect(captureProcess).toContain("typeof TouchEvent !== 'function'");
    expect(captureProcess).toContain("dispatchSheetTouch('.filter-sheet-head', 24, 112)");
    expect(captureProcess).toContain("dispatchSheetTouch('.log-sheet-head', 24, 112)");
    expect(captureProcess).toContain("waitForCaptureSelector('.filter-sheet', false)");
    expect(captureProcess).toContain("waitForCaptureSelector('.log-sheet', false)");
  });

  it('replays log dialog focus trapping, Escape restoration, and rating selection before proof', () => {
    expect(captureProcess).toContain('verifyLogDialogKeyboard');
    expect(captureProcess).toContain("keyCode: 'Tab'");
    expect(captureProcess).toContain("keyCode: 'Escape'");
    expect(captureProcess).toContain("captureWidth <= 700 ? '.header-log-action' : '.archive-spine .log-action'");
    expect(captureProcess).toContain('document.querySelector(logActionSelector) === document.activeElement');
    expect(captureProcess).toContain("const input = document.querySelectorAll('.log-sheet .rating-segment input')[7]");
    expect(captureProcess).toContain('input?.click()');
    expect(captureProcess).toContain('ratingSelectionVisible');
    expect(captureProcess).toContain("'.log-sheet .rating-current-value'");
  });

  it('captures the remaining audit states through real installed-app interactions', () => {
    const profiles = [
      'aggregation-verify',
      'diary-ledger',
      'diary-grid',
      'empty-archive',
      'library-filtered',
      'library-empty',
      'library-selected',
      'search-results',
      'search-long',
      'catalog-outage',
      'detail-missing',
      'detail-outage',
      'log-ambiguity',
      'log-path-match',
      'log-multiple-paths',
      'log-rating-none',
      'log-rating-numeric',
      'metadata-retry',
      'loading',
      'load-error',
      'persistence-edit',
      'persistence-edit-verify',
      'accessibility-audit',
      'performance-large',
      'performance',
      'poster-performance',
      'retry-backoff-verify',
      'slow-catalog',
      'statistics-lower'
    ];

    for (const profile of profiles) {
      expect(captureProcess).toContain(`'${profile}'`);
    }

    expect(captureProcess).toContain("document.querySelector('#diary-tab-timeline')?.focus()");
    expect(captureProcess).toContain("keyCode: 'Right'");
    expect(captureProcess).toContain("document.querySelector('.filter-sheet-trigger')?.click()");
    expect(captureProcess).toContain('filterSurface + \' select[name="genre"]\'');
    expect(captureProcess).toContain('filterSurface + \' select[name="mediaType"]\'');
    expect(captureProcess).toContain("key: 'ArrowDown'");
    expect(captureProcess).toContain("keyCode: 'Enter'");
    expect(captureProcess).toContain('activeResultVisible');
    expect(captureProcess).toContain("'.movie-card:not(:has(.poster-art)) .movie-card-face'");
    expect(captureProcess).toContain("captureRequestedView === 'catalog-outage'");
    expect(captureProcess).toContain('verifyRatingKeyboardFocus');
    expect(captureProcess).toContain("captureRequestedView === 'detail-outage'");
    expect(captureProcess).toContain("captureRequestedView === 'log-ambiguity'");
    expect(captureProcess).toContain("captureRequestedView === 'log-path-match'");
    expect(captureProcess).toContain("captureRequestedView === 'log-multiple-paths'");
    expect(captureProcess).toContain('Installed persistence proof');
    expect(captureProcess).toContain('Installed edit persistence proof');
    expect(captureProcess).toContain('Installed film aggregation did not survive relaunch');
    expect(captureProcess).toContain('Installed metadata Retry');
    expect(captureProcess).toContain('Mobile filter Reset');
    expect(captureProcess).toContain("captureRequestedView === 'loading'");
    expect(captureProcess).toContain("captureRequestedView === 'load-error'");
    expect(captureProcess).toContain("document.querySelector('.activity-panel')?.scrollIntoView");
  });

  it('measures installed navigation and local Search against explicit budgets', () => {
    expect(captureProcess).toContain("captureRequestedView === 'performance'");
    expect(captureProcess).toContain('maxNavigationMilliseconds >= 100');
    expect(captureProcess).toContain('measurements.localSearchMilliseconds >= 100');
    expect(captureProcess).toContain('installed performance:');
    expect(captureProcess).toContain('installed slow catalog:');
    expect(captureProcess).toContain('installed large library:');
    expect(captureProcess).toContain('installed poster performance:');
  });

  it('audits installed accessibility names, alternatives, focus visibility, and mobile target sizes', () => {
    expect(captureProcess).toContain("captureRequestedView === 'accessibility-audit'");
    expect(captureProcess).toContain('imagesMissingAlternatives');
    expect(captureProcess).toContain('missingNames');
    expect(captureProcess).toContain('contrastFailures');
    expect(captureProcess).toContain('undersizedMajorTargets');
    expect(captureProcess).toContain('installed accessibility:');
  });
});

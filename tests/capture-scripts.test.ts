// ABOUTME: Verifies that screenshot capture snapshots real Movie Log data instead of mutating it or using seeded fixtures.
// ABOUTME: Reads and executes capture boundaries so unsafe data aliases and stale proof shortcuts cannot return silently.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const captureScript = readFileSync(new URL('../scripts/capture.mjs', import.meta.url), 'utf8');
const packagedCaptureScriptUrl = new URL('../scripts/capture-packaged.mjs', import.meta.url);
const packagedCaptureScriptPath = fileURLToPath(packagedCaptureScriptUrl);
const packagedCaptureScript = readFileSync(packagedCaptureScriptUrl, 'utf8');
const captureProcess = readFileSync(new URL('../electron/capture.ts', import.meta.url), 'utf8');
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};
const mainProcess = readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');
const mainWindow = readFileSync(new URL('../electron/main-window.ts', import.meta.url), 'utf8');

describe('capture pipeline', () => {
  it('does not force seeded fixture data or require seeded titles before screenshot capture', () => {
    expect(captureScript).toContain("MOVIE_LOG_CAPTURE_DATA_MODE: 'real'");
    expect(captureScript).toContain('MOVIE_LOG_DATA_DIR: snapshot.dataDirectory');
    expect(captureScript).toContain('captureSnapshotMarkerName');
    expect(packagedCaptureScript).not.toMatch(/MOVIE_LOG_DATA_DIR\s*:\s*['"`]/);
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
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_STARTED_AT');
    expect(packagedCaptureScript).toContain('overallTimeoutMs');
    expect(packagedCaptureScript).toContain('terminateProcessTree');
    expect(packagedCaptureScript).toContain('process.kill(-child.pid');
    expect(packagedCaptureScript).toContain('capture stage:');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_DATA_MODE');
    expect(packagedCaptureScript).toContain('data-${captureDataMode}');
    expect(packagedCaptureScript).toContain("process.argv.includes('--help')");
    expect(packagedCaptureScript).toContain('Set MOVIE_LOG_CAPTURE_DATA_MODE explicitly');
    expect(packagedCaptureScript).toContain("'Scratch capture data directory'");
    expect(packagedCaptureScript).toContain('createRealCaptureSnapshot');
    expect(packagedCaptureScript).toContain('captureSnapshotMarkerName');
    expect(packagedCaptureScript).not.toContain("MOVIE_LOG_CAPTURE_DATA_MODE ?? 'real'");
    expect(packagedCaptureScript).toContain('readPngDimensions');
    expect(packagedCaptureScript).toContain('installedAppPath');
    expect(packagedCaptureScript).toContain('resolveInstalledAppPath');
    expect(packagedCaptureScript).toContain("'Contents', 'MacOS', 'Electron'");
    expect(packagedCaptureScript).not.toContain("join(process.cwd(), 'release', 'mac', 'Movie Log.app'");
    expect(packageManifest.scripts['open:mac']).toContain('/Applications/Movie Log.app');
  });

  it('keeps packaged capture help side-effect free', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-capture-help-'));
    const capturePath = join(temporaryDirectory, 'existing-capture.png');
    writeFileSync(capturePath, 'keep');

    try {
      const result = spawnSync(process.execPath, [packagedCaptureScriptPath, '--help'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          MOVIE_LOG_CAPTURE_DATA_MODE: 'scratch',
          MOVIE_LOG_CAPTURE_PATH: capturePath,
          MOVIE_LOG_CAPTURE_TIMEOUT_MS: '0',
          MOVIE_LOG_DATA_DIR: 'relative-store'
        }
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('MOVIE_LOG_CAPTURE_DATA_MODE=real|scratch');
      expect(result.stdout).not.toContain('capture stage:');
      expect(readFileSync(capturePath, 'utf8')).toBe('keep');
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('canonicalizes scratch paths and rejects production Application Support aliases before capture', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-capture-data-'));
    const productionDirectory = join(homedir(), 'Library', 'Application Support', 'Movie Log');
    const productionAlias = join(temporaryDirectory, 'movie-log-production');
    const capturePath = join(temporaryDirectory, 'existing-capture.png');

    symlinkSync(productionDirectory, productionAlias);
    writeFileSync(capturePath, 'keep');

    const unsafeDirectories = [
      productionDirectory,
      join(productionDirectory, 'movie-log'),
      `${productionDirectory}/scratch/..`,
      join(productionAlias, 'movie-log'),
      `/System/Volumes/Data${productionDirectory}`,
      productionDirectory.toUpperCase()
    ];

    try {
      for (const dataDirectory of unsafeDirectories) {
        const result = spawnSync(process.execPath, [packagedCaptureScriptPath], {
          encoding: 'utf8',
          env: {
            ...process.env,
            MOVIE_LOG_CAPTURE_DATA_MODE: 'scratch',
            MOVIE_LOG_CAPTURE_PATH: capturePath,
            MOVIE_LOG_CAPTURE_TIMEOUT_MS: '45000',
            MOVIE_LOG_DATA_DIR: dataDirectory
          }
        });

        expect(result.status, dataDirectory).not.toBe(0);
        expect(result.stderr, dataDirectory).toContain('Scratch capture data directory must be an absolute path');
        expect(result.stdout, dataDirectory).not.toContain('capture stage:');
        expect(readFileSync(capturePath, 'utf8'), dataDirectory).toBe('keep');
      }

      const relativeResult = spawnSync(process.execPath, [packagedCaptureScriptPath], {
        encoding: 'utf8',
        env: {
          ...process.env,
          MOVIE_LOG_CAPTURE_DATA_MODE: 'scratch',
          MOVIE_LOG_CAPTURE_PATH: capturePath,
          MOVIE_LOG_CAPTURE_TIMEOUT_MS: '45000',
          MOVIE_LOG_DATA_DIR: 'relative-store'
        }
      });

      expect(relativeResult.status).not.toBe(0);
      expect(relativeResult.stderr).toContain('Scratch capture data directory must be an absolute path');
      expect(relativeResult.stdout).not.toContain('capture stage:');
      expect(readFileSync(capturePath, 'utf8')).toBe('keep');
      expect(packagedCaptureScript).toContain('packagedAppEnvironment.MOVIE_LOG_DATA_DIR = captureDataDirectory');
      expect(packagedCaptureScript).toContain('packagedAppEnvironment[captureSnapshotMarkerName]');
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('supports exact installed-app capture profiles and rejects overflow or wrong dimensions', () => {
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_PATH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_WIDTH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_HEIGHT');
    expect(mainWindow).toContain('useContentSize');
    expect(mainWindow).not.toContain('capture.prepareWindow');
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
    expect(captureProcess).toContain('scroll.scrollHeight > scroll.clientHeight');
    expect(captureProcess).toContain("scrollSelector: '.filter-sheet'");
    expect(captureProcess).toContain("scrollSelector: '.log-sheet'");
    expect(captureProcess).toContain('actionReachable');
    expect(captureProcess).toContain('mobileNavigationBlocked');
    expect(captureProcess).toContain('Number.parseFloat(getComputedStyle(navigation).zIndex) || 0');
    expect(captureProcess).toContain('focusLayoutStable');
    expect(captureProcess).toContain('document.querySelector(backdropSelector)?.click()');
    expect(captureProcess).toContain("typeof TouchEvent !== 'function'");
    expect(captureProcess).toContain("dispatchSheetTouch('.filter-sheet-head', 24, 112)");
    expect(captureProcess).toContain("dispatchSheetTouch('.log-sheet-head', 24, 112)");
    expect(captureProcess).toContain("waitForCaptureSelector('.filter-sheet', false)");
    expect(captureProcess).toContain("waitForCaptureSelector('.log-sheet', false)");
  });

  it('keeps capture selectors synchronized with the renderer responsive breakpoints', () => {
    expect(captureProcess).toContain('const captureMobileNavigationBreakpoint = 900');
    expect(captureProcess).toContain('const captureCompactFilterBreakpoint = 1024');
    expect(captureProcess).toContain('captureWidth <= captureMobileNavigationBreakpoint');
    expect(captureProcess).toContain('captureWidth <= captureCompactFilterBreakpoint');
    expect(captureProcess).toContain('window.innerWidth <= ${captureMobileNavigationBreakpoint}');
  });

  it('replays log dialog focus trapping, Escape restoration, and rating selection before proof', () => {
    expect(captureProcess).toContain('verifyLogDialogKeyboard');
    expect(captureProcess).toContain("keyCode: 'Tab'");
    expect(captureProcess).toContain("keyCode: 'Escape'");
    expect(captureProcess).toContain(
      "captureWidth <= captureMobileNavigationBreakpoint ? '.header-log-action' : '.archive-spine .log-action'"
    );
    expect(captureProcess).toContain('document.querySelector(logActionSelector) === document.activeElement');
    expect(captureProcess).toContain("const input = document.querySelectorAll('.log-sheet .rating-segment input')[7]");
    expect(captureProcess).toContain('input?.click()');
    expect(captureProcess).toContain('ratingSelectionVisible');
    expect(captureProcess).toContain("'.log-sheet .rating-current-value'");
    expect(captureProcess).toContain('ratingSelectionState.contrast >= 4.5');
    expect(captureProcess).not.toContain('high-contrast selection plate');
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
      'detail-imdb-match',
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
      'layout-stability',
      'performance-diary-large',
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
    expect(captureProcess).toContain("captureRequestedView === 'detail-imdb-match'");
    expect(captureProcess).toContain('installed IMDb dossier match:');
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
    expect(captureProcess).toContain("captureRequestedView === 'layout-stability'");
    expect(captureProcess).toContain("captureRequestedView === 'performance-diary-large'");
    expect(captureProcess).toContain('launchReadyMilliseconds');
    expect(captureProcess).toContain('measurements.launchReadyMilliseconds >= 4_000');
    expect(captureProcess).toContain("captureRequestedView === 'empty-archive'");
    expect(captureProcess).toContain('transformReadState');
    expect(captureProcess).toContain("document.querySelector('.activity-panel')?.scrollIntoView");
  });

  it('measures installed navigation and local Search against explicit budgets', () => {
    expect(captureProcess).toContain("captureRequestedView === 'performance'");
    expect(captureProcess).toContain('maxNavigationMilliseconds >= 100');
    expect(captureProcess).toContain('measurements.localSearchMilliseconds >= 100');
    expect(captureProcess).toContain('installed performance:');
    expect(captureProcess).toContain('installed large diary:');
    expect(captureProcess).toContain('installed layout stability:');
    expect(captureProcess).toContain('installed live catalog:');
    expect(captureProcess).toContain('installed dossier poster:');
    expect(captureProcess).toContain('installed dossier fallback:');
    expect(captureProcess).toContain('installed log action flow:');
    expect(captureProcess).toContain('installed mobile diary viewport:');
    expect(captureProcess).toContain('installed slow catalog:');
    expect(captureProcess).toContain('installed large library:');
    expect(captureProcess).toContain('installed poster performance:');
    expect(captureProcess).toContain('Network.setCacheDisabled');
    expect(captureProcess).toContain('Network.emulateNetworkConditions');
    expect(captureProcess).toContain('measureThrottledPosterResource');
    expect(captureProcess).toContain('movieLogThrottleProof');
    expect(captureProcess).toContain('performance.clearResourceTimings');
    expect(captureProcess).toContain("shiftObserver.observe({ type: 'layout-shift'");
    expect(captureProcess).toContain("sourceImage.removeAttribute('srcset')");
    expect(captureProcess).toContain('await sourceImage.decode()');
    expect(captureProcess).toContain('measurements.throttledPosterDecodeMilliseconds >= 1_000');
    expect(captureProcess).toContain('measurements.throttledPosterLayoutShift > 0.001');
    expect(captureProcess).toContain('debugTarget.detach');
    expect(captureProcess).toContain('const throttledPosterResource = await measureThrottledPosterResource()');
    expect(captureProcess).toContain('measurements.slowestResourceMilliseconds < 350');
    expect(captureProcess).toContain('stability.cumulativeLayoutShift > 0.01');
  });

  it('audits installed accessibility names, alternatives, focus visibility, and mobile target sizes', () => {
    expect(captureProcess).toContain("captureRequestedView === 'accessibility-audit'");
    expect(captureProcess).toContain('imagesMissingAlternatives');
    expect(captureProcess).toContain('missingNames');
    expect(captureProcess).toContain('modalBackgroundIssues');
    expect(captureProcess).toContain('contrastFailures');
    expect(captureProcess).toContain('undersizedMajorTargets');
    expect(captureProcess).toContain('installed accessibility:');
  });
});

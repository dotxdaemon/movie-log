// ABOUTME: Verifies that screenshot capture uses the real Movie Log data directory instead of seeded fixture data.
// ABOUTME: Reads the live capture pipeline source so fake screenshot titles and fake data overrides cannot return silently.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const captureScript = readFileSync(new URL('../scripts/capture.mjs', import.meta.url), 'utf8');
const packagedCaptureScript = readFileSync(new URL('../scripts/capture-packaged.mjs', import.meta.url), 'utf8');
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};
const mainProcess = readFileSync(new URL('../electron/main.ts', import.meta.url), 'utf8');

describe('capture pipeline', () => {
  it('does not force seeded fixture data or require seeded titles before screenshot capture', () => {
    expect(captureScript).not.toContain('MOVIE_LOG_DATA_DIR');
    expect(packagedCaptureScript).not.toContain('MOVIE_LOG_DATA_DIR');
    expect(captureScript).not.toContain('Severance');
    expect(packagedCaptureScript).not.toContain('Severance');
    expect(captureScript).not.toContain('The Brutalist');
    expect(packagedCaptureScript).not.toContain('The Brutalist');
    expect(mainProcess).not.toContain("latestText.includes('media inbox')");
    expect(mainProcess).not.toContain("latestText.includes('severance')");
    expect(mainProcess).not.toContain("latestText.includes('the brutalist')");
  });

  it('fails closed on stale packaged screenshots and stops any resident packaged app first', () => {
    expect(packagedCaptureScript).toContain('pkill');
    expect(packagedCaptureScript).toContain('rm(capturePath');
    expect(packagedCaptureScript).toContain('stat(capturePath');
    expect(packagedCaptureScript).toContain('captureStartedAt');
    expect(packagedCaptureScript).toContain('/Applications');
    expect(packagedCaptureScript).toContain('resolveInstalledAppPath');
    expect(packagedCaptureScript).toContain("'Contents', 'MacOS', 'Electron'");
    expect(packagedCaptureScript).not.toContain("join(process.cwd(), 'release', 'mac', 'Movie Log.app'");
    expect(packageManifest.scripts['open:mac']).toContain("/Applications/Movie Log.app");
  });

  it('supports exact installed-app capture profiles and rejects overflow or wrong dimensions', () => {
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_PATH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_WIDTH');
    expect(packagedCaptureScript).toContain('MOVIE_LOG_CAPTURE_HEIGHT');
    expect(mainProcess).toContain('useContentSize');
    expect(mainProcess).toContain('scrollWidth');
    expect(mainProcess).toContain('clientWidth');
    expect(mainProcess).toContain('image.getSize()');
    expect(mainProcess).toContain('Capture dimensions');
    expect(mainProcess).toContain('horizontal overflow');
  });

  it('can select every product surface before taking installed-app proof', () => {
    expect(mainProcess).toContain('MOVIE_LOG_CAPTURE_VIEW');
    expect(mainProcess).toContain("'.nav-item'");
    expect(mainProcess).toContain("'.movie-card:has(.poster-art) .movie-card-face'");
    expect(mainProcess).toContain("'.movie-card-selected .movie-card-face'");
    expect(mainProcess).toContain("'.log-sheet'");
    expect(mainProcess).toContain('Capture view did not render');
  });

  it('can open the mobile library filter sheet before capture', () => {
    expect(mainProcess).toContain("'filters'");
    expect(mainProcess).toContain("document.querySelector('.filter-sheet-trigger')?.click()");
    expect(mainProcess).toContain("filters: '.filter-sheet'");
  });

  it('can populate live catalog search and the selected-film logging unit before capture', () => {
    expect(mainProcess).toContain("'catalog'");
    expect(mainProcess).toContain("'log-selected'");
    expect(mainProcess).toContain("setCaptureInput('.archive-search input', 'The Ring')");
    expect(mainProcess).toContain("setCaptureInput('.film-search-block input', 'The Ring')");
    expect(mainProcess).toContain("'.film-search-results button'");
    expect(mainProcess).toContain("'.selected-film .poster-art'");
  });

  it('replays touch dismissal in mobile sheets before taking proof', () => {
    expect(mainProcess).toContain("typeof TouchEvent !== 'function'");
    expect(mainProcess).toContain("dispatchSheetTouch('.filter-sheet-head', 24, 112)");
    expect(mainProcess).toContain("dispatchSheetTouch('.log-sheet-head', 24, 112)");
    expect(mainProcess).toContain("waitForCaptureSelector('.filter-sheet', false)");
    expect(mainProcess).toContain("waitForCaptureSelector('.log-sheet', false)");
  });

  it('replays log dialog focus trapping, Escape restoration, and rating selection before proof', () => {
    expect(mainProcess).toContain('verifyLogDialogKeyboard');
    expect(mainProcess).toContain("keyCode: 'Tab'");
    expect(mainProcess).toContain("keyCode: 'Escape'");
    expect(mainProcess).toContain("captureWidth <= 700 ? '.mobile-log-action' : '.archive-spine .log-action'");
    expect(mainProcess).toContain('document.querySelector(logActionSelector) === document.activeElement');
    expect(mainProcess).toContain("const input = document.querySelectorAll('.log-sheet .rating-segment input')[7]");
    expect(mainProcess).toContain('input?.click()');
    expect(mainProcess).toContain('ratingSelectionVisible');
  });
});

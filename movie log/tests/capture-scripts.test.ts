// ABOUTME: Verifies that screenshot capture uses the real Movie Log data directory instead of seeded fixture data.
// ABOUTME: Reads the live capture pipeline source so fake screenshot titles and fake data overrides cannot return silently.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const captureScript = readFileSync(new URL('../scripts/capture.mjs', import.meta.url), 'utf8');
const packagedCaptureScript = readFileSync(new URL('../scripts/capture-packaged.mjs', import.meta.url), 'utf8');
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
});

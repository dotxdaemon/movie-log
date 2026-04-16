// ABOUTME: Verifies that the renderer styles use the botanical warm palette for the workspace shell.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('renderer palette', () => {
  it('keeps the botanical amber accent family without competing teal or cold tones', () => {
    expect(stylesheet).toContain('--amber:');
    expect(stylesheet).toContain('--amber-glow:');
    expect(stylesheet).not.toContain('--teal:');
    expect(stylesheet).not.toContain('var(--teal)');
  });
});

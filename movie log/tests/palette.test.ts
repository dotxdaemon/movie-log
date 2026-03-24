// ABOUTME: Verifies that the renderer styles use one simplified warm palette for the workspace shell.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('renderer palette', () => {
  it('keeps a single warm accent family and removes the competing teal controls', () => {
    expect(stylesheet).toContain('--flareWarm:');
    expect(stylesheet).not.toContain('--teal:');
    expect(stylesheet).not.toContain('var(--teal)');
  });
});

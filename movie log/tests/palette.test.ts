// ABOUTME: Verifies that the renderer styles use the cover-driven olive, cream, and red palette.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('renderer palette', () => {
  it('keeps the olive room, pale seat, and acid-red masthead palette from the cover', () => {
    expect(stylesheet).toContain('--wall-olive:');
    expect(stylesheet).toContain('--poster-red:');
    expect(stylesheet).toContain('--seat-cream:');
    expect(stylesheet).toContain('--frame-gold:');
    expect(stylesheet).not.toContain('--amber:');
    expect(stylesheet).not.toContain('var(--amber)');
  });
});

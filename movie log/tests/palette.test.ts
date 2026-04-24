// ABOUTME: Verifies that the renderer styles use the paper and ink palette for the workspace shell.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('renderer palette', () => {
  it('keeps the pale paper and ink palette without prism tokens', () => {
    expect(stylesheet).toContain('--paper:');
    expect(stylesheet).toContain('--ink:');
    expect(stylesheet).toContain('--edge:');
    expect(stylesheet).not.toContain('--prism-cyan:');
    expect(stylesheet).not.toContain('--prism-magenta:');
    expect(stylesheet).not.toContain('--prism-violet:');
    expect(stylesheet).not.toContain('--prism-gold:');
    expect(stylesheet).not.toContain('--amber:');
    expect(stylesheet).not.toContain('var(--amber)');
  });

  it('does not paint a decorative X across the framed wall panel', () => {
    expect(stylesheet).not.toContain('linear-gradient(45deg, transparent 37%');
    expect(stylesheet).not.toContain('linear-gradient(-45deg, transparent 37%');
  });
});

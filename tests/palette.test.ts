// ABOUTME: Verifies that the renderer styles use the icy paper, graphite, and burgundy dossier palette.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('renderer palette', () => {
  it('keeps the pale lavender and graphite palette without the warm lamp or pill system', () => {
    expect(stylesheet).toContain('--canvas: #f5f3f6');
    expect(stylesheet).toContain('--surface: #eae8ee');
    expect(stylesheet).toContain('--surface-lavender: #d7d3df');
    expect(stylesheet).toContain('--ink:');
    expect(stylesheet).toContain('--structural: #24232d');
    expect(stylesheet).toContain('--burgundy: #741f32');
    expect(stylesheet).toContain('--active-red: #a93246');
    expect(stylesheet).toContain('--border: #c9c6cf');
    expect(stylesheet).not.toContain('--lamp:');
    expect(stylesheet).not.toContain('--lamp-bright:');
    expect(stylesheet).not.toContain('var(--lamp)');
    expect(stylesheet).not.toContain('border-radius: 999px');
    expect(stylesheet).not.toContain('backdrop-filter');
    expect(stylesheet).not.toContain('--prism-cyan:');
    expect(stylesheet).not.toContain('--prism-magenta:');
    expect(stylesheet).not.toContain('--prism-violet:');
    expect(stylesheet).not.toContain('--prism-gold:');
    expect(stylesheet).not.toContain('--amber:');
  });

  it('does not paint a decorative X across the framed wall panel', () => {
    expect(stylesheet).not.toContain('linear-gradient(45deg, transparent 37%');
    expect(stylesheet).not.toContain('linear-gradient(-45deg, transparent 37%');
  });
});

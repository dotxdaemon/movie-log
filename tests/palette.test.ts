// ABOUTME: Verifies the renderer palette translated from the supplied pastel fashion reference.
// ABOUTME: Reads the real stylesheet so color, contrast, and material hierarchy cannot drift silently.
import { describe, expect, it } from 'vitest';
import { readStyles } from './style-source.js';

const stylesheet = readStyles();

function relativeLuminance(hex: string): number {
  const channels = hex
    .match(/[\da-f]{2}/gi)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (luminances[0]! + 0.05) / (luminances[1]! + 0.05);
}

describe('renderer palette', () => {
  it('keeps the gray-pink, graphite, coral, blue, and tangerine reference palette', () => {
    expect(stylesheet).toContain('--bg: #f7f1f4');
    expect(stylesheet).toContain('--bg-2: #fbf6f8');
    expect(stylesheet).toContain('--paper: #fffafb');
    expect(stylesheet).toContain('--text: #1b1c21');
    expect(stylesheet).toContain('--text-soft: #4f4b58');
    expect(stylesheet).toContain('--text-muted: #6f6474');
    expect(stylesheet).toContain('--accent: #f16f72');
    expect(stylesheet).toContain('--accent-2: #8da4ff');
    expect(stylesheet).toContain('--accent-3: #f7b85d');
    expect(stylesheet).not.toContain('--lamp:');
    expect(stylesheet).not.toContain('--prism-cyan:');
    expect(stylesheet).not.toContain('--prism-magenta:');
  });

  it('keeps graphite text readable across every pale base material', () => {
    const graphite = '#1b1c21';

    expect(contrastRatio(graphite, '#f7f1f4')).toBeGreaterThanOrEqual(12);
    expect(contrastRatio(graphite, '#fbf6f8')).toBeGreaterThanOrEqual(12);
    expect(contrastRatio(graphite, '#fffafb')).toBeGreaterThanOrEqual(12);
  });

  it('limits translucent blur to high-level shell and dialog surfaces', () => {
    expect(stylesheet).toMatch(/\.archive-background\s*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).toMatch(/\.filter-sheet,\s*\.log-sheet\s*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).toMatch(/\.mobile-nav\s*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).not.toMatch(/\.movie-card-face\s*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).not.toMatch(/\.diary-entry\s*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).not.toMatch(/\.search-result[^{]*\{[^}]*backdrop-filter:/s);
    expect(stylesheet).not.toMatch(/\.chart-panel\s*\{[^}]*backdrop-filter:/s);
  });

  it('does not paint decorative crosshatching over the workspace', () => {
    expect(stylesheet).not.toContain('linear-gradient(45deg, transparent 37%');
    expect(stylesheet).not.toContain('linear-gradient(-45deg, transparent 37%');
  });
});

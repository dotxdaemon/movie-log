// ABOUTME: Verifies that the renderer styles use the icy paper, graphite, and burgundy dossier palette.
// ABOUTME: Reads the real stylesheet so the color token contract can regress without a browser.
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
  it('keeps the pale lavender and graphite palette without the warm lamp or pill system', () => {
    expect(stylesheet).toContain('--canvas: #f5f3f6');
    expect(stylesheet).toContain('--surface: #eae8ee');
    expect(stylesheet).toContain('--surface-lavender: #d7d3df');
    expect(stylesheet).toContain('--ink:');
    expect(stylesheet).toContain('--structural: #24232d');
    expect(stylesheet).toContain('--burgundy: #741f32');
    expect(stylesheet).toContain('--active-red: #a93246');
    expect(stylesheet).toContain('--border: #74717c');
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

  it('keeps shared control boundaries above 3:1 on every pale surface', () => {
    const boundary = '#74717c';

    expect(contrastRatio(boundary, '#f5f3f6')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(boundary, '#eae8ee')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(boundary, '#d7d3df')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(boundary, '#fbfafc')).toBeGreaterThanOrEqual(3);
  });

  it('does not paint a decorative X across the framed wall panel', () => {
    expect(stylesheet).not.toContain('linear-gradient(45deg, transparent 37%');
    expect(stylesheet).not.toContain('linear-gradient(-45deg, transparent 37%');
  });
});

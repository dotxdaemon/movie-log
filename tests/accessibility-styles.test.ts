// ABOUTME: Verifies Movie Log's shared text tokens and declared type sizes meet the archive readability floor.
// ABOUTME: Pins WCAG contrast on pale surfaces and prevents microtype below twelve pixels.
import { describe, expect, it } from 'vitest';
import { readStyles } from './style-source.js';

const stylesheet = readStyles();

function readToken(name: string): string {
  const match = stylesheet.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  return match?.[1] ?? '';
}

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function blend(foreground: string, background: string, alpha: number): string {
  const readChannels = (hex: string) =>
    hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16)) ?? [0, 0, 0];
  const foregroundChannels = readChannels(foreground);
  const backgroundChannels = readChannels(background);
  return `#${foregroundChannels
    .map((channel, index) => Math.round(channel * alpha + (backgroundChannels[index] ?? 0) * (1 - alpha)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

describe('accessible archive styles', () => {
  it('keeps muted text at AA contrast on every pale material', () => {
    const muted = readToken('ink-muted');

    expect(contrast(muted, readToken('canvas'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, readToken('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, readToken('surface-lavender'))).toBeGreaterThanOrEqual(4.5);
  });

  it('declares no interface text below twelve pixels', () => {
    const sizes = [...stylesheet.matchAll(/font-size:\s*(\d*\.?\d+)(rem|px)/g)].map((match) => ({
      pixels: match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1]),
      source: match[0]
    }));
    const undersized = sizes.filter((size) => size.pixels < 12);

    expect(undersized).toEqual([]);
  });

  it('keeps translucent rail labels at AA contrast after blending onto graphite', () => {
    const paper = readToken('paper');
    const structural = readToken('structural');

    expect(contrast(blend(paper, structural, 0.72), structural)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(blend(paper, structural, 0.7), structural)).toBeGreaterThanOrEqual(4.5);
  });

  it('outlines the full None and numeric rating options on keyboard focus', () => {
    expect(stylesheet).toMatch(
      /\.rating-segment:has\(input:focus-visible\),\s*\.rating-none:has\(input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--ink\)[^}]*outline-offset:\s*2px/s
    );
  });
});

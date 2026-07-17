// ABOUTME: Verifies the packaged capture gate rejects black compositor frames while accepting the pale archive surface.
// ABOUTME: Keeps macOS capturePage occlusion from being retained as visual proof even when the process exits cleanly.
import { describe, expect, it } from 'vitest';
import { isFrameOccluded } from '../electron/capture.js';

function bitmap(width: number, height: number, color: [number, number, number]): Buffer {
  const pixels = Buffer.alloc(width * height * 4);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = color[2];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[0];
    pixels[offset + 3] = 255;
  }

  return pixels;
}

describe('isFrameOccluded', () => {
  it('accepts a complete pale renderer frame', () => {
    expect(isFrameOccluded(bitmap(100, 80, [245, 243, 246]), 100, 80)).toBe(false);
  });

  it('rejects a black frame and a black compositor band over the working surface', () => {
    expect(isFrameOccluded(bitmap(100, 80, [0, 0, 0]), 100, 80)).toBe(true);
    const banded = bitmap(100, 80, [245, 243, 246]);

    for (let y = 0; y < 18; y += 1) {
      for (let x = 18; x < 100; x += 1) {
        const offset = (y * 100 + x) * 4;
        banded.fill(0, offset, offset + 3);
      }
    }

    expect(isFrameOccluded(banded, 100, 80)).toBe(true);

    const rightBand = bitmap(100, 80, [245, 243, 246]);

    for (let y = 0; y < 14; y += 1) {
      for (let x = 78; x < 100; x += 1) {
        const offset = (y * 100 + x) * 4;
        rightBand.fill(0, offset, offset + 3);
      }
    }

    expect(isFrameOccluded(rightBand, 100, 80)).toBe(true);

    const dimmedBand = bitmap(100, 80, [245, 243, 246]);

    for (let y = 0; y < 14; y += 1) {
      for (let x = 78; x < 100; x += 1) {
        const offset = (y * 100 + x) * 4;
        dimmedBand.fill(18, offset, offset + 3);
      }
    }

    expect(isFrameOccluded(dimmedBand, 100, 80)).toBe(true);

    const transparentBand = bitmap(100, 80, [245, 243, 246]);

    for (let y = 0; y < 14; y += 1) {
      for (let x = 78; x < 100; x += 1) {
        transparentBand[(y * 100 + x) * 4 + 3] = 0;
      }
    }

    expect(isFrameOccluded(transparentBand, 100, 80)).toBe(true);
  });
});

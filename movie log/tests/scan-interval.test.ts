// ABOUTME: Verifies the automatic watched-folder scan interval used by the desktop app.
// ABOUTME: Keeps the rescan cadence pinned to the intended hourly schedule.
import { describe, expect, it } from 'vitest';
import { automaticScanIntervalMs } from '../electron/scan-interval.js';

describe('automaticScanIntervalMs', () => {
  it('runs the background watched-folder scan once an hour', () => {
    expect(automaticScanIntervalMs).toBe(60 * 60 * 1000);
  });
});

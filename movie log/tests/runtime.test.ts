// ABOUTME: Verifies that Movie Log configures the Electron runtime before startup.
// ABOUTME: Keeps the app-level performance knobs covered by a small unit regression.
import { describe, expect, it, vi } from 'vitest';
import { prepareAppRuntime } from '../electron/runtime.js';

describe('prepareAppRuntime', () => {
  it('disables hardware acceleration before naming the app', () => {
    const disableHardwareAcceleration = vi.fn();
    const setName = vi.fn();

    prepareAppRuntime({
      disableHardwareAcceleration,
      setName
    });

    expect(disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(setName).toHaveBeenCalledWith('Movie Log');
    expect(disableHardwareAcceleration.mock.invocationCallOrder[0]).toBeLessThan(setName.mock.invocationCallOrder[0]);
  });
});

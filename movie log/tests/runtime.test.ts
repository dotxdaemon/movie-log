// ABOUTME: Verifies that Movie Log configures the Electron runtime before startup.
// ABOUTME: Keeps the app-level performance knobs covered by a small unit regression.
import { describe, expect, it, vi } from 'vitest';
import { prepareAppRuntime } from '../electron/runtime.js';

describe('prepareAppRuntime', () => {
  it('disables hardware acceleration before naming the app', () => {
    const disableHardwareAcceleration = vi.fn();
    const quit = vi.fn();
    const requestSingleInstanceLock = vi.fn(() => true);
    const setName = vi.fn();

    prepareAppRuntime({
      disableHardwareAcceleration,
      quit,
      requestSingleInstanceLock,
      setName
    });

    expect(requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();
    expect(setName).toHaveBeenCalledWith('Movie Log');
    expect(requestSingleInstanceLock.mock.invocationCallOrder[0]).toBeLessThan(disableHardwareAcceleration.mock.invocationCallOrder[0]);
    expect(disableHardwareAcceleration.mock.invocationCallOrder[0]).toBeLessThan(setName.mock.invocationCallOrder[0]);
  });

  it('quits immediately when another Movie Log instance already owns the lock', () => {
    const disableHardwareAcceleration = vi.fn();
    const quit = vi.fn();
    const requestSingleInstanceLock = vi.fn(() => false);
    const setName = vi.fn();

    prepareAppRuntime({
      disableHardwareAcceleration,
      quit,
      requestSingleInstanceLock,
      setName
    });

    expect(requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(disableHardwareAcceleration).not.toHaveBeenCalled();
    expect(setName).not.toHaveBeenCalled();
  });
});

// ABOUTME: Verifies that Movie Log shuts down its background work when the last window closes.
// ABOUTME: Keeps the Electron lifecycle deterministic without importing the real Electron runtime into tests.
import { describe, expect, it, vi } from 'vitest';
import { closeMovieLog } from '../electron/window-close.js';

describe('closeMovieLog', () => {
  it('stops background work before quitting the app', async () => {
    const stopScanLoop = vi.fn();
    const disposeFolderMonitor = vi.fn().mockResolvedValue(undefined);
    const quitApp = vi.fn();

    await closeMovieLog({
      disposeFolderMonitor,
      quitApp,
      stopScanLoop
    });

    expect(stopScanLoop).toHaveBeenCalledTimes(1);
    expect(disposeFolderMonitor).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
    expect(stopScanLoop.mock.invocationCallOrder[0]).toBeLessThan(disposeFolderMonitor.mock.invocationCallOrder[0]);
    expect(disposeFolderMonitor.mock.invocationCallOrder[0]).toBeLessThan(quitApp.mock.invocationCallOrder[0]);
  });
});

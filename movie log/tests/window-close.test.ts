// ABOUTME: Verifies that Movie Log shuts down its background work when the last window closes.
// ABOUTME: Keeps the Electron lifecycle deterministic without importing the real Electron runtime into tests.
import { describe, expect, it, vi } from 'vitest';
import {
  closeMovieLog,
  handleWindowCloseRequest,
  handleWindowsClosed,
  shouldEndAppAfterWindowsClose
} from '../electron/window-close.js';

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

describe('handleWindowCloseRequest', () => {
  it('releases the desktop window instead of hiding it during a normal close', () => {
    const closeWindow = vi.fn();
    const hideWindow = vi.fn();
    const preventDefault = vi.fn();

    handleWindowCloseRequest({
      closeWindow,
      hideWindow,
      isCaptureRun: false,
      isQuitting: false,
      preventDefault
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(closeWindow).toHaveBeenCalledTimes(1);
    expect(hideWindow).not.toHaveBeenCalled();
  });
});

describe('shouldEndAppAfterWindowsClose', () => {
  it('keeps the menu bar app alive when the last window closes normally', () => {
    expect(shouldEndAppAfterWindowsClose({
      hasStatusItem: true,
      isQuitting: false
    })).toBe(false);
  });
});

describe('handleWindowsClosed', () => {
  it('pauses background work when the last window closes but the menu bar app stays alive', async () => {
    const pauseBackgroundWork = vi.fn().mockResolvedValue(undefined);
    const endApp = vi.fn().mockResolvedValue(undefined);

    await handleWindowsClosed({
      closeMovieLog: endApp,
      hasStatusItem: true,
      isQuitting: false,
      pauseBackgroundWork
    });

    expect(pauseBackgroundWork).toHaveBeenCalledTimes(1);
    expect(endApp).not.toHaveBeenCalled();
  });
});

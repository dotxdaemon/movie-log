// ABOUTME: Verifies that Movie Log routes show and close events through one explicit lifecycle policy.
// ABOUTME: Keeps tray-only, reopen, and quit transitions testable without importing Electron.
import { describe, expect, it, vi } from 'vitest';
import {
  handleMovieLogWindowsClosed,
  readShowMovieLogAction,
  showMovieLog
} from '../electron/app-lifecycle.js';

describe('readShowMovieLogAction', () => {
  it('creates a window when Movie Log is shown without an existing window', () => {
    expect(readShowMovieLogAction({ hasWindow: false })).toBe('create-window');
  });

  it('reveals the existing window when Movie Log is shown from the menu bar', () => {
    expect(readShowMovieLogAction({ hasWindow: true })).toBe('reveal-window');
  });
});

describe('showMovieLog', () => {
  it('starts background work before creating the first window', async () => {
    const order: string[] = [];

    await showMovieLog({
      createWindow: async () => {
        order.push('create');
      },
      hasWindow: false,
      revealWindow: () => {
        order.push('reveal');
      },
      startBackgroundWork: async () => {
        order.push('start');
      }
    });

    expect(order).toEqual(['start', 'create']);
  });
});

describe('handleMovieLogWindowsClosed', () => {
  it('pauses background work when the tray app stays alive', async () => {
    const pauseBackgroundWork = vi.fn().mockResolvedValue(undefined);
    const closeMovieLog = vi.fn().mockResolvedValue(undefined);

    await handleMovieLogWindowsClosed({
      closeMovieLog,
      hasStatusItem: true,
      isQuitting: false,
      pauseBackgroundWork
    });

    expect(pauseBackgroundWork).toHaveBeenCalledTimes(1);
    expect(closeMovieLog).not.toHaveBeenCalled();
  });
});

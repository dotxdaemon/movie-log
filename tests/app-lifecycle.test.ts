// ABOUTME: Verifies that Movie Log routes show and close events through one explicit lifecycle policy.
// ABOUTME: Keeps tray-only, reopen, and quit transitions testable without importing Electron.
import { describe, expect, it, vi } from 'vitest';
import { handleMovieLogWindowsClosed, readShowMovieLogAction, showMovieLog } from '../electron/app-lifecycle.js';

describe('readShowMovieLogAction', () => {
  it('creates a window when Movie Log is shown without an existing window', () => {
    expect(readShowMovieLogAction({ hasWindow: false })).toBe('create-window');
  });

  it('reveals the existing window when Movie Log is shown from the menu bar', () => {
    expect(readShowMovieLogAction({ hasWindow: true })).toBe('reveal-window');
  });
});

describe('showMovieLog', () => {
  it('starts background work before creating an inactive tray window', async () => {
    const order: string[] = [];

    await showMovieLog({
      activation: 'inactive',
      createWindow: async (activation) => {
        order.push(`create-${activation}`);
      },
      hasWindow: false,
      revealWindow: (activation) => {
        order.push(`reveal-${activation}`);
      },
      startBackgroundWork: async () => {
        order.push('start');
      }
    });

    expect(order).toEqual(['start', 'create-inactive']);
  });

  it('passes active intent through when revealing an existing window', async () => {
    const createWindow = vi.fn().mockResolvedValue(undefined);
    const revealWindow = vi.fn();

    await showMovieLog({
      activation: 'active',
      createWindow,
      hasWindow: true,
      revealWindow,
      startBackgroundWork: vi.fn().mockResolvedValue(undefined)
    });

    expect(createWindow).not.toHaveBeenCalled();
    expect(revealWindow).toHaveBeenCalledWith('active');
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

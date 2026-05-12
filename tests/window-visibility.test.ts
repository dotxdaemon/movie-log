// ABOUTME: Verifies that reopening Movie Log reveals the window without forcing macOS focus changes.
// ABOUTME: Keeps the window-placement behavior testable without importing the full Electron runtime into tests.
import { describe, expect, it, vi } from 'vitest';
import { revealWindow } from '../electron/window-visibility.js';

describe('revealWindow', () => {
  it('moves the window into the active display before showing it without focusing', () => {
    const setBounds = vi.fn();
    const restore = vi.fn();
    const showInactive = vi.fn();
    const focus = vi.fn();

    revealWindow({
      focus,
      getBounds: () => ({
        height: 640,
        width: 900,
        x: 0,
        y: 0
      }),
      isMinimized: () => true,
      restore,
      setBounds,
      showInactive
    }, {
      height: 900,
      width: 1440,
      x: 1440,
      y: 0
    });

    expect(restore).toHaveBeenCalledTimes(1);
    expect(setBounds).toHaveBeenCalledWith({
      height: 640,
      width: 900,
      x: 1710,
      y: 130
    });
    expect(showInactive).toHaveBeenCalledTimes(1);
    expect(focus).not.toHaveBeenCalled();
  });
});

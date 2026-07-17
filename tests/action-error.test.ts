// ABOUTME: Verifies every renderer action turns IPC and filesystem failures into concise user-facing copy.
// ABOUTME: Exercises the actual transport-shaped messages that previously leaked Electron internals into the UI.
import { describe, expect, it } from 'vitest';
import { readActionFailureMessage } from '../src/action-error.js';

describe('readActionFailureMessage', () => {
  it('removes Electron IPC names, stack text, and raw paths at the renderer boundary', () => {
    const message = readActionFailureMessage(
      new Error("Error invoking remote method 'movie-log:open-item': ENOENT /Volumes/Archive/Missing.mkv\n at ipcMain"),
      'open-item'
    );

    expect(message).toBe('That file or folder is no longer available.');
    expect(message).not.toMatch(/invoking|movie-log:|\/Volumes|ipcMain/i);
  });

  it('keeps permission, unavailable-volume, invalid-media, catalog, and persistence guidance distinct', () => {
    expect(readActionFailureMessage(Object.assign(new Error('denied'), { code: 'EACCES' }), 'scan')).toContain(
      'permission'
    );
    expect(readActionFailureMessage(Object.assign(new Error('gone'), { code: 'ENODEV' }), 'open-item')).toContain(
      'volume'
    );
    expect(readActionFailureMessage(new Error('unsupported media'), 'log')).toContain('supported movie');
    expect(readActionFailureMessage(new Error('network offline'), 'metadata')).toContain('catalog');
    expect(readActionFailureMessage(new Error('disk write failed'), 'persistence')).toContain('save');
  });

  it('uses action-specific fallback copy without exposing an unknown raw exception', () => {
    expect(readActionFailureMessage(new Error('very technical detail'), 'remove-folder')).toBe(
      'Movie Log could not remove that watched folder. Nothing was deleted.'
    );
    expect(readActionFailureMessage(new Error('very technical detail'), 'copy-path')).toBe(
      'Movie Log could not copy that path.'
    );
  });
});

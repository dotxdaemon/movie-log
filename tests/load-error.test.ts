// ABOUTME: Verifies startup failures use calm archive copy instead of exposing Electron IPC implementation details.
// ABOUTME: Keeps the designed full-screen error state useful even when the data request rejects below React.
import { describe, expect, it } from 'vitest';
import { readArchiveLoadFailureMessage } from '../src/load-error.js';

describe('readArchiveLoadFailureMessage', () => {
  it('sanitizes raw Electron and IPC failures', () => {
    const message = readArchiveLoadFailureMessage(
      new Error("Error invoking remote method 'movie-log:get-state': ENOENT /private/archive.json")
    );

    expect(message).toBe('Movie Log could not read the local archive. Your files were not changed.');
    expect(message).not.toMatch(/ipc|remote method|enoent|movie-log:/i);
  });
});

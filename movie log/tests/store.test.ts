// ABOUTME: Verifies that the desktop app persists watch history and watched folders on disk.
// ABOUTME: Uses real temporary files so the store behavior matches the local desktop runtime.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistoryStore } from '../electron/store.js';
import { createEntryFromPath } from '../shared/history.js';

describe('createHistoryStore', () => {
  let dataDirectory = '';

  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), 'movie-log-store-'));
  });

  afterEach(async () => {
    await rm(dataDirectory, { recursive: true, force: true });
  });

  it('persists history and watched folders across reloads', async () => {
    const store = createHistoryStore(dataDirectory);

    await store.addHistoryEntry(
      createEntryFromPath('/Users/seankim/Media Inbox/Flow', 'drop', '2026-03-12T08:00:00.000Z')
    );
    await store.addWatchedFolder('/Users/seankim/Media Inbox');

    const reloaded = createHistoryStore(dataDirectory);
    const state = await reloaded.readState();

    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.title).toBe('Flow');
    expect(state.watchedFolders).toHaveLength(1);
    expect(state.watchedFolders[0]?.path).toBe('/Users/seankim/Media Inbox');
  });
});

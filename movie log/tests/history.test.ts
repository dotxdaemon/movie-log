// ABOUTME: Verifies that dropped paths become clean watch-history entries with stable titles.
// ABOUTME: Checks file-title cleanup and newest-first ordering for the local history list.
import { describe, expect, it } from 'vitest';
import { createEntryFromPath, sortEntriesByWatchedAt } from '../shared/history.js';

describe('createEntryFromPath', () => {
  it('uses a folder name as the title and preserves the original path', () => {
    const entry = createEntryFromPath('/Users/seankim/Media Inbox/Severance', 'drop', '2026-03-12T08:00:00.000Z');

    expect(entry.title).toBe('Severance');
    expect(entry.sourcePath).toBe('/Users/seankim/Media Inbox/Severance');
    expect(entry.sourceKind).toBe('directory');
  });

  it('drops the extension from file titles', () => {
    const entry = createEntryFromPath('/Users/seankim/Media Inbox/Mickey 17.mkv', 'watch', '2026-03-12T08:00:00.000Z');

    expect(entry.title).toBe('Mickey 17');
    expect(entry.sourceKind).toBe('file');
  });
});

describe('sortEntriesByWatchedAt', () => {
  it('returns entries in reverse chronological order', () => {
    const sorted = sortEntriesByWatchedAt([
      createEntryFromPath('/tmp/older', 'watch', '2026-03-10T08:00:00.000Z'),
      createEntryFromPath('/tmp/newer', 'drop', '2026-03-12T08:00:00.000Z')
    ]);

    expect(sorted.map((entry) => entry.title)).toEqual(['newer', 'older']);
  });
});

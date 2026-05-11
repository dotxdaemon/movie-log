// ABOUTME: Verifies that dropped paths become clean watch-history entries with stable titles.
// ABOUTME: Checks file-title cleanup and newest-first ordering for the local history list.
import { describe, expect, it } from 'vitest';
import { createEntryFromPath, readVisibleHistory, sortEntriesByWatchedAt } from '../shared/history.js';

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

  it('removes common release metadata from file titles', () => {
    const entry = createEntryFromPath(
      '/Users/seankim/Media Inbox/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv',
      'watch',
      '2026-03-12T08:00:00.000Z'
    );

    expect(entry.title).toBe('Catch Me If You Can 2002');
    expect(entry.sourcePath).toBe(
      '/Users/seankim/Media Inbox/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv'
    );
  });

  it('treats release-style pixel counts as metadata even when they are malformed', () => {
    const entry = createEntryFromPath(
      '/Users/seankim/Media Inbox/Fantasy.Life.2025.1008p.AMZN.WEB-DL.DDP5.1.H.264-CHORTLE.mkv',
      'watch',
      '2026-03-12T08:00:00.000Z'
    );

    expect(entry.title).toBe('Fantasy Life 2025');
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

describe('readVisibleHistory', () => {
  it('keeps the earliest watched-folder row for each path while preserving manual drops', () => {
    const visibleHistory = readVisibleHistory([
      createEntryFromPath('/tmp/Flow.mkv', 'watch', '2026-03-21T08:00:00.000Z', 'file'),
      createEntryFromPath('/tmp/Flow.mkv', 'watch', '2026-03-19T08:00:00.000Z', 'file'),
      createEntryFromPath('/tmp/Manual.mkv', 'drop', '2026-03-20T08:00:00.000Z', 'file')
    ]);

    expect(visibleHistory.map((entry) => `${entry.source}:${entry.title}:${entry.watchedAt}`)).toEqual([
      'drop:Manual:2026-03-20T08:00:00.000Z',
      'watch:Flow:2026-03-19T08:00:00.000Z'
    ]);
  });
});

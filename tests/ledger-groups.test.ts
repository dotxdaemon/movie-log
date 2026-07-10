// ABOUTME: Verifies that visible history entries group into local calendar-day sections for the ledger.
// ABOUTME: Keeps day labels and grouping order deterministic without rendering the full workspace.
import { describe, expect, it } from 'vitest';
import { groupEntriesByDay } from '../src/ledger-groups.js';
import type { WatchEntry } from '../shared/types.js';

function entryAt(watchedAt: string, sourcePath: string): WatchEntry {
  return {
    id: `${watchedAt}:${sourcePath}`,
    source: 'watch',
    sourceKind: 'file',
    sourcePath,
    title: sourcePath,
    watchedAt
  };
}

describe('groupEntriesByDay', () => {
  it('keeps entries from the same local day in one group and preserves order', () => {
    const now = new Date('2026-07-09T12:00:00.000Z');
    const groups = groupEntriesByDay(
      [
        entryAt('2026-06-24T12:30:00.000Z', '/movies/A.mkv'),
        entryAt('2026-06-24T12:00:00.000Z', '/movies/B.mkv'),
        entryAt('2026-06-21T12:00:00.000Z', '/movies/C.mkv')
      ],
      now
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map((entry) => entry.sourcePath)).toEqual(['/movies/A.mkv', '/movies/B.mkv']);
    expect(groups[1].entries.map((entry) => entry.sourcePath)).toEqual(['/movies/C.mkv']);
    expect(groups[0].key).not.toBe(groups[1].key);
  });

  it('labels the current local day Today and the previous local day Yesterday', () => {
    const now = new Date('2026-07-09T12:00:00.000Z');
    const groups = groupEntriesByDay(
      [entryAt('2026-07-09T11:30:00.000Z', '/movies/New.mkv'), entryAt('2026-07-08T12:00:00.000Z', '/movies/Recent.mkv')],
      now
    );

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
  });

  it('labels older days with the full local date', () => {
    const watchedAt = '2026-03-19T12:00:00.000Z';
    const now = new Date('2026-07-09T12:00:00.000Z');
    const [group] = groupEntriesByDay([entryAt(watchedAt, '/movies/Flow.mkv')], now);

    expect(group.label).toBe(new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(watchedAt)));
  });
});

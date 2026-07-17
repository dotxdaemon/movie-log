// ABOUTME: Verifies every diary and statistics bucket uses the same local calendar shown to the user.
// ABOUTME: Pins Denver month, year, daylight-saving, and noon-based manual-entry boundaries.
import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readArchiveStats } from '../src/archive-model.js';
import {
  readLocalCalendarDateKey,
  readLocalCalendarMonthKey,
  readLocalCalendarYear
} from '../shared/local-calendar.js';
import type { MovieLogState, WatchEntry } from '../shared/types.js';
import { findByClass, readText, renderTree } from './render-tree.js';

const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'America/Denver';
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
});

function entry(id: string, watchedAt: string): WatchEntry {
  return {
    id,
    source: 'drop',
    sourceKind: 'file',
    sourcePath: `/Movies/${id}.mkv`,
    title: id,
    watchedAt
  };
}

describe('local calendar', () => {
  it('keeps a Denver December 31 viewing out of January and the following year', () => {
    const watchedAt = '2027-01-01T06:30:00.000Z';

    expect(readLocalCalendarDateKey(watchedAt)).toBe('2026-12-31');
    expect(readLocalCalendarMonthKey(watchedAt)).toBe('2026-12');
    expect(readLocalCalendarYear(watchedAt)).toBe(2026);
  });

  it('keeps January 1 and both daylight-saving transitions on their displayed Denver day', () => {
    expect(readLocalCalendarDateKey('2027-01-01T19:00:00.000Z')).toBe('2027-01-01');
    expect(readLocalCalendarDateKey('2026-03-08T08:30:00.000Z')).toBe('2026-03-08');
    expect(readLocalCalendarDateKey('2026-03-08T09:30:00.000Z')).toBe('2026-03-08');
    expect(readLocalCalendarDateKey('2026-11-01T07:30:00.000Z')).toBe('2026-11-01');
    expect(readLocalCalendarDateKey('2026-11-01T08:30:00.000Z')).toBe('2026-11-01');
  });

  it('preserves existing noon-based manually logged dates', () => {
    expect(readLocalCalendarDateKey('2026-07-13T18:00:00.000Z')).toBe('2026-07-13');
    expect(readLocalCalendarMonthKey('2026-07-13T18:00:00.000Z')).toBe('2026-07');
  });

  it('uses local month, year, and daily activity buckets throughout statistics', () => {
    const state: MovieLogState = {
      films: {},
      history: [
        entry('local-december', '2027-01-01T06:30:00.000Z'),
        entry('local-january', '2027-01-01T19:00:00.000Z')
      ],
      libraryItems: [],
      watchedFolders: []
    };
    const stats = readArchiveStats(state, new Date('2027-01-02T06:00:00.000Z'));

    expect(stats.months.map((month) => [month.key, month.count])).toEqual([
      ['2026-12', 1],
      ['2027-01', 1]
    ]);
    expect(stats.years).toEqual([
      { count: 1, year: 2026 },
      { count: 1, year: 2027 }
    ]);
    expect(stats.activity.find((day) => day.date === '2026-12-31')?.count).toBe(1);
    expect(stats.activity.find((day) => day.date === '2027-01-01')?.count).toBe(1);
  });

  it('selects and labels the Diary active month from local calendar parts', async () => {
    const { DiaryView } = await import('../src/views/diary.js');
    const state: MovieLogState = {
      films: {},
      history: [
        entry('local-december', '2027-01-01T06:30:00.000Z'),
        entry('earlier-december', '2026-12-15T19:00:00.000Z')
      ],
      libraryItems: [],
      watchedFolders: []
    };
    const tree = renderTree(
      createElement(DiaryView, {
        diaryMode: 'timeline',
        onDiaryModeChange: () => {},
        onOpenLogPanel: () => {},
        onSelectPath: () => {},
        onUpdateEntry: async () => {},
        state
      })
    );

    expect(readText(findByClass(tree, 'month-summary-title'))).toContain('December 2026');
    expect(readText(findByClass(tree, 'month-metrics'))).toContain('Viewings2');
  });
});

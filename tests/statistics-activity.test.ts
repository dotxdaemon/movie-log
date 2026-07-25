// ABOUTME: Verifies the yearly activity ledger exposes calendar orientation and unambiguous time labels.
// ABOUTME: Pins week and weekday coordinates, visible month anchors, and accessible daily values.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { readArchiveStats } from '../src/archive-model.js';
import { StatisticsView } from '../src/views/statistics.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, readText, renderTree } from './render-tree.js';

const state: MovieLogState = {
  films: {},
  history: [
    {
      id: 'one',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/One.mkv',
      title: 'One',
      watchedAt: '2025-07-16T12:00:00.000Z'
    },
    {
      id: 'two',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/Two.mkv',
      title: 'Two',
      watchedAt: '2026-07-14T12:00:00.000Z'
    }
  ],
  libraryItems: [],
  watchedFolders: []
};

describe('yearly statistics activity', () => {
  it('models each day by calendar week and weekday', () => {
    const stats = readArchiveStats(state, new Date('2026-07-14T12:00:00.000Z'));

    expect(stats.activity).toHaveLength(365);
    expect(stats.activity[0]).toMatchObject({
      date: '2025-07-15',
      week: 0,
      weekday: 2
    });
    expect(stats.activity.at(-1)).toMatchObject({
      date: '2026-07-14',
      week: 52,
      weekday: 2
    });
    expect(stats.months.map((month) => month.label)).toEqual(['Jul 2025', 'Jul 2026']);
  });

  it('renders visible month and weekday anchors with accessible positioned day values', () => {
    const tree = renderTree(
      createElement(StatisticsView, {
        now: new Date('2026-07-14T12:00:00.000Z'),
        state
      })
    );
    const monthLabels = findByClass(tree, 'activity-month-label');
    const weekdays = findByClass(tree, 'activity-weekday');
    const cells = findByClass(tree, 'activity-cell');

    expect(monthLabels.length).toBeGreaterThanOrEqual(11);
    expect(readText(monthLabels)).toContain('Jul 2025');
    expect(readText(monthLabels)).toContain('Jul 2026');
    expect(weekdays.map((weekday) => weekday.text)).toEqual(['Mon', 'Wed', 'Fri']);
    expect(findByClass(tree, 'activity-grid')[0]?.props['aria-hidden']).toBe('true');
    expect(cells[0]?.props['aria-label']).toBeUndefined();
    expect(cells[0]?.props.role).toBeUndefined();
    expect(cells[0]?.props.style).toEqual({ gridColumn: 1, gridRow: 3 });
    const summary = findByClass(tree, 'activity-accessible-summary');
    expect(summary).toHaveLength(1);
    expect(readText(summary)).toContain('2025-07-16: 1 viewing');
    expect(readText(summary)).toContain('2026-07-14: 1 viewing');
  });

  it('plots real monthly counts as a thin line with a complete text equivalent', () => {
    const tree = renderTree(
      createElement(StatisticsView, {
        now: new Date('2026-07-14T12:00:00.000Z'),
        state
      })
    );
    const linePath = findByClass(tree, 'monthly-line-path');
    const points = findByClass(tree, 'monthly-line-point');
    const values = findByClass(tree, 'monthly-line-values');

    expect(linePath).toHaveLength(1);
    expect(linePath[0]?.props.d).toBe('M 0.00 14.00 L 720.00 14.00');
    expect(points).toHaveLength(2);
    expect(findByClass(tree, 'monthly-line-point-latest')).toHaveLength(1);
    expect(findByClass(tree, 'monthly-line-plot')[0]?.props['aria-hidden']).toBe('true');
    expect(readText(values)).toContain('Jul 2025: 1 viewing');
    expect(readText(values)).toContain('Jul 2026: 1 viewing');
  });
});

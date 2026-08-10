// ABOUTME: Verifies loading placeholders reuse the structural geometry of their finished views.
// ABOUTME: Pins the Library card anatomy and the full Statistics composition.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ViewSkeleton } from '../src/components/states.js';
import { findByClass, renderTree } from './render-tree.js';

describe('view loading geometry', () => {
  it('mirrors the Library result line and complete card-copy height', () => {
    const tree = renderTree(createElement(ViewSkeleton, { view: 'library' }));

    expect(findByClass(tree, 'library-result-line')).toHaveLength(1);
    expect(findByClass(tree, 'skeleton-toolbar')).toHaveLength(0);
    expect(findByClass(tree, 'skeleton-card-title')).toHaveLength(8);
    expect(findByClass(tree, 'skeleton-card-media')).toHaveLength(8);
    expect(findByClass(tree, 'skeleton-card-meta')).toHaveLength(8);
  });

  it('mirrors the Statistics metrics, coverage, unequal panels, and yearly activity region', () => {
    const tree = renderTree(createElement(ViewSkeleton, { view: 'statistics' }));

    expect(findByClass(tree, 'statistics-loading')[0]?.props).toMatchObject({
      'aria-label': 'Loading statistics',
      role: 'status'
    });
    expect(findByClass(tree, 'metric-strip')).toHaveLength(1);
    expect(findByClass(tree, 'skeleton-statistics-metric')).toHaveLength(8);
    expect(findByClass(tree, 'statistics-coverage')).toHaveLength(1);
    expect(findByClass(tree, 'statistics-panels')).toHaveLength(1);
    expect(findByClass(tree, 'chart-panel')).toHaveLength(6);
    expect(findByClass(tree, 'skeleton-chart-plot')).toHaveLength(6);
    expect(findByClass(tree, 'activity-panel')).toHaveLength(1);
    expect(findByClass(tree, 'skeleton-activity-calendar')).toHaveLength(1);
    expect(findByClass(tree, 'skeleton-panel-row')).toHaveLength(0);
  });
});

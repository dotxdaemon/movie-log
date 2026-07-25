// ABOUTME: Verifies collapsed Diary timelines do not mount an edit form for every historical entry.
// ABOUTME: Pins lazy form mounting to the exact entries whose native details disclosure is expanded.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { DiaryView } from '../src/views/diary.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, renderTree } from './render-tree.js';

const history = Array.from({ length: 120 }, (_, index) => ({
  id: `entry-${index}`,
  source: 'drop' as const,
  sourceKind: 'file' as const,
  sourcePath: `/Movies/Film-${index}.mkv`,
  title: `Film ${index}`,
  watchedAt: new Date(Date.UTC(2026, 6, 24, 12, 0, index)).toISOString()
}));

const state: MovieLogState = {
  films: {},
  history,
  libraryItems: [],
  watchedFolders: []
};

function renderTimeline(
  expandedEntryIds: ReadonlySet<string>,
  onDiaryEntryExpandedChange: (entryId: string, expanded: boolean) => void = () => {}
) {
  return renderTree(
    createElement(DiaryView, {
      diaryMode: 'timeline',
      expandedEntryIds,
      onDiaryEntryExpandedChange,
      onDiaryModeChange: () => {},
      onOpenLogPanel: () => {},
      onSelectPath: () => {},
      onUpdateEntry: async () => {},
      state
    })
  );
}

describe('Diary timeline expansion', () => {
  it('renders all collapsed entry summaries without mounting any annotation forms', () => {
    const tree = renderTimeline(new Set());

    expect(findByClass(tree, 'entry-expand')).toHaveLength(120);
    expect(findByClass(tree, 'entry-form')).toHaveLength(0);
    expect(findByClass(tree, 'entry-annotation')).toHaveLength(0);
  });

  it('mounts a form only for the expanded entry', () => {
    const tree = renderTimeline(new Set(['entry-42']));

    expect(findByClass(tree, 'entry-expand')).toHaveLength(120);
    expect(findByClass(tree, 'entry-form')).toHaveLength(1);
    expect(findByClass(tree, 'entry-annotation')).toHaveLength(1);
  });

  it('reports the entry identity and native disclosure state when a row is toggled', () => {
    const changes: Array<[string, boolean]> = [];
    const tree = renderTimeline(new Set(), (entryId, expanded) => changes.push([entryId, expanded]));
    const disclosure = findByClass(tree, 'entry-expand')[0];

    (disclosure?.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });

    expect(changes).toEqual([['entry-119', true]]);
  });
});

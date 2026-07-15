// ABOUTME: Verifies the Diary mode switcher behaves as a complete keyboard-accessible tab set.
// ABOUTME: Pins tab-panel relationships, roving focus, and Arrow/Home/End navigation.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { DiaryView } from '../src/views/diary.js';
import type { DiaryMode } from '../src/archive-model.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, renderTree } from './render-tree.js';

const state: MovieLogState = {
  films: {},
  history: [
    {
      id: 'entry-1',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/Heat.1995.mkv',
      title: 'Heat.1995',
      watchedAt: '2026-07-14T18:00:00.000Z'
    }
  ],
  libraryItems: [],
  watchedFolders: []
};

const noop = () => {};
const asyncNoop = async () => {};

function renderDiary(mode: DiaryMode, onDiaryModeChange: (mode: DiaryMode) => void = noop) {
  return renderTree(
    createElement(DiaryView, {
      diaryMode: mode,
      onDiaryModeChange,
      onOpenLogPanel: noop,
      onSelectPath: noop,
      onUpdateEntry: asyncNoop,
      state
    })
  );
}

describe('Diary tabs', () => {
  it('connects one visible panel to a roving tab set', () => {
    const tree = renderDiary('ledger');
    const switcher = findByClass(tree, 'view-switcher')[0];
    const tabs = switcher?.children.filter((child) => child.props.role === 'tab') ?? [];
    const panels = findByClass(tree, 'diary-tab-panel');

    expect(switcher?.props.role).toBe('tablist');
    expect(tabs.map((tab) => tab.props.id)).toEqual(['diary-tab-timeline', 'diary-tab-ledger', 'diary-tab-grid']);
    expect(tabs.map((tab) => tab.props['aria-controls'])).toEqual([
      'diary-panel-timeline',
      'diary-panel-ledger',
      'diary-panel-grid'
    ]);
    expect(tabs.map((tab) => tab.props.tabIndex)).toEqual([-1, 0, -1]);
    expect(panels).toHaveLength(1);
    expect(panels[0]?.props).toMatchObject({
      'aria-labelledby': 'diary-tab-ledger',
      id: 'diary-panel-ledger',
      role: 'tabpanel',
      tabIndex: 0
    });
  });

  it.each([
    ['ArrowRight', 'ledger', 1],
    ['ArrowLeft', 'grid', 2],
    ['Home', 'timeline', 0],
    ['End', 'grid', 2]
  ] as const)('moves selection and focus with %s', (key, expectedMode, expectedFocusIndex) => {
    const changes: DiaryMode[] = [];
    const tree = renderDiary('timeline', (mode) => changes.push(mode));
    const switcher = findByClass(tree, 'view-switcher')[0];
    const tabs = switcher?.children.filter((child) => child.props.role === 'tab') ?? [];
    const focused: number[] = [];
    const focusTargets = [0, 1, 2].map((index) => ({
      focus: () => focused.push(index)
    }));
    const preventDefaultCalls: string[] = [];

    (tabs[0]?.props.onKeyDown as (event: unknown) => void)({
      currentTarget: {
        parentElement: {
          querySelectorAll: () => focusTargets
        }
      },
      key,
      preventDefault: () => preventDefaultCalls.push(key)
    });

    expect(changes).toEqual([expectedMode]);
    expect(focused).toEqual([expectedFocusIndex]);
    expect(preventDefaultCalls).toEqual([key]);
  });
});

// ABOUTME: Verifies long Search result lists retain a visible, correctly identified keyboard-active option.
// ABOUTME: Pins Arrow navigation, scroll visibility, active-descendant state, and Enter activation.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchView } from '../src/views/search.js';
import type { SearchGroups, SearchResultItem } from '../src/archive-model.js';
import { findByClass, renderTree } from './render-tree.js';

const noop = () => {};

function makeResult(index: number): SearchResultItem {
  return {
    director: `Director ${index}`,
    key: `diary:/Movies/Film-${index}.mkv`,
    kind: 'diary',
    mediaType: 'film',
    pageId: index,
    posterUrl: null,
    sourcePath: `/Movies/Film-${index}.mkv`,
    status: 'Watched Jul 2026',
    title: `Film ${index}`,
    year: 2000 + index
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Search keyboard navigation', () => {
  it('scrolls an off-screen Arrow destination into view and keeps combobox state synchronized', () => {
    const diary = Array.from({ length: 24 }, (_value, index) => makeResult(index));
    const groups: SearchGroups = {
      catalog: [],
      diary,
      flat: diary,
      library: []
    };
    const activeChanges: number[] = [];
    const opened: SearchResultItem[] = [];
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn((id: string) => (id === 'search-option-18' ? { scrollIntoView } : null));
    vi.stubGlobal('document', { getElementById });
    const tree = renderTree(
      createElement(SearchView, {
        activeIndex: 17,
        catalogError: null,
        catalogPending: false,
        groups,
        onActiveIndexChange: (index) => activeChanges.push(index),
        onDismiss: noop,
        onOpenResult: (result) => opened.push(result),
        onSearchQueryChange: noop,
        searchQuery: 'film'
      })
    );
    const search = findByClass(tree, 'archive-search')[0];
    const input = search?.children.find((child) => child.type === 'input');
    const active = findByClass(tree, 'search-result-active')[0];
    const results = findByClass(tree, 'search-result');

    expect(input?.props['aria-activedescendant']).toBe('search-option-17');
    expect(active?.props.id).toBe('search-option-17');
    expect(results.every((result) => result.props.tabIndex === -1)).toBe(true);
    (input?.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
      key: 'ArrowDown',
      preventDefault: noop
    });

    expect(activeChanges).toEqual([18]);
    expect(getElementById).toHaveBeenCalledWith('search-option-18');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    (input?.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
      key: 'Enter',
      preventDefault: noop
    });
    expect(opened).toEqual([diary[17]]);
  });
});

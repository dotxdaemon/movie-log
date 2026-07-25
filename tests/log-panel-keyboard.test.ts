// ABOUTME: Verifies catalog results in the logging sheet can be traversed and chosen from the keyboard.
// ABOUTME: Pins listbox state, scroll visibility, and Enter activation without browser rendering.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogPanel } from '../src/views/log-panel.js';
import type { CatalogSearchResult } from '../shared/types.js';
import { findByClass, renderTree } from './render-tree.js';

const noop = () => {};
const asyncNoop = async () => {};

function makeResult(index: number): CatalogSearchResult {
  return {
    catalogId: `tt${index}`,
    catalogSource: 'imdb',
    description: `Film ${index}`,
    pageId: index,
    posterUrl: null,
    title: `Film ${index}`,
    year: 2000 + index
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LogPanel keyboard navigation', () => {
  it('moves the active catalog result into view and selects it with Enter', () => {
    const filmResults = Array.from({ length: 20 }, (_value, index) => makeResult(index));
    const activeChanges: number[] = [];
    const selections: CatalogSearchResult[] = [];
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn((id: string) => (id === 'log-film-option-13' ? { scrollIntoView } : null));
    vi.stubGlobal('document', { getElementById });

    const tree = renderTree(
      createElement(LogPanel, {
        filmActiveIndex: 12,
        filmError: null,
        filmPending: false,
        filmQuery: 'film',
        filmResults,
        onChooseLogPaths: asyncNoop,
        onClearLogPaths: noop,
        onClose: noop,
        onCreateLog: asyncNoop,
        onFilmActiveIndexChange: (index) => activeChanges.push(index),
        onFilmQueryChange: noop,
        onReviewChange: noop,
        onSelectFilm: (film) => {
          if (film) selections.push(film);
        },
        pendingLogPaths: [],
        review: '',
        saving: false,
        selectedFilm: null
      })
    );
    const search = findByClass(tree, 'film-search-block')[0];
    const input = findByClass(search ? [search] : [], 'field-block')[0]?.children.find(
      (child) => child.type === 'input'
    );
    const active = findByClass(tree, 'film-search-result-active')[0];

    expect(input?.props['aria-activedescendant']).toBe('log-film-option-12');
    expect(active?.props.id).toBe('log-film-option-12');

    (input?.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
      key: 'ArrowDown',
      preventDefault: noop
    });

    expect(activeChanges).toEqual([13]);
    expect(getElementById).toHaveBeenCalledWith('log-film-option-13');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    const movedTree = renderTree(
      createElement(LogPanel, {
        filmActiveIndex: 13,
        filmError: null,
        filmPending: false,
        filmQuery: 'film',
        filmResults,
        onChooseLogPaths: asyncNoop,
        onClearLogPaths: noop,
        onClose: noop,
        onCreateLog: asyncNoop,
        onFilmActiveIndexChange: (index) => activeChanges.push(index),
        onFilmQueryChange: noop,
        onReviewChange: noop,
        onSelectFilm: (film) => {
          if (film) selections.push(film);
        },
        pendingLogPaths: [],
        review: '',
        saving: false,
        selectedFilm: null
      })
    );
    const movedSearch = findByClass(movedTree, 'film-search-block')[0];
    const movedInput = findByClass(movedSearch ? [movedSearch] : [], 'field-block')[0]?.children.find(
      (child) => child.type === 'input'
    );

    (movedInput?.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
      key: 'Enter',
      preventDefault: noop
    });

    expect(selections).toEqual([filmResults[13]]);
  });
});

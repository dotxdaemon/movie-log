// ABOUTME: Verifies Search remembers the real top-level view behind an open dossier.
// ABOUTME: Prevents a dossier opened from Diary or Statistics from falling back to Library.
import { describe, expect, it } from 'vitest';
import { isSearchContext, readSearchReturnView } from '../src/navigation-state.js';

describe('navigation state', () => {
  it('uses the dossier origin when Search opens from a dossier', () => {
    expect(readSearchReturnView('detail', 'diary')).toBe('diary');
    expect(readSearchReturnView('detail', 'statistics')).toBe('statistics');
    expect(readSearchReturnView('detail', 'settings')).toBe('settings');
  });

  it('uses the current top-level view outside a dossier', () => {
    expect(readSearchReturnView('library', 'diary')).toBe('library');
    expect(readSearchReturnView('statistics', 'library')).toBe('statistics');
  });

  it('treats a dossier opened from Search as part of the active Search context', () => {
    expect(isSearchContext('search', 'diary')).toBe(true);
    expect(isSearchContext('detail', 'search')).toBe(true);
    expect(isSearchContext('detail', 'diary')).toBe(false);
    expect(isSearchContext('library', 'search')).toBe(false);
  });
});

// ABOUTME: Verifies that the full Movie Log product brief resolves into real rendered application surfaces.
// ABOUTME: Prevents a visual reskin of one ledger screen from standing in for the requested multi-view app.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ArchiveApplication } from '../src/archive-application.js';
import { defaultArchiveFilters, type ArchiveView } from '../src/archive-model.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, renderTree, readText } from './render-tree.js';

const state: MovieLogState = {
  history: [
    {
      favorite: true,
      id: '2026-07-10T20:00:00.000Z:/Movies/Flow.2024.mkv',
      rating: 4.5,
      review: 'Quiet, precise, and unexpectedly moving.',
      rewatch: true,
      source: 'drop',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      tags: ['Animation', 'Drama'],
      title: 'Flow.2024',
      viewingFormat: 'Digital',
      watchedAt: '2026-07-10T20:00:00.000Z'
    },
    {
      id: '2026-06-18T08:00:00.000Z:/Movies/Heat.1995.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/Heat.1995.mkv',
      title: 'Heat.1995',
      watchedAt: '2026-06-18T08:00:00.000Z'
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-07-10T20:00:00.000Z',
      folderId: 'movies',
      folderPath: '/Movies',
      id: 'dev:1',
      lastSeenAt: '2026-07-10T20:00:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      title: 'Flow.2024'
    }
  ],
  watchedFolders: [
    {
      addedAt: '2026-06-01T12:00:00.000Z',
      id: 'movies',
      lastScannedAt: '2026-07-10T20:00:00.000Z',
      name: 'Movies',
      path: '/Movies'
    }
  ]
};

const noop = () => {};
const asyncNoop = async () => {};

const baseProps: Parameters<typeof ArchiveApplication>[0] = {
  activeView: 'diary',
  dataFilePath: '/Data/movie-log.json',
  diaryMode: 'timeline',
  dropActive: false,
  feedback: null,
  filters: defaultArchiveFilters,
  loading: false,
  logPanelOpen: false,
  noteFilePath: '/Data/movie-log-note.md',
  onAddWatchedFolders: asyncNoop,
  onChooseLogPaths: asyncNoop,
  onClearLogPaths: noop,
  onCloseLogPanel: noop,
  onCopyPath: asyncNoop,
  onCreateLog: asyncNoop,
  onDiaryModeChange: noop,
  onDrop: noop,
  onDropActiveChange: noop,
  onFeedbackDismiss: noop,
  onFilterChange: noop,
  onOpenInFinder: asyncNoop,
  onOpenItem: asyncNoop,
  onOpenLogPanel: noop,
  onRemoveWatchedFolder: asyncNoop,
  onScanNow: asyncNoop,
  onSearchQueryChange: noop,
  onSelectPath: noop,
  onUpdateEntry: asyncNoop,
  onViewChange: noop,
  pendingLogPaths: [],
  scanInProgress: false,
  searchQuery: '',
  selectedPath: null,
  state
};

function renderSurface(activeView: ArchiveView, overrides: Partial<typeof baseProps> = {}) {
  return renderTree(createElement(ArchiveApplication, { ...baseProps, ...overrides, activeView }));
}

describe('ArchiveApplication', () => {
  it('renders five real navigation modes plus the logging action on desktop and mobile', () => {
    const tree = renderSurface('diary');

    expect(findByClass(tree, 'primary-navigation')).toHaveLength(1);
    expect(findByClass(tree, 'nav-item')).toHaveLength(5);
    expect(findByClass(tree, 'mobile-nav-item')).toHaveLength(5);
    expect(findByClass(tree, 'log-action')).not.toHaveLength(0);
    expect(readText(tree)).toContain('Diary');
    expect(readText(tree)).toContain('Library');
    expect(readText(tree)).toContain('Search');
    expect(readText(tree)).toContain('Statistics');
    expect(readText(tree)).toContain('Settings');
    expect(readText(tree)).toContain('Log a Film');
  });

  it('renders the diary summary, view switcher, annotated entries, and expandable review', () => {
    const tree = renderSurface('diary');

    expect(findByClass(tree, 'month-summary')).toHaveLength(1);
    expect(findByClass(tree, 'view-switcher')).toHaveLength(1);
    expect(findByClass(tree, 'diary-entry')).toHaveLength(2);
    expect(findByClass(tree, 'rating-display')).toHaveLength(1);
    expect(findByClass(tree, 'tag-list')).toHaveLength(1);
    expect(findByClass(tree, 'diary-entry-review')).toHaveLength(1);
    expect(readText(tree)).toContain('Quiet, precise, and unexpectedly moving.');
  });

  it('renders a filterable poster-ratio library from actual archive items', () => {
    const tree = renderSurface('library');

    expect(findByClass(tree, 'filter-toolbar')).toHaveLength(1);
    expect(findByClass(tree, 'movie-grid')).toHaveLength(1);
    expect(findByClass(tree, 'movie-card')).toHaveLength(2);
    expect(findByClass(tree, 'poster-plate')).toHaveLength(2);
    expect(readText(tree)).toContain('Decade');
    expect(readText(tree)).toContain('Rating');
    expect(readText(tree)).toContain('Rewatch');
    expect(readText(tree)).toContain('Tags');
  });

  it('groups search results from diary history and the current library', () => {
    const tree = renderSurface('search', { searchQuery: 'Flow' });

    expect(findByClass(tree, 'search-groups')).toHaveLength(1);
    expect(findByClass(tree, 'search-group')).toHaveLength(2);
    expect(findByClass(tree, 'search-result')).not.toHaveLength(0);
    expect(readText(tree)).toContain('Diary history');
    expect(readText(tree)).toContain('Current library');
  });

  it('renders editorial statistics and the yearly activity ledger from real entries', () => {
    const tree = renderSurface('statistics');

    expect(findByClass(tree, 'metric-strip')).toHaveLength(1);
    expect(findByClass(tree, 'monthly-chart')).toHaveLength(1);
    expect(findByClass(tree, 'rating-chart')).toHaveLength(1);
    expect(findByClass(tree, 'activity-grid')).toHaveLength(1);
    expect(findByClass(tree, 'activity-cell')).toHaveLength(84);
  });

  it('renders settings with watched folders, current contents, and durable file paths', () => {
    const tree = renderSurface('settings');

    expect(findByClass(tree, 'settings-view')).toHaveLength(1);
    expect(findByClass(tree, 'watched-folder-list')).toHaveLength(1);
    expect(findByClass(tree, 'current-contents-list')).toHaveLength(1);
    expect(readText(tree)).toContain('/Data/movie-log.json');
    expect(readText(tree)).toContain('/Data/movie-log-note.md');
  });

  it('renders a selected movie dossier with viewing history and a persistent annotation form', () => {
    const tree = renderSurface('detail', { selectedPath: '/Movies/Flow.2024.mkv' });

    expect(findByClass(tree, 'movie-dossier')).toHaveLength(1);
    expect(findByClass(tree, 'viewing-history')).toHaveLength(1);
    expect(findByClass(tree, 'entry-form')).toHaveLength(1);
    expect(findByClass(tree, 'rating-control')).toHaveLength(1);
    expect(findByClass(tree, 'rating-segment')).toHaveLength(10);
    expect(readText(tree)).toContain('Viewing format');
    expect(readText(tree)).toContain('Favorite');
    expect(readText(tree)).toContain('Rewatch');
  });

  it('renders the real logging sheet with native media selection and complete diary fields', () => {
    const tree = renderSurface('diary', {
      logPanelOpen: true,
      pendingLogPaths: ['/Movies/Flow.2024.mkv']
    });

    expect(findByClass(tree, 'log-backdrop')).toHaveLength(1);
    expect(findByClass(tree, 'log-sheet')).toHaveLength(1);
    expect(findByClass(tree, 'selected-media')).toHaveLength(1);
    expect(findByClass(tree, 'entry-form')).toHaveLength(1);
    expect(findByClass(tree, 'rating-segment')).toHaveLength(10);
    expect(readText(tree)).toContain('Choose Media');
    expect(readText(tree)).toContain('Viewing date');
    expect(readText(tree)).toContain('Review');
    expect(readText(tree)).toContain('Tags');
    expect(readText(tree)).toContain('Viewing format');
  });

  it('uses dimension-preserving loading surfaces instead of the empty state during startup', () => {
    const tree = renderSurface('diary', { loading: true });

    expect(findByClass(tree, 'screen-loading')).toHaveLength(1);
    expect(findByClass(tree, 'loading-row')).toHaveLength(6);
    expect(findByClass(tree, 'blank-slate')).toHaveLength(0);
  });
});

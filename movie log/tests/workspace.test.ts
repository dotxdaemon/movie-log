// ABOUTME: Verifies that the renderer workspace resolves into one clean layout with header, entries, and sidebar.
// ABOUTME: Uses a resolved React tree so the redesign can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { MovieLogWorkspace } from '../src/App.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, renderTree, readText } from './render-tree.js';

const state: MovieLogState = {
  history: [
    {
      id: '2026-03-19T10:00:00.000Z:/Volumes/blve/movies/Flow.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/Flow.mkv',
      title: 'Flow',
      watchedAt: '2026-03-19T10:00:00.000Z'
    },
    {
      id: '2026-03-21T10:00:00.000Z:/Volumes/blve/movies/Flow.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/Flow.mkv',
      title: 'Flow',
      watchedAt: '2026-03-21T10:00:00.000Z'
    },
    {
      id: '2026-03-18T08:15:00.000Z:/Volumes/blve/movies/The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv',
      title: 'The Plague',
      watchedAt: '2026-03-18T08:15:00.000Z'
    }
  ],
  libraryItems: [],
  watchedFolders: [
    {
      addedAt: '2026-03-17T09:00:00.000Z',
      id: '/Volumes/blve/movies',
      lastScannedAt: '2026-03-19T10:00:00.000Z',
      name: 'movies',
      path: '/Volumes/blve/movies'
    }
  ]
};

function noop(): void {}

describe('MovieLogWorkspace', () => {
  it('renders a clean layout with header, entries panel, and sidebar', () => {
    const tree = renderTree(
      createElement(MovieLogWorkspace, {
        dropActive: false,
        errorMessage: '',
        noteFilePath: '/tmp/movie-log-note.md',
        onAddWatchedFolders: async () => {},
        onCopyPath: async () => {},
        onDrop: noop,
        onDropActiveChange: noop,
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        scanInProgress: false,
        searchQuery: '',
        state
      })
    );

    expect(findByClass(tree, 'workspace-stack')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-head')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-search')).toHaveLength(1);
    expect(findByClass(tree, 'content-grid')).toHaveLength(1);
    expect(findByClass(tree, 'entries-panel')).toHaveLength(1);
    expect(findByClass(tree, 'sidebar')).toHaveLength(1);
    expect(findByClass(tree, 'sidebar-card')).toHaveLength(1);
    expect(findByClass(tree, 'sunbeam-field')).toHaveLength(0);
    expect(findByClass(tree, 'gallery-frame')).toHaveLength(0);
    expect(findByClass(tree, 'botanical-edge')).toHaveLength(0);
    expect(findByClass(tree, 'focal-seat')).toHaveLength(0);
    expect(findByClass(tree, 'poster-head')).toHaveLength(0);
    expect(findByClass(tree, 'record-row')).toHaveLength(2);
    const text = readText(tree);
    expect(text).toContain('Movie Log');
    expect(text).toContain('Add Folder');
    expect(text).toContain('Flow');
    expect(text).toContain('The Plague');
    expect(text).toContain('2 entries across 1 folder');
  });

  it('shows filtered results when searching', () => {
    const tree = renderTree(
      createElement(MovieLogWorkspace, {
        dropActive: false,
        errorMessage: '',
        noteFilePath: '/tmp/movie-log-note.md',
        onAddWatchedFolders: async () => {},
        onCopyPath: async () => {},
        onDrop: noop,
        onDropActiveChange: noop,
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        scanInProgress: false,
        searchQuery: 'Flow',
        state
      })
    );

    const text = readText(tree);
    expect(text).toContain('1 result from 2 entries');
    expect(text).toContain('Flow');
    expect(findByClass(tree, 'record-row')).toHaveLength(1);
  });

  it('shows a blank state when search matches nothing', () => {
    const tree = renderTree(
      createElement(MovieLogWorkspace, {
        dropActive: false,
        errorMessage: '',
        noteFilePath: '/tmp/movie-log-note.md',
        onAddWatchedFolders: async () => {},
        onCopyPath: async () => {},
        onDrop: noop,
        onDropActiveChange: noop,
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        scanInProgress: false,
        searchQuery: 'missing',
        state
      })
    );

    const text = readText(tree);
    expect(text).toContain('No matches');
    expect(findByClass(tree, 'record-row')).toHaveLength(0);
  });
});

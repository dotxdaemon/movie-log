// ABOUTME: Verifies that the renderer workspace resolves into one focal form with overlaid archive context.
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
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-03-17T09:00:00.000Z',
      folderId: '/Volumes/blve/movies',
      folderPath: '/Volumes/blve/movies',
      id: 'dev:1',
      lastSeenAt: '2026-03-19T10:00:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/Flow.mkv',
      title: 'Flow'
    }
  ],
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
  it('renders one figure body with a command strip, figure ledger, archive band, and route talisman', () => {
    const tree = renderTree(
      createElement(MovieLogWorkspace, {
        activeInspectorTab: 'contents',
        dropActive: false,
        errorMessage: '',
        logFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log.json',
        noteFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log-note.md',
        onAddWatchedFolders: async () => {},
        onCopyPath: async () => {},
        onDrop: noop,
        onDropActiveChange: noop,
        onSelectInspectorTab: noop,
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

    expect(findByClass(tree, 'figure-layout')).toHaveLength(1);
    expect(findByClass(tree, 'figure-head')).toHaveLength(1);
    expect(findByClass(tree, 'figure-mark')).toHaveLength(1);
    expect(findByClass(tree, 'command-strip')).toHaveLength(1);
    expect(findByClass(tree, 'figure-ledger')).toHaveLength(1);
    expect(findByClass(tree, 'archive-band')).toHaveLength(1);
    expect(findByClass(tree, 'talisman-stack')).toHaveLength(1);
    expect(findByClass(tree, 'route-talisman')).toHaveLength(1);
    expect(findByClass(tree, 'form-head')).toHaveLength(0);
    expect(findByClass(tree, 'search-strip')).toHaveLength(0);
    expect(findByClass(tree, 'history-stream')).toHaveLength(0);
    expect(findByClass(tree, 'battle-layout')).toHaveLength(0);
    expect(findByClass(tree, 'history-ledger')).toHaveLength(0);
    expect(findByClass(tree, 'archive-shard')).toHaveLength(0);
    expect(findByClass(tree, 'route-stack')).toHaveLength(0);
    expect(findByClass(tree, 'record-row')).toHaveLength(1);
    const text = readText(tree);
    expect(text).toContain('Movie Log');
    expect(text).toContain('Arrivals');
    expect(text).toContain('Archive');
    expect(text).toContain('Contents');
    expect(text).toContain('Note');
    expect(text).toContain('Store');
    expect(text).toContain('Add Folder');
    const routeText = readText(findByClass(tree, 'signal-route'));
    expect(routeText).toContain('Added Mar 17');
    expect(routeText).not.toContain('Seen Mar 19');
    const historyText = readText(findByClass(tree, 'record-row'));
    expect(historyText).toContain('Mar 19');
    expect(historyText).not.toContain('Mar 21');
    const archiveText = readText(findByClass(tree, 'snapshot-row'));
    expect(archiveText).toContain('Added Mar 17');
    expect(archiveText).not.toContain('Seen Mar 19');
    expect(text).toContain('1 entry recorded across 1 route.');
    expect(text).toContain('1 entry');
    expect(text).not.toContain('2 entries recorded');
    expect(text).toContain('Show in Finder');
    expect(text).toContain('More');
  });

  it('can switch the archive band context without losing the figure body', () => {
    const tree = renderTree(
      createElement(MovieLogWorkspace, {
        activeInspectorTab: 'note',
        dropActive: false,
        errorMessage: '',
        logFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log.json',
        noteFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log-note.md',
        onAddWatchedFolders: async () => {},
        onCopyPath: async () => {},
        onDrop: noop,
        onDropActiveChange: noop,
        onSelectInspectorTab: noop,
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

    expect(findByClass(tree, 'figure-body')).toHaveLength(1);
    expect(findByClass(tree, 'archive-band')).toHaveLength(1);
    expect(findByClass(tree, 'archive-tabs')).toHaveLength(1);
    const text = readText(tree);
    expect(text).toContain('Movie Log');
    expect(text).toContain('Arrivals');
    expect(text).toContain('Field Note');
    expect(text).toContain('Open Note');
    expect(text).toContain('Copy Note Path');
  });
});

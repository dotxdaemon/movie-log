// ABOUTME: Verifies that the renderer workspace resolves into one history-first layout with embedded routes and contextual archive detail.
// ABOUTME: Uses a resolved React tree so the redesign can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { MovieLogWorkspace } from '../src/App.js';
import type { MovieLogState } from '../shared/types.js';
import { findByClass, renderTree, readText } from './render-tree.js';

const flowEntryId = '2026-03-19T10:00:00.000Z:/Volumes/blve/movies/Flow.mkv';
const plagueEntryId = '2026-03-18T08:15:00.000Z:/Volumes/blve/movies/The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv';

const state: MovieLogState = {
  history: [
    {
      id: flowEntryId,
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
      id: plagueEntryId,
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv',
      title: 'The Plague',
      watchedAt: '2026-03-18T08:15:00.000Z'
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
    },
    {
      firstSeenAt: '2026-03-16T07:00:00.000Z',
      folderId: '/Volumes/blve/movies',
      folderPath: '/Volumes/blve/movies',
      id: 'dev:2',
      lastSeenAt: '2026-03-18T08:15:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv',
      title: 'The Plague'
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
  it('renders one dominant history workspace with embedded routes and a contextual archive inspector', () => {
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
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        onSelectHistoryEntry: noop,
        onSelectInspectorTab: noop,
        scanInProgress: false,
        searchQuery: '',
        selectedHistoryEntryId: null,
        state
      })
    );

    expect(findByClass(tree, 'workspace-stack')).toHaveLength(1);
    expect(findByClass(tree, 'history-panel')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-head')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-search')).toHaveLength(1);
    expect(findByClass(tree, 'history-layout')).toHaveLength(1);
    expect(findByClass(tree, 'history-panel-body')).toHaveLength(1);
    expect(findByClass(tree, 'routes-block')).toHaveLength(1);
    expect(findByClass(tree, 'archive-panel')).toHaveLength(1);
    expect(findByClass(tree, 'archive-tabs')).toHaveLength(1);
    expect(findByClass(tree, 'routes-panel')).toHaveLength(0);
    expect(findByClass(tree, 'workspace-grid')).toHaveLength(0);
    expect(findByClass(tree, 'poster-figure')).toHaveLength(0);
    expect(findByClass(tree, 'figure-headpiece')).toHaveLength(0);
    expect(findByClass(tree, 'figure-torso')).toHaveLength(0);
    expect(findByClass(tree, 'figure-sleeve-left')).toHaveLength(0);
    expect(findByClass(tree, 'figure-sleeve-right')).toHaveLength(0);
    expect(findByClass(tree, 'figure-waist')).toHaveLength(0);
    expect(findByClass(tree, 'archive-satchel')).toHaveLength(0);
    expect(findByClass(tree, 'satchel-strap')).toHaveLength(0);
    expect(findByClass(tree, 'talisman-strap')).toHaveLength(0);
    expect(findByClass(tree, 'record-row')).toHaveLength(2);
    const text = readText(tree);
    expect(text).toContain('Arrivals');
    expect(text).toContain('Archive');
    expect(text).toContain('Routes');
    expect(text).toContain('Note');
    expect(text).toContain('Store');
    expect(text).toContain('Add Folder');
    expect(text).not.toContain('Ledger');
    const routeText = readText(findByClass(tree, 'signal-route'));
    expect(routeText).toContain('Added Mar 17');
    expect(routeText).not.toContain('Seen Mar 19');
    const historyText = readText(findByClass(tree, 'record-row'));
    expect(historyText).toContain('Mar 19');
    expect(historyText).not.toContain('Mar 21');
    expect(historyText).toContain('The Plague');
    const archiveText = readText(findByClass(tree, 'archive-panel'));
    expect(archiveText).toContain('Flow');
    expect(archiveText).not.toContain('The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv');
    const snapshotText = readText(findByClass(tree, 'snapshot-row'));
    expect(snapshotText).toContain('Flow');
    expect(snapshotText).toContain('Added Mar 17');
    expect(snapshotText).not.toContain('Seen Mar 19');
    expect(text).toContain('2 entries recorded across 1 route.');
    expect(text).toContain('2 entries');
    expect(text).toContain('Show in Finder');
    expect(text).toContain('More');
  });

  it('falls back the archive inspector to the first visible row when the selected row is filtered out', () => {
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
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        onSelectHistoryEntry: noop,
        onSelectInspectorTab: noop,
        scanInProgress: false,
        searchQuery: 'Flow',
        selectedHistoryEntryId: plagueEntryId,
        state
      })
    );

    const text = readText(tree);
    expect(text).toContain('1 entry shown from 2 entries.');
    expect(text).toContain('Flow');
    expect(text).not.toContain('The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265.mkv');
  });

  it('shows an empty contextual inspector when no history entries remain after filtering', () => {
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
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        onRemoveWatchedFolder: async () => {},
        onScanNow: async () => {},
        onSearchQueryChange: noop,
        onSelectHistoryEntry: noop,
        onSelectInspectorTab: noop,
        scanInProgress: false,
        searchQuery: 'missing',
        selectedHistoryEntryId: flowEntryId,
        state
      })
    );

    const text = readText(tree);
    expect(text).toContain('No matching history entries');
    expect(text).toContain('No arrival selected');
    expect(findByClass(tree, 'snapshot-row')).toHaveLength(0);
  });
});

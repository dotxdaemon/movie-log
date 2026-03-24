// ABOUTME: Verifies that the renderer workspace keeps the ledger visible beside the integrated inspector.
// ABOUTME: Uses server rendering so the cinematic archive structure can regress without Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MovieLogWorkspace } from '../src/App.js';
import type { MovieLogState } from '../shared/types.js';

const state: MovieLogState = {
  history: [
    {
      id: '2026-03-19T10:00:00.000Z:/Volumes/blve/movies/Flow.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Volumes/blve/movies/Flow.mkv',
      title: 'Flow',
      watchedAt: '2026-03-19T10:00:00.000Z'
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-03-19T10:00:00.000Z',
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
      addedAt: '2026-03-19T09:00:00.000Z',
      id: '/Volumes/blve/movies',
      lastScannedAt: '2026-03-19T10:00:00.000Z',
      name: 'movies',
      path: '/Volumes/blve/movies'
    }
  ]
};

function noop(): void {}

describe('MovieLogWorkspace', () => {
  it('renders the ledger as a permanent workspace beside an integrated archive inspector', () => {
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('workspace-band');
    expect(markup).toContain('band-frame');
    expect(markup).toContain('workspace-body');
    expect(markup).toContain('ledger-field');
    expect(markup).toContain('inspector-panel');
    expect(markup).toContain('inspector-tabs');
    expect(markup).toContain('title-band');
    expect(markup).toContain('search-panel');
    expect(markup).toContain('field-ledger');
    expect(markup).toContain('archive-spine-head');
    expect(markup).toContain('route-strip');
    expect(markup).toContain('Search titles, paths, or routes');
    expect(markup).toContain('Watch Routes');
    expect(markup).toContain('Movie Log');
    expect(markup).toContain('Signal Archive');
    expect(markup).toContain('Archive Index');
    expect(markup).toContain('Current Contents');
    expect(markup).toContain('Readable Note');
    expect(markup).toContain('Data Store');
    expect(markup).toContain('Show in Finder');
    expect(markup).toContain('More');
    expect(markup).not.toContain('wordmark-stack');
    expect(markup).not.toContain('search-band');
    expect(markup).not.toContain('ledger-pane');
    expect(markup).not.toContain('archive-inspector');
    expect(markup).not.toContain('inspector-switcher');
  });

  it('can switch the integrated archive inspector without leaving the ledger', () => {
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('Movie Log');
    expect(markup).toContain('Signal Archive');
    expect(markup).toContain('Readable Note');
    expect(markup).toContain('Open Note');
    expect(markup).toContain('Copy Note Path');
    expect(markup).toContain('inspector-tabs');
    expect(markup).not.toContain('search-band');
    expect(markup).not.toContain('archive-inspector');
  });
});

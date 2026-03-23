// ABOUTME: Verifies that the renderer workspace defaults to the arrival ledger and can switch to details.
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
  it('renders the log view as a poster-led arrival index and keeps reference material out of the main workspace', () => {
    const markup = renderToStaticMarkup(
      createElement(MovieLogWorkspace, {
        activeView: 'log',
        dropActive: false,
        errorMessage: '',
        logFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log.json',
        noteFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log-note.md',
        onActivateDetails: noop,
        onActivateLog: noop,
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

    expect(markup).toContain('Arrival Index');
    expect(markup).toContain('Watch Routes');
    expect(markup).toContain('Show in Finder');
    expect(markup).toContain('More');
    expect(markup).toContain('WATCH / SEARCH / SCAN');
    expect(markup).not.toContain('Readable Note');
    expect(markup).not.toContain('App Store');
    expect(markup).not.toContain('Current top-level contents');
  });

  it('renders the details view with archive files and reference paths', () => {
    const markup = renderToStaticMarkup(
      createElement(MovieLogWorkspace, {
        activeView: 'details',
        dropActive: false,
        errorMessage: '',
        logFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log.json',
        noteFilePath: '/Users/seankim/Library/Application Support/Movie Log/movie-log/movie-log-note.md',
        onActivateDetails: noop,
        onActivateLog: noop,
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

    expect(markup).toContain('Back to Log');
    expect(markup).toContain('Archive Files');
    expect(markup).toContain('Readable Note');
    expect(markup).toContain('Data Store');
    expect(markup).toContain('NOTE / STORE / CONTENTS');
    expect(markup).not.toContain('Nothing logged yet');
  });
});

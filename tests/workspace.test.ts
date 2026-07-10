// ABOUTME: Verifies that the renderer workspace resolves into one tailored ledger composition.
// ABOUTME: Uses a resolved React tree so the visual contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MovieLogWorkspace } from '../src/App.js';
import { createDropFeedbackMessage, createScanFeedbackMessage } from '../src/feedback.js';
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
      title: 'The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265',
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

type WorkspaceProps = Parameters<typeof MovieLogWorkspace>[0];

const baseProps: WorkspaceProps = {
  dropActive: false,
  feedback: null,
  noteFilePath: '/tmp/movie-log-note.md',
  onAddWatchedFolders: async () => {},
  onCopyPath: async () => {},
  onDrop: noop,
  onDropActiveChange: noop,
  onFeedbackDismiss: noop,
  onOpenInFinder: async () => {},
  onOpenItem: async () => {},
  onRemoveWatchedFolder: async () => {},
  onScanNow: async () => {},
  onSearchQueryChange: noop,
  scanInProgress: false,
  searchQuery: '',
  state
};

function renderWorkspace(overrides: Partial<WorkspaceProps> = {}) {
  return renderTree(createElement(MovieLogWorkspace, { ...baseProps, ...overrides }));
}

describe('MovieLogWorkspace', () => {
  it('renders a tailored workspace with one integrated command bar and ledger surface', () => {
    const tree = renderWorkspace();

    expect(findByClass(tree, 'workspace-stack')).toHaveLength(1);
    expect(findByClass(tree, 'tailored-stage')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-head')).toHaveLength(1);
    expect(findByClass(tree, 'entry-count')).toHaveLength(0);
    expect(findByClass(tree, 'workspace-search')).toHaveLength(1);
    expect(findByClass(tree, 'tailored-room')).toHaveLength(1);
    expect(findByClass(tree, 'command-bar')).toHaveLength(1);
    expect(findByClass(tree, 'ledger-surface')).toHaveLength(1);
    expect(findByClass(tree, 'records-frame')).toHaveLength(1);
    expect(findByClass(tree, 'record-menu')).toHaveLength(2);
    expect(findByClass(tree, 'record-menu-trigger')).toHaveLength(2);
    expect(findByClass(tree, 'record-menu-panel')).toHaveLength(2);
    expect(findByClass(tree, 'record-actions')).toHaveLength(0);
    expect(findByClass(tree, 'couture-stage')).toHaveLength(0);
    expect(findByClass(tree, 'atelier-head')).toHaveLength(0);
    expect(findByClass(tree, 'coat-field')).toHaveLength(0);
    expect(findByClass(tree, 'coat-wing')).toHaveLength(0);
    expect(findByClass(tree, 'command-strip')).toHaveLength(0);
    expect(findByClass(tree, 'coat-panel')).toHaveLength(0);
    expect(findByClass(tree, 'route-tools')).toHaveLength(0);
    expect(findByClass(tree, 'wall-gallery')).toHaveLength(0);
    expect(findByClass(tree, 'routes-frame')).toHaveLength(0);
    expect(findByClass(tree, 'botanical-edge')).toHaveLength(0);
    expect(findByClass(tree, 'prism')).toHaveLength(0);
    expect(findByClass(tree, 'record-row')).toHaveLength(2);
    const text = readText(tree);
    expect(text).toContain('Movie Log');
    expect(text).toContain('Add Folder');
    expect(text).toContain('Flow');
    expect(text).toContain('The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265');
    expect(text).toContain('Reveal');
    expect(text).toContain('Copy Path');
    expect(text).toContain('2 entries across 1 folder');
  });

  it('uses the ledger summary as the only entry count', () => {
    const tree = renderWorkspace();

    const head = findByClass(tree, 'workspace-head');
    expect(head).toHaveLength(1);
    expect(findByClass(head, 'workspace-title')).toHaveLength(1);
    expect(findByClass(head, 'entry-count')).toHaveLength(0);
    expect(findByClass(tree, 'issue-mark')).toHaveLength(0);
    expect(readText(head).match(/2 entries/g)).toHaveLength(1);
  });

  it('groups the ledger into calendar-day sections', () => {
    const tree = renderWorkspace();

    expect(findByClass(tree, 'record-day')).toHaveLength(2);
    expect(findByClass(tree, 'record-day-title')).toHaveLength(2);
    expect(findByClass(tree, 'record-row')).toHaveLength(2);
  });

  it('shows a drop affordance overlay only while dragging', () => {
    const idle = renderWorkspace();
    expect(findByClass(idle, 'drop-overlay')).toHaveLength(0);

    const active = renderWorkspace({ dropActive: true });
    const overlay = findByClass(active, 'drop-overlay');
    expect(overlay).toHaveLength(1);
    expect(readText(overlay)).toContain('Drop to log');
  });

  it('shows filtered results when searching', () => {
    const tree = renderWorkspace({ searchQuery: 'Flow' });

    const text = readText(tree);
    expect(text).toContain('1 result from 2 entries');
    expect(text).toContain('Flow');
    expect(findByClass(tree, 'record-row')).toHaveLength(1);
  });

  it('treats whitespace-only search as no search', () => {
    const tree = renderWorkspace({ searchQuery: '   ' });

    const text = readText(tree);
    expect(text).toContain('2 entries across 1 folder');
    expect(text).not.toContain('result from');
    expect(findByClass(tree, 'record-row')).toHaveLength(2);
  });

  it('clears the search when Escape is pressed', () => {
    const onSearchQueryChange = vi.fn();
    const tree = renderWorkspace({ onSearchQueryChange, searchQuery: 'Flow' });

    const search = findByClass(tree, 'workspace-search')[0];
    const input = search.children.find((node) => node.type === 'input');
    expect(input).toBeDefined();
    const onKeyDown = input?.props.onKeyDown as (event: { key: string }) => void;
    onKeyDown({ key: 'a' });
    onKeyDown({ key: 'Escape' });

    expect(onSearchQueryChange).toHaveBeenCalledTimes(1);
    expect(onSearchQueryChange).toHaveBeenCalledWith('');
  });

  it('keeps the drop highlight while dragging over child elements', () => {
    const onDropActiveChange = vi.fn();
    const tree = renderWorkspace({ dropActive: true, onDropActiveChange });

    const room = findByClass(tree, 'tailored-room')[0];
    const onDragLeave = room.props.onDragLeave as (event: {
      currentTarget: { contains(node: unknown): boolean };
      relatedTarget: unknown;
    }) => void;

    onDragLeave({ currentTarget: { contains: () => true }, relatedTarget: {} });
    expect(onDropActiveChange).not.toHaveBeenCalled();

    onDragLeave({ currentTarget: { contains: () => false }, relatedTarget: null });
    expect(onDropActiveChange).toHaveBeenCalledWith(false);
  });

  it('shows error feedback in an alert banner with a dismiss control', () => {
    const onFeedbackDismiss = vi.fn();
    const tree = renderWorkspace({
      feedback: { message: 'Could not open the file.', tone: 'error' },
      onFeedbackDismiss
    });

    const banner = findByClass(tree, 'status-banner');
    expect(banner).toHaveLength(1);
    expect(banner[0].props.role).toBe('alert');
    expect(banner[0].className).not.toContain('status-banner-notice');
    expect(readText(banner)).toContain('Could not open the file.');

    const dismiss = findByClass(banner, 'status-dismiss');
    expect(dismiss).toHaveLength(1);
    (dismiss[0].props.onClick as () => void)();
    expect(onFeedbackDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows notice feedback in a status banner instead of an alert', () => {
    const tree = renderWorkspace({
      feedback: { message: 'Scan finished. No new items found.', tone: 'notice' }
    });

    const banner = findByClass(tree, 'status-banner');
    expect(banner).toHaveLength(1);
    expect(banner[0].className).toContain('status-banner-notice');
    expect(banner[0].props.role).toBe('status');
    expect(readText(banner)).toContain('Scan finished. No new items found.');
  });

  it('closes the row menu after choosing an action', async () => {
    const onOpenInFinder = vi.fn(async () => {});
    const tree = renderWorkspace({ onOpenInFinder });

    const revealButton = findByClass(tree, 'action-button')[0];
    const removeAttribute = vi.fn();
    const onClick = revealButton.props.onClick as (event: {
      currentTarget: { closest(selector: string): { removeAttribute(name: string): void } | null };
    }) => void;
    onClick({ currentTarget: { closest: () => ({ removeAttribute }) } });

    expect(removeAttribute).toHaveBeenCalledWith('open');
    expect(onOpenInFinder).toHaveBeenCalledWith('/Volumes/blve/movies/Flow.mkv');
  });

  it('reveals full source paths on truncated titles', () => {
    const tree = renderWorkspace();

    const titles = findByClass(tree, 'record-title');
    expect(titles[0].props.title).toBe('/Volumes/blve/movies/Flow.mkv');

    const folderNames = findByClass(tree, 'folder-name');
    expect(folderNames[0].props.title).toBe('/Volumes/blve/movies');
  });

  it('offers drop and folder guidance when the ledger is empty', () => {
    const tree = renderWorkspace({ state: { ...state, history: [] } });

    const text = readText(tree);
    expect(text).toContain('Nothing here yet');
    expect(text).toContain('Drop files here or add a watched folder.');
  });

  it('renders filename-stem titles for release-style filenames', () => {
    const tree = renderWorkspace({
      state: {
        ...state,
        history: [
          {
            id: '2026-03-19T10:00:00.000Z:/Volumes/blve/movies/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv',
            source: 'watch',
            sourceKind: 'file',
            sourcePath:
              '/Volumes/blve/movies/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv',
            title: 'Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS',
            watchedAt: '2026-03-19T10:00:00.000Z'
          }
        ]
      }
    });

    const text = readText(tree);
    expect(text).toContain('Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS');
  });

  it('shows watched-folder scan state and current contents', () => {
    const tree = renderWorkspace({
      state: {
        ...state,
        libraryItems: [
          {
            firstSeenAt: '2026-03-19T10:00:00.000Z',
            folderId: '/Volumes/blve/movies',
            folderPath: '/Volumes/blve/movies',
            id: '/Volumes/blve/movies/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv',
            lastSeenAt: '2026-03-19T10:00:00.000Z',
            sourceKind: 'file',
            sourcePath:
              '/Volumes/blve/movies/Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS.mkv',
            title: 'Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS'
          }
        ]
      }
    });

    const text = readText(tree);
    expect(findByClass(tree, 'folder-state')).toHaveLength(1);
    expect(text).toContain('Current Contents');
    expect(text).toContain('1 current item');
    expect(text).toContain('Last scanned');
    expect(text).toContain('Catch.Me.If.You.Can.2002.BluRay.1080p.x265.10bit.2Audio.MNHD-FRDS');
  });

  it('shows a blank state when search matches nothing', () => {
    const tree = renderWorkspace({ searchQuery: 'missing' });

    const text = readText(tree);
    expect(text).toContain('No matches');
    expect(findByClass(tree, 'record-row')).toHaveLength(0);
  });
});

describe('workspace feedback messages', () => {
  it('names skipped paths from a mixed drop', () => {
    expect(
      createDropFeedbackMessage({
        addedCount: 1,
        skippedPaths: ['/Movies/Poster.jpg', '/Movies/Sample.jpg', '/Movies/Notes.txt', '/Movies/Cover.png']
      })
    ).toBe('Logged 1 item. Skipped 4 paths that could not be logged: Poster.jpg, Sample.jpg, Notes.txt, and 1 more.');
  });

  it('reports a scan that finds no new entries', () => {
    expect(createScanFeedbackMessage(0)).toBe('Scan finished. No new items found.');
  });
});

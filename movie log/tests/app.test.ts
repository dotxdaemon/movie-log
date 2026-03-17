// ABOUTME: Verifies that scanned watched-folder items are visible in the rendered desktop interface.
// ABOUTME: Uses real React rendering output so hidden snapshot data cannot regress silently.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FolderSnapshotPanel } from '../src/folder-snapshot-panel.js';

describe('FolderSnapshotPanel', () => {
  it('renders scanned items from watched folders', () => {
    const markup = renderToStaticMarkup(
      createElement(FolderSnapshotPanel, {
        items: [
          {
            firstSeenAt: '2026-03-12T18:20:00.000Z',
            folderId: '/Volumes/blve/movies',
            folderPath: '/Volumes/blve/movies',
            id: '/Volumes/blve/movies/City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS.mkv',
            lastSeenAt: '2026-03-12T18:20:00.000Z',
            sourceKind: 'file',
            sourcePath: '/Volumes/blve/movies/City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS.mkv',
            title: 'City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS'
          }
        ],
        onCopyPath: async () => {},
        onOpenInFinder: async () => {},
        onOpenItem: async () => {},
        timestampLabel: (isoTime: string) => isoTime
      })
    );

    expect(markup).toContain('Current top-level contents');
    expect(markup).toContain('City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS');
    expect(markup).toContain('/Volumes/blve/movies/City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS.mkv');
  });
});

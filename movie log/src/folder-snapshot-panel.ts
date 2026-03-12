// ABOUTME: Renders the current scanned contents of watched folders inside the desktop interface.
// ABOUTME: Keeps successful folder scans visible even before those items become history entries.
import { createElement } from 'react';
import type { LibraryItem } from '../shared/types.js';

interface FolderSnapshotPanelProps {
  items: LibraryItem[];
  onCopyPath(itemPath: string): Promise<void>;
  onOpenInFinder(itemPath: string): Promise<void>;
  onOpenItem(itemPath: string): Promise<void>;
  timestampLabel(isoTime: string): string;
}

export function FolderSnapshotPanel({
  items,
  onCopyPath,
  onOpenInFinder,
  onOpenItem,
  timestampLabel
}: FolderSnapshotPanelProps) {
  return createElement(
    'article',
    { className: 'panel' },
    createElement(
      'div',
      { className: 'panel-header' },
      createElement(
        'div',
        null,
        createElement('p', { className: 'panel-kicker' }, 'Scanned Items'),
        createElement('h2', null, 'Current folder contents')
      )
    ),
    items.length === 0
      ? createElement(
          'div',
          { className: 'empty-card' },
          createElement('p', { className: 'empty-title' }, 'No scanned items yet'),
          createElement(
            'p',
            { className: 'empty-copy' },
            'Run a folder scan or add a watched folder to see what Movie Log found.'
          )
        )
      : createElement(
          'ul',
          { className: 'stack-list' },
          ...items.map((item) =>
            createElement(
              'li',
              { className: 'list-card', key: item.id },
              createElement(
                'div',
                null,
                createElement('strong', null, item.title),
                createElement('p', { className: 'meta-path' }, item.sourcePath),
                createElement(
                  'p',
                  { className: 'history-time' },
                  `Seen ${timestampLabel(item.lastSeenAt)} • ${item.sourceKind === 'file' ? 'File' : 'Folder'}`
                )
              ),
              createElement(
                'div',
                { className: 'action-row' },
                createElement(
                  'button',
                  { className: 'ghost-button', onClick: () => void onCopyPath(item.sourcePath), type: 'button' },
                  'Copy Path'
                ),
                createElement(
                  'button',
                  { className: 'ghost-button', onClick: () => void onOpenInFinder(item.sourcePath), type: 'button' },
                  'Show in Finder'
                ),
                createElement(
                  'button',
                  {
                    className: 'ghost-button',
                    disabled: item.sourceKind !== 'file',
                    onClick: () => void onOpenItem(item.sourcePath),
                    type: 'button'
                  },
                  'Open'
                )
              )
            )
          )
        )
  );
}

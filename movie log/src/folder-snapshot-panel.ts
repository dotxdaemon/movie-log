// ABOUTME: Renders the current scanned contents of watched folders inside the desktop interface.
// ABOUTME: Keeps successful folder scans visible even before those items become history entries.
import { createElement } from 'react';
import type { LibraryItem } from '../shared/types.js';

interface FolderSnapshotPanelProps {
  compact?: boolean;
  items: LibraryItem[];
  onCopyPath(itemPath: string): Promise<void>;
  onOpenInFinder(itemPath: string): Promise<void>;
  onOpenItem(itemPath: string): Promise<void>;
  timestampLabel(isoTime: string): string;
}

export function FolderSnapshotPanel({
  compact = false,
  items,
  onCopyPath,
  onOpenInFinder,
  onOpenItem,
  timestampLabel
}: FolderSnapshotPanelProps) {
  const body =
    items.length === 0
      ? createElement(
          'div',
          { className: 'blank-slate blank-slate-compact' },
          createElement('p', { className: 'blank-title' }, 'No scanned items yet'),
          createElement(
            'p',
            { className: 'blank-copy' },
            'Run a folder scan or add a watched folder to see what Movie Log found.'
          )
        )
      : createElement(
          'ul',
          { className: 'snapshot-list' },
          ...items.map((item) =>
            createElement(
              'li',
              { className: 'snapshot-row', key: item.id },
              createElement(
                'div',
                null,
                createElement('strong', { className: 'snapshot-title' }, item.title),
                createElement(
                  'p',
                  { className: 'rail-meta' },
                  `Seen ${timestampLabel(item.lastSeenAt)} • ${item.sourceKind === 'file' ? 'File' : 'Folder'}`
                ),
                createElement('p', { className: 'path-line' }, item.sourcePath)
              ),
              createElement(
                'div',
                { className: 'row-actions' },
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
        );
  if (compact) {
    return createElement('div', { className: 'snapshot-body' }, body);
  }

  return createElement(
    'article',
    { className: 'history-ledger' },
    createElement(
      'div',
      { className: 'ledger-header' },
      createElement(
        'div',
        null,
        createElement('h2', null, 'Current top-level contents')
      )
    ),
    body
  );
}

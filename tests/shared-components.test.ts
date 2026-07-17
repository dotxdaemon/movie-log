// ABOUTME: Verifies that navigation, page headers, and sheet mechanics are shared rendered components.
// ABOUTME: Pins the common archive chrome and dialog dismissal behavior outside the application switchboard.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ArchiveNavigation, MobileArchiveNavigation } from '../src/components/archive-navigation.js';
import { PageHeader } from '../src/components/page-header.js';
import { SheetDialog } from '../src/components/sheet-dialog.js';
import { findByClass, renderTree, readText } from './render-tree.js';

const noop = () => {};

describe('shared archive components', () => {
  it('renders the desktop and mobile navigation systems from one item register', () => {
    const desktop = renderTree(
      createElement(ArchiveNavigation, {
        activeView: 'diary',
        onOpenLogPanel: noop,
        onViewChange: noop
      })
    );
    const mobile = renderTree(
      createElement(MobileArchiveNavigation, {
        activeView: 'diary',
        onOpenLogPanel: noop,
        onViewChange: noop
      })
    );

    expect(findByClass(desktop, 'nav-item')).toHaveLength(5);
    expect(findByClass(mobile, 'mobile-nav-item')).toHaveLength(5);
    expect(findByClass(mobile, 'mobile-log-label')).toHaveLength(0);
    expect(readText(mobile)).not.toContain('Log');
    expect(readText(mobile)).toContain('Stats');
    expect(readText(mobile)).not.toContain('Statistics');
  });

  it('renders shared title, search, and logging header actions without duplicating view-local filters', () => {
    const tree = renderTree(
      createElement(PageHeader, {
        activeView: 'library',
        archiveCount: 22,
        coverage: { annotated: 0, failed: 0, matched: 12, pending: 2, retryScheduled: 0, total: 22, unmatched: 8 },
        diaryCount: 98,
        onOpenLogPanel: noop,
        onRetryMetadata: async () => {},
        onSearchQueryChange: noop,
        onViewChange: noop,
        periodLabel: 'JUL 2026',
        searchQuery: ''
      })
    );

    expect(findByClass(tree, 'archive-header')).toHaveLength(1);
    expect(findByClass(tree, 'header-search')).toHaveLength(1);
    expect(findByClass(tree, 'header-filters')).toHaveLength(0);
    expect(findByClass(tree, 'header-log-action')).toHaveLength(1);
    expect(readText(tree)).toContain('Library');
  });

  it('shares backdrop, close, and downward-swipe dismissal across sheets', () => {
    let closeCount = 0;
    const tree = renderTree(
      createElement(
        SheetDialog,
        {
          backdropClassName: 'test-backdrop',
          eyebrow: 'Archive',
          headClassName: 'test-head',
          label: 'Test sheet',
          onClose: () => {
            closeCount += 1;
          },
          sheetClassName: 'test-sheet',
          title: 'Test'
        },
        createElement('p', null, 'Body')
      )
    );
    const backdrop = findByClass(tree, 'test-backdrop')[0];
    const head = findByClass(tree, 'test-head')[0];
    const currentTarget = { dataset: {} as Record<string, string> };

    (backdrop?.props.onClick as () => void)();
    (head?.props.onTouchStart as (event: unknown) => void)({
      changedTouches: [{ clientY: 24 }],
      currentTarget
    });
    (head?.props.onTouchEnd as (event: unknown) => void)({
      changedTouches: [{ clientY: 112 }],
      currentTarget
    });

    expect(closeCount).toBe(2);
    expect(findByClass(tree, 'sheet-close')).toHaveLength(1);
    expect(findByClass(tree, 'test-backdrop')[0]?.props.role).toBe('presentation');
    expect(findByClass(tree, 'test-sheet')[0]?.props.role).toBe('dialog');
    expect(findByClass(tree, 'test-sheet')[0]?.props['aria-modal']).toBe('true');
    expect(findByClass(tree, 'test-sheet')[0]?.props['aria-label']).toBe('Test sheet');
  });
});

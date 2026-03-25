// ABOUTME: Verifies that the desktop shell resolves into one poster stage instead of separate app columns.
// ABOUTME: Uses a resolved React tree so the shell contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';
import { findByClass, renderTree, readText } from './render-tree.js';

describe('App shell', () => {
  it('renders one poster stage with an overlaid signal dock and a focal form', () => {
    const tree = renderTree(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'records-surface' }, 'History'),
        statusSpine: createElement('aside', { className: 'rail-stack' }, 'Status')
      })
    );

    expect(findByClass(tree, 'workspace-shell')).toHaveLength(1);
    expect(findByClass(tree, 'poster-stage')).toHaveLength(1);
    expect(findByClass(tree, 'signal-dock')).toHaveLength(1);
    expect(findByClass(tree, 'focus-form')).toHaveLength(1);
    expect(findByClass(tree, 'echo-figure')).toHaveLength(1);
    expect(findByClass(tree, 'editorial-track')).toHaveLength(1);
    expect(findByClass(tree, 'signal-column')).toHaveLength(0);
    expect(findByClass(tree, 'workspace-frame')).toHaveLength(0);
    expect(findByClass(tree, 'focus-plane')).toHaveLength(0);
    expect(findByClass(tree, 'fracture-shadow')).toHaveLength(0);
    expect(readText(tree)).toContain('History');
    expect(readText(tree)).toContain('Status');
  });
});

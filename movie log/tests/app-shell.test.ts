// ABOUTME: Verifies that the desktop shell resolves into one poster stage instead of separate app columns.
// ABOUTME: Uses a resolved React tree so the shell contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';
import { findByClass, renderTree, readText } from './render-tree.js';

describe('App shell', () => {
  it('renders one portrait stage with an embedded signal cluster and a focal sheet', () => {
    const tree = renderTree(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'records-surface' }, 'History'),
        statusSpine: createElement('aside', { className: 'rail-stack' }, 'Status')
      })
    );

    expect(findByClass(tree, 'workspace-shell')).toHaveLength(1);
    expect(findByClass(tree, 'portrait-stage')).toHaveLength(1);
    expect(findByClass(tree, 'glitch-track')).toHaveLength(1);
    expect(findByClass(tree, 'ceiling-lattice')).toHaveLength(1);
    expect(findByClass(tree, 'frame-line')).toHaveLength(1);
    expect(findByClass(tree, 'editorial-spine')).toHaveLength(1);
    expect(findByClass(tree, 'echo-mass')).toHaveLength(1);
    expect(findByClass(tree, 'signal-cluster')).toHaveLength(1);
    expect(findByClass(tree, 'focus-sheet')).toHaveLength(1);
    expect(findByClass(tree, 'poster-stage')).toHaveLength(0);
    expect(findByClass(tree, 'signal-dock')).toHaveLength(0);
    expect(findByClass(tree, 'focus-form')).toHaveLength(0);
    expect(findByClass(tree, 'echo-figure')).toHaveLength(0);
    expect(findByClass(tree, 'editorial-track')).toHaveLength(0);
    expect(readText(tree)).toContain('History');
    expect(readText(tree)).toContain('Status');
  });
});

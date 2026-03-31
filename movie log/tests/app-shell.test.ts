// ABOUTME: Verifies that the desktop shell resolves into one poster stage instead of separate app columns.
// ABOUTME: Uses a resolved React tree so the shell contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';
import { findByClass, renderTree, readText } from './render-tree.js';

describe('App shell', () => {
  it('renders one battle stage with a warm crown, figure halo, figure body, route talisman, and blade field', () => {
    const tree = renderTree(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'records-surface' }, 'History'),
        statusSpine: createElement('aside', { className: 'rail-stack' }, 'Status')
      })
    );

    expect(findByClass(tree, 'workspace-shell')).toHaveLength(1);
    expect(findByClass(tree, 'battle-stage')).toHaveLength(1);
    expect(findByClass(tree, 'signal-banner')).toHaveLength(1);
    expect(findByClass(tree, 'ember-crown')).toHaveLength(1);
    expect(findByClass(tree, 'frame-line')).toHaveLength(1);
    expect(findByClass(tree, 'editorial-spine')).toHaveLength(1);
    expect(findByClass(tree, 'blade-field')).toHaveLength(1);
    expect(findByClass(tree, 'figure-halo')).toHaveLength(1);
    expect(findByClass(tree, 'figure-body')).toHaveLength(1);
    expect(findByClass(tree, 'route-talisman')).toHaveLength(1);
    expect(findByClass(tree, 'portrait-stage')).toHaveLength(0);
    expect(findByClass(tree, 'glitch-track')).toHaveLength(0);
    expect(findByClass(tree, 'ceiling-lattice')).toHaveLength(0);
    expect(findByClass(tree, 'figure-sheet')).toHaveLength(0);
    expect(findByClass(tree, 'route-rig')).toHaveLength(0);
    expect(readText(tree)).toContain('History');
    expect(readText(tree)).toContain('Status');
  });
});

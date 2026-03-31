// ABOUTME: Verifies that the desktop shell resolves into one minimal stage with one dominant workspace surface.
// ABOUTME: Uses a resolved React tree so the shell contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';
import { findByClass, renderTree, readText } from './render-tree.js';

describe('App shell', () => {
  it('renders one minimal stage with one workspace surface and no standalone routes column', () => {
    const tree = renderTree(
      createElement(AppShell, {
        workspaceStage: createElement('div', { className: 'workspace-stack' }, 'History')
      })
    );

    expect(findByClass(tree, 'workspace-shell')).toHaveLength(1);
    expect(findByClass(tree, 'minimal-stage')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-main')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-stack')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-grid')).toHaveLength(0);
    expect(findByClass(tree, 'routes-panel')).toHaveLength(0);
    expect(findByClass(tree, 'poster-stage')).toHaveLength(0);
    expect(findByClass(tree, 'top-bars')).toHaveLength(0);
    expect(findByClass(tree, 'crown-fracture')).toHaveLength(0);
    expect(findByClass(tree, 'poster-frame')).toHaveLength(0);
    expect(findByClass(tree, 'editorial-spine')).toHaveLength(0);
    expect(findByClass(tree, 'side-glyphs')).toHaveLength(0);
    expect(findByClass(tree, 'blade-field')).toHaveLength(0);
    expect(readText(tree)).toContain('History');
  });
});

// ABOUTME: Verifies that the desktop shell resolves into one dossier field with responsive navigation.
// ABOUTME: Uses a resolved React tree so the shell contract can regress without brittle markup snapshots.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';
import { findByClass, renderTree, readText } from './render-tree.js';

describe('App shell', () => {
  it('renders one dossier field with an integrated structural spine and mobile navigation', () => {
    const tree = renderTree(
      createElement(AppShell, {
        mobileNavigation: createElement('button', { type: 'button' }, 'Add Folder'),
        navigationRail: createElement('span', null, 'Library'),
        workspaceStage: createElement('div', { className: 'dossier-canvas' }, 'History')
      })
    );

    expect(findByClass(tree, 'dossier-shell')).toHaveLength(1);
    expect(findByClass(tree, 'archive-spine')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-stage')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-main')).toHaveLength(1);
    expect(findByClass(tree, 'mobile-nav')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-canvas')).toHaveLength(1);
    expect(findByClass(tree, 'workspace-grid')).toHaveLength(0);
    expect(findByClass(tree, 'routes-panel')).toHaveLength(0);
    expect(readText(tree)).toContain('History');
    expect(readText(tree)).toContain('Library');
    expect(readText(tree)).toContain('Add Folder');
  });

  it('removes desktop and mobile navigation from interaction and the accessibility tree while a modal is open', () => {
    const tree = renderTree(
      createElement(AppShell, {
        mobileNavigation: createElement('button', { type: 'button' }, 'Add Folder'),
        modalOpen: true,
        navigationRail: createElement('span', null, 'Library'),
        workspaceStage: createElement('div', { className: 'dossier-canvas' }, 'History')
      })
    );
    const spine = findByClass(tree, 'archive-spine')[0];
    const mobileNavigation = findByClass(tree, 'mobile-nav')[0];

    expect(spine?.props.inert).toBe(true);
    expect(spine?.props['aria-hidden']).toBe('true');
    expect(mobileNavigation?.props.inert).toBe(true);
    expect(mobileNavigation?.props['aria-hidden']).toBe('true');
  });
});

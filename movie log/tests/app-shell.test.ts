// ABOUTME: Verifies that the desktop shell renders as a utility rail beside a records workspace.
// ABOUTME: Uses server rendering so the high-level UI frame can regress without requiring Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';

describe('App shell', () => {
  it('renders a utility rail beside a records workspace', () => {
    const markup = renderToStaticMarkup(
      createElement(AppShell, {
        contentHeader: createElement('div', { className: 'records-header' }, 'Records'),
        intakeBar: createElement('section', { className: 'drop-inline' }, 'Manual Drop'),
        note: 'local arrivals ledger',
        recordsPanel: createElement('section', { className: 'records-panel' }, 'History'),
        title: 'Movie Log'
      })
    );

    expect(markup).toContain('workspace-frame');
    expect(markup).toContain('utility-rail');
    expect(markup).toContain('records-pane');
    expect(markup).not.toContain('top-bar');
    expect(markup).not.toContain('side-rail');
    expect(markup).not.toContain('history-ledger');
  });
});

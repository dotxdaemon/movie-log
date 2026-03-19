// ABOUTME: Verifies that the desktop shell renders as a utility rail beside a records workspace.
// ABOUTME: Uses server rendering so the high-level UI frame can regress without requiring Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';

describe('App shell', () => {
  it('renders a status spine beside an archive stage', () => {
    const markup = renderToStaticMarkup(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'archive-sheet' }, 'History'),
        statusSpine: createElement('aside', { className: 'spine-stack' }, 'Status')
      })
    );

    expect(markup).toContain('workspace-frame');
    expect(markup).toContain('status-spine');
    expect(markup).toContain('archive-stage');
    expect(markup).not.toContain('utility-rail');
    expect(markup).not.toContain('records-pane');
  });
});

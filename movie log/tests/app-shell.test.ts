// ABOUTME: Verifies that the desktop shell renders as a utility rail beside a records workspace.
// ABOUTME: Uses server rendering so the high-level UI frame can regress without requiring Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';

describe('App shell', () => {
  it('renders a control slab beside a poster stage', () => {
    const markup = renderToStaticMarkup(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'ledger-plane' }, 'History'),
        statusSpine: createElement('aside', { className: 'control-stack' }, 'Status')
      })
    );

    expect(markup).toContain('workspace-frame');
    expect(markup).toContain('control-slab');
    expect(markup).toContain('poster-forms');
    expect(markup).toContain('poster-stage-inner');
    expect(markup).toContain('poster-stage');
    expect(markup).not.toContain('status-spine');
    expect(markup).not.toContain('archive-stage');
  });
});

// ABOUTME: Verifies that the desktop shell renders as a utility rail beside a records workspace.
// ABOUTME: Uses server rendering so the high-level UI frame can regress without requiring Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';

describe('App shell', () => {
  it('renders an integrated control rail beside the workspace stage', () => {
    const markup = renderToStaticMarkup(
      createElement(AppShell, {
        archiveStage: createElement('section', { className: 'records-surface' }, 'History'),
        statusSpine: createElement('aside', { className: 'rail-stack' }, 'Status')
      })
    );

    expect(markup).toContain('workspace-frame');
    expect(markup).toContain('control-rail');
    expect(markup).toContain('workspace-stage-inner');
    expect(markup).toContain('workspace-stage');
    expect(markup).not.toContain('control-slab');
    expect(markup).not.toContain('poster-forms');
    expect(markup).not.toContain('poster-stage');
  });
});

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
    expect(markup).toContain('glitch-band');
    expect(markup).toContain('perspective-grid');
    expect(markup).toContain('trace-frame');
    expect(markup).toContain('index-spine');
    expect(markup).toContain('workspace-stage-inner');
    expect(markup).toContain('workspace-stage');
    expect(markup).not.toContain('signal-lattice');
    expect(markup).not.toContain('canopy-stack');
    expect(markup).not.toContain('ember-cloud');
    expect(markup).not.toContain('signal-spine');
  });
});

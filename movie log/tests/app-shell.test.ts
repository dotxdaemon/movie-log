// ABOUTME: Verifies that the desktop shell renders as one compact workspace instead of a marketing-style dashboard.
// ABOUTME: Uses server rendering so the high-level UI structure can regress without requiring Electron.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/app-shell.js';

describe('App shell', () => {
  it('renders a compact top bar and ledger-first workspace', () => {
    const markup = renderToStaticMarkup(
      createElement(AppShell, {
        commandBar: createElement('div', { className: 'command-bar' }, 'Commands'),
        historyLedger: createElement('section', { className: 'history-ledger' }, 'History'),
        intakeBar: createElement('section', { className: 'intake-bar' }, 'Manual Drop'),
        note: 'local arrivals ledger',
        sideRail: createElement('aside', { className: 'side-rail' }, 'Rail'),
        title: 'Movie Log'
      })
    );

    expect(markup).toContain('top-bar');
    expect(markup).toContain('command-bar');
    expect(markup).toContain('history-ledger');
    expect(markup).not.toContain('workspace-header');
    expect(markup).not.toContain('command-strip');
  });
});

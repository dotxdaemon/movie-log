// ABOUTME: Renders the shared Movie Log workspace as one reference-led stage with embedded controls and archive context.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  archiveStage: ReactNode;
  statusSpine: ReactNode;
}

export function AppShell({ archiveStage, statusSpine }: AppShellProps) {
  return createElement(
    'main',
    { className: 'workspace-shell' },
    createElement(
      'section',
      { className: 'poster-stage' },
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'top-bars' },
        createElement('span', { className: 'top-bar top-bar-left' }),
        createElement('span', { className: 'top-bar top-bar-center' }),
        createElement('span', { className: 'top-bar top-bar-right' }),
        createElement('span', { className: 'signal-code' }, 'GT.2')
      ),
      createElement('div', { 'aria-hidden': 'true', className: 'crown-fracture' }),
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'side-glyphs' },
        createElement('span', { className: 'side-glyph side-glyph-upper' }),
        createElement('span', { className: 'side-glyph side-glyph-middle' }),
        createElement('span', { className: 'side-glyph side-glyph-lower' })
      ),
      createElement('div', { 'aria-hidden': 'true', className: 'poster-frame' }),
      createElement('div', { 'aria-hidden': 'true', className: 'editorial-spine' }),
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'blade-field' },
        ...Array.from({ length: 8 }, (_, index) => createElement('span', { className: `blade-mark blade-mark-${index + 1}`, key: index }))
      ),
      createElement(
        'div',
        { className: 'poster-column' },
        createElement(
          'aside',
          { className: 'route-talisman' },
          statusSpine
        )
      ,
        archiveStage
      )
    )
  );
}

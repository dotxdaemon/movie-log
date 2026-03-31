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
      { className: 'battle-stage' },
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'signal-banner' },
        createElement('span', { className: 'signal-block signal-block-left' }),
        createElement('span', { className: 'signal-block signal-block-center' }),
        createElement('span', { className: 'signal-block signal-block-right' }),
        createElement('span', { className: 'signal-code' }, 'GT.2')
      ),
      createElement('div', { 'aria-hidden': 'true', className: 'ember-crown' }),
      createElement('div', { 'aria-hidden': 'true', className: 'frame-line' }),
      createElement('div', { 'aria-hidden': 'true', className: 'editorial-spine' }),
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'blade-field' },
        ...Array.from({ length: 8 }, (_, index) => createElement('span', { className: `blade-mark blade-mark-${index + 1}`, key: index }))
      ),
      createElement(
        'div',
        { className: 'stage-surface' },
        createElement('div', { className: 'figure-sheet' }, archiveStage),
        createElement('aside', { className: 'route-rig' }, statusSpine)
      )
    )
  );
}

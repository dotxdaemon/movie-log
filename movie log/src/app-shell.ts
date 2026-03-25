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
      { className: 'portrait-stage' },
      createElement('div', { 'aria-hidden': 'true', className: 'glitch-track' }),
      createElement('div', { 'aria-hidden': 'true', className: 'ceiling-lattice' }),
      createElement('div', { 'aria-hidden': 'true', className: 'frame-line' }),
      createElement('div', { 'aria-hidden': 'true', className: 'editorial-spine' }),
      createElement('div', { 'aria-hidden': 'true', className: 'echo-mass' }),
      createElement(
        'div',
        { className: 'stage-surface' },
        createElement('div', { className: 'focus-sheet' }, archiveStage),
        createElement('aside', { className: 'signal-cluster' }, statusSpine)
      )
    )
  );
}

// ABOUTME: Renders the shared Movie Log workspace frame as one control rail beside one work stage.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  archiveStage: ReactNode;
  statusSpine: ReactNode;
}

export function AppShell({ archiveStage, statusSpine }: AppShellProps) {
  return createElement(
    'main',
    { className: 'workspace-frame' },
    createElement('aside', { className: 'signal-column' }, createElement('div', { className: 'signal-column-inner' }, statusSpine)),
    createElement(
      'section',
      { className: 'workspace-stage' },
      createElement('div', { 'aria-hidden': 'true', className: 'signal-lattice' }),
      createElement('div', { 'aria-hidden': 'true', className: 'ceiling-grid' }),
      createElement('div', { 'aria-hidden': 'true', className: 'frame-shell' }),
      createElement('div', { 'aria-hidden': 'true', className: 'editorial-spine' }),
      createElement(
        'div',
        { className: 'workspace-stage-inner' },
        createElement('div', { 'aria-hidden': 'true', className: 'fracture-shadow' }),
        createElement('div', { className: 'focus-plane' }, archiveStage)
      )
    )
  );
}

// ABOUTME: Renders the shared Movie Log workspace frame as a control slab beside a poster stage.
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
    createElement('aside', { className: 'control-slab' }, createElement('div', { className: 'control-slab-inner' }, statusSpine)),
    createElement(
      'section',
      { className: 'poster-stage' },
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'poster-forms' },
        createElement('span', { className: 'poster-bar poster-bar-top' }),
        createElement('span', { className: 'poster-bar poster-bar-side' }),
        createElement('span', { className: 'poster-bar poster-bar-low' }),
        createElement('span', { className: 'poster-grid' }),
        createElement('span', { className: 'poster-axis-mark' })
      ),
      createElement('div', { className: 'poster-stage-inner' }, archiveStage)
    )
  );
}

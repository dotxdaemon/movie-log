// ABOUTME: Renders the shared Movie Log workspace frame as a status spine beside an archive stage.
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
    createElement('aside', { className: 'status-spine' }, createElement('div', { className: 'status-spine-inner' }, statusSpine)),
    createElement(
      'section',
      { className: 'archive-stage' },
      createElement(
        'div',
        { 'aria-hidden': 'true', className: 'archive-signal-field' },
        createElement('span', { className: 'signal-core' }),
        createElement('span', { className: 'signal-grid' }),
        createElement('span', { className: 'signal-block signal-block-top' }),
        createElement('span', { className: 'signal-block signal-block-side' }),
        createElement('span', { className: 'signal-block signal-block-low' })
      ),
      createElement('div', { className: 'archive-stage-inner' }, archiveStage)
    )
  );
}

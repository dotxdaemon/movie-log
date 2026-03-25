// ABOUTME: Renders the shared Movie Log workspace as one poster stage with overlaid controls and archive context.
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
      createElement('div', { 'aria-hidden': 'true', className: 'signal-noise' }),
      createElement('div', { 'aria-hidden': 'true', className: 'ceiling-grid' }),
      createElement('div', { 'aria-hidden': 'true', className: 'stage-frame' }),
      createElement('div', { 'aria-hidden': 'true', className: 'editorial-track' }),
      createElement('div', { 'aria-hidden': 'true', className: 'echo-figure' }),
      createElement(
        'div',
        { className: 'poster-stage-inner' },
        createElement('aside', { className: 'signal-dock' }, statusSpine),
        createElement('div', { className: 'focus-form' }, archiveStage)
      )
    )
  );
}

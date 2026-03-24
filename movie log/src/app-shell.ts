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
    createElement('aside', { className: 'control-rail' }, createElement('div', { className: 'control-rail-inner' }, statusSpine)),
    createElement(
      'section',
      { className: 'workspace-stage' },
      createElement('div', { 'aria-hidden': 'true', className: 'glitch-band' }),
      createElement('div', { 'aria-hidden': 'true', className: 'perspective-grid' }),
      createElement('div', { 'aria-hidden': 'true', className: 'trace-frame' }),
      createElement('div', { 'aria-hidden': 'true', className: 'index-spine' }),
      createElement('div', { className: 'workspace-stage-inner' }, archiveStage)
    )
  );
}

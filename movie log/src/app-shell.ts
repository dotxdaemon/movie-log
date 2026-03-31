// ABOUTME: Renders the shared Movie Log workspace as one minimal stage with a routes rail and workspace surface.
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
      { className: 'minimal-stage' },
      createElement(
        'div',
        { className: 'workspace-grid' },
        createElement(
          'aside',
          { className: 'routes-panel' },
          statusSpine
        ),
        createElement(
          'section',
          { className: 'workspace-main' },
          archiveStage
        )
      )
    )
  );
}

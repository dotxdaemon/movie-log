// ABOUTME: Renders the shared Movie Log workspace as one minimal stage with one dominant workspace surface.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  workspaceStage: ReactNode;
}

export function AppShell({ workspaceStage }: AppShellProps) {
  return createElement(
    'main',
    { className: 'workspace-shell' },
    createElement(
      'section',
      { className: 'minimal-stage' },
      createElement(
        'section',
        { className: 'workspace-main' },
        workspaceStage
      )
    )
  );
}

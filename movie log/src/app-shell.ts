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
    createElement('aside', { className: 'status-spine' }, statusSpine),
    createElement('section', { className: 'archive-stage' }, archiveStage)
  );
}

// ABOUTME: Renders the Movie Log dossier field with desktop and mobile navigation surfaces.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  mobileNavigation: ReactNode;
  navigationRail: ReactNode;
  workspaceStage: ReactNode;
}

export function AppShell({ mobileNavigation, navigationRail, workspaceStage }: AppShellProps) {
  return createElement(
    'main',
    { className: 'dossier-shell' },
    createElement('aside', { 'aria-label': 'Movie Log controls', className: 'archive-spine' }, navigationRail),
    createElement(
      'section',
      { className: 'dossier-stage' },
      createElement(
        'section',
        { className: 'dossier-main' },
        workspaceStage
      )
    ),
    createElement('nav', { 'aria-label': 'Movie Log controls', className: 'mobile-nav' }, mobileNavigation)
  );
}

// ABOUTME: Renders the shared Movie Log workspace frame around the command bar, history, and side rail.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  commandBar: ReactNode;
  historyLedger: ReactNode;
  intakeBar: ReactNode;
  note: string;
  sideRail: ReactNode;
  statusBanner?: ReactNode;
  title: string;
}

export function AppShell({
  commandBar,
  historyLedger,
  intakeBar,
  note,
  sideRail,
  statusBanner = null,
  title
}: AppShellProps) {
  return createElement(
    'main',
    { className: 'app-shell' },
    createElement(
      'header',
      { className: 'top-bar' },
      createElement(
        'div',
        { className: 'brand-block' },
        createElement('h1', { className: 'app-title' }, title),
        createElement('p', { className: 'brand-note' }, note)
      ),
      commandBar
    ),
    createElement(
      'section',
      { className: 'workspace-shell' },
      createElement('div', { className: 'main-column' }, statusBanner, intakeBar, historyLedger),
      sideRail
    )
  );
}

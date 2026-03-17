// ABOUTME: Renders the shared Movie Log workspace frame as a utility rail beside a records stage.
// ABOUTME: Keeps the shell structure testable without importing browser-only renderer code into Node checks.
import { createElement, type ReactNode } from 'react';

interface AppShellProps {
  contentHeader: ReactNode;
  intakeBar: ReactNode;
  note?: string;
  recordsPanel: ReactNode;
  statusBanner?: ReactNode;
  title: string;
  utilityPanel?: ReactNode;
}

export function AppShell({
  contentHeader,
  intakeBar,
  note = '',
  recordsPanel,
  statusBanner = null,
  title,
  utilityPanel = null
}: AppShellProps) {
  return createElement(
    'main',
    { className: 'workspace-frame' },
    createElement(
      'aside',
      { className: 'utility-rail' },
      createElement(
        'div',
        { className: 'rail-head' },
        createElement('h1', { className: 'app-title' }, title),
        note ? createElement('p', { className: 'rail-note' }, note) : null
      ),
      statusBanner,
      utilityPanel
    ),
    createElement(
      'section',
      { className: 'records-pane' },
      contentHeader,
      intakeBar,
      recordsPanel
    )
  );
}

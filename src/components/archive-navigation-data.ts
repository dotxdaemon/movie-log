// ABOUTME: Defines the archive navigation register and resolves shell titles and active parent views.
// ABOUTME: Supplies one stable view model to the desktop rail, mobile bar, and shared page header.
import type { ArchiveView } from '../archive-model.js';

export type NavigationView = Exclude<ArchiveView, 'detail'>;
export type NavIconName = 'library' | 'search' | 'statistics' | 'settings';

export const navigationItems: Array<{
  icon: NavIconName;
  index: string;
  label: string;
  mobileLabel: string;
  view: NavigationView;
}> = [
  { icon: 'library', index: '01', label: 'Library', mobileLabel: 'Library', view: 'library' },
  { icon: 'search', index: '02', label: 'Search', mobileLabel: 'Search', view: 'search' },
  { icon: 'statistics', index: '03', label: 'Statistics', mobileLabel: 'Stats', view: 'statistics' },
  { icon: 'settings', index: '04', label: 'Settings', mobileLabel: 'Settings', view: 'settings' }
];

export function readNavigationView(view: ArchiveView): NavigationView {
  return view === 'detail' ? 'library' : view;
}

export function readViewTitle(view: ArchiveView): string {
  if (view === 'detail') {
    return 'Dossier';
  }

  return navigationItems.find((item) => item.view === view)?.label ?? 'Movie Log';
}

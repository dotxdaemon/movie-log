// ABOUTME: Defines the archive navigation register and resolves shell titles and active parent views.
// ABOUTME: Supplies one stable view model to the desktop rail, mobile bar, and shared page header.
import type { ArchiveView } from '../archive-model.js';

export type NavigationView = Exclude<ArchiveView, 'detail'>;
export type NavIconName = 'diary' | 'library' | 'search' | 'statistics' | 'settings';

export const navigationItems: Array<{ icon: NavIconName; index: string; label: string; view: NavigationView }> = [
  { icon: 'diary', index: '01', label: 'Diary', view: 'diary' },
  { icon: 'library', index: '02', label: 'Library', view: 'library' },
  { icon: 'search', index: '03', label: 'Search', view: 'search' },
  { icon: 'statistics', index: '04', label: 'Statistics', view: 'statistics' },
  { icon: 'settings', index: '05', label: 'Settings', view: 'settings' }
];

export function readNavigationView(view: ArchiveView): NavigationView {
  return view === 'detail' ? 'library' : view;
}

export function readViewTitle(view: ArchiveView): string {
  if (view === 'detail') {
    return 'Film dossier';
  }

  return navigationItems.find((item) => item.view === view)?.label ?? 'Movie Log';
}

// ABOUTME: Resolves the top-level surface Search should return to when opened from any archive view.
// ABOUTME: Keeps dossier origin state intact instead of silently substituting Library.
import type { ArchiveView } from './archive-model.js';

export type SearchReturnView = Exclude<ArchiveView, 'detail' | 'search'>;

export function readSearchReturnView(
  activeView: ArchiveView,
  dossierOrigin: Exclude<ArchiveView, 'detail'>
): SearchReturnView {
  const candidate = activeView === 'detail' ? dossierOrigin : activeView;

  return candidate === 'search' ? 'diary' : candidate;
}

export function isSearchContext(activeView: ArchiveView, dossierOrigin: Exclude<ArchiveView, 'detail'>): boolean {
  return activeView === 'search' || (activeView === 'detail' && dossierOrigin === 'search');
}

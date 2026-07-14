// ABOUTME: Renders the shared archive page title, count line, search, filters, and logging action.
// ABOUTME: Keeps every view's heading controls in one consistent character-sheet header.
import { navigationItems, readNavigationView, readViewTitle } from './archive-navigation-data.js';
import type { ArchiveView } from '../archive-model.js';

interface PageHeaderProps {
  activeView: ArchiveView;
  archiveCount: number;
  diaryCount: number;
  onFilterSheetOpen(): void;
  onOpenLogPanel(): void;
  onSearchQueryChange(value: string): void;
  onViewChange(view: ArchiveView): void;
  periodLabel: string;
  searchQuery: string;
}

export function PageHeader({
  activeView,
  archiveCount,
  diaryCount,
  onFilterSheetOpen,
  onOpenLogPanel,
  onSearchQueryChange,
  onViewChange,
  periodLabel,
  searchQuery
}: PageHeaderProps) {
  const activeNavigationView = readNavigationView(activeView);
  const sectionIndex = navigationItems.find((item) => item.view === activeNavigationView)?.index ?? '02';

  return (
    <header className="archive-header">
      <div className="header-title-block">
        <p className="section-index">{sectionIndex} / {periodLabel}</p>
        <h1>{readViewTitle(activeView)}</h1>
        <p className="header-count-line">{diaryCount} diary entries · {archiveCount} titles</p>
        <span aria-hidden="true" className="header-rule" />
      </div>
      <div className="header-actions">
        {activeView === 'search' ? null : (
          <label className="header-search">
            <span className="visually-hidden">Search the archive</span>
            <svg aria-hidden="true" className="search-glyph" fill="none" height="14" viewBox="0 0 14 14" width="14">
              <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.4" />
              <path d="m9.4 9.4 3.1 3.1" stroke="currentColor" strokeLinecap="square" strokeWidth="1.4" />
            </svg>
            <input
              onChange={(event) => {
                onSearchQueryChange(event.target.value);
                onViewChange('search');
              }}
              placeholder="Search archive"
              type="search"
              value={searchQuery}
            />
          </label>
        )}
        {activeView === 'library' ? (
          <button className="header-filters" onClick={onFilterSheetOpen} type="button">
            Filters
          </button>
        ) : null}
        <button className="log-action header-log-action" onClick={onOpenLogPanel} type="button">
          <span aria-hidden="true" className="log-action-plus">+</span>
          Log a Film
        </button>
      </div>
    </header>
  );
}

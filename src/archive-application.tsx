// ABOUTME: Composes Movie Log's navigation rail, authored header, and all archive views into one shell.
// ABOUTME: Stays a pure component over lifted state so the complete product surface tests without a DOM.
import type { DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { ViewSkeleton, ErrorState } from './components/states.js';
import { DiaryView } from './views/diary.js';
import { DossierView } from './views/dossier.js';
import { LibraryView } from './views/library.js';
import { LogPanel } from './views/log-panel.js';
import { SearchView } from './views/search.js';
import { SettingsView } from './views/settings.js';
import { StatisticsView } from './views/statistics.js';
import {
  buildArchiveItems,
  type ArchiveFilters,
  type ArchiveItem,
  type ArchiveView,
  type DiaryMode,
  type SearchGroups,
  type SearchResultItem
} from './archive-model.js';
import type { WorkspaceFeedback } from './feedback.js';
import type { CatalogSearchResult, EntryDetails, LogEntryDetails, MovieLogState } from '../shared/types.js';

export interface ArchiveApplicationProps {
  activeView: ArchiveView;
  dataFilePath: string;
  diaryMode: DiaryMode;
  dossierMatchPending: boolean;
  dossierMatchResults: CatalogSearchResult[];
  dropActive: boolean;
  feedback: WorkspaceFeedback | null;
  filterSheetOpen: boolean;
  filters: ArchiveFilters;
  loadError: string | null;
  loading: boolean;
  logFilmError: string | null;
  logFilmPending: boolean;
  logFilmQuery: string;
  logFilmResults: CatalogSearchResult[];
  logPanelOpen: boolean;
  logReview: string;
  logSelectedFilm: CatalogSearchResult | null;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onChooseLogPaths(): Promise<void>;
  onClearLogPaths(): void;
  onCloseLogPanel(): void;
  onCopyPath(path: string): Promise<void>;
  onCreateLog(details: LogEntryDetails): Promise<void>;
  onDiaryModeChange(mode: DiaryMode): void;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(active: boolean): void;
  onFeedbackDismiss(): void;
  onFilterChange(filters: ArchiveFilters): void;
  onFilterSheetOpenChange(open: boolean): void;
  onLogFilmQueryChange(value: string): void;
  onLogReviewChange(value: string): void;
  onMatchFilm(item: ArchiveItem, pageId: number | null): void;
  onOpenInFinder(path: string): Promise<void>;
  onOpenItem(path: string): Promise<void>;
  onOpenLogPanel(): void;
  onOpenSearchResult(result: SearchResultItem): void;
  onRemoveWatchedFolder(id: string): Promise<void>;
  onRetryLoad(): void;
  onScanNow(): Promise<void>;
  onSearchDismiss(): void;
  onSearchActiveIndexChange(index: number): void;
  onSearchMatch(query: string): void;
  onSearchQueryChange(value: string): void;
  onSelectLibraryPath(path: string | null): void;
  onSelectLogFilm(film: CatalogSearchResult | null): void;
  onSelectPath(path: string): void;
  onUpdateEntry(entryId: string, details: EntryDetails): Promise<void>;
  onViewChange(view: ArchiveView): void;
  pendingLogPaths: string[];
  scanInProgress: boolean;
  searchActiveIndex: number;
  searchCatalogError: string | null;
  searchCatalogPending: boolean;
  searchGroups: SearchGroups;
  searchQuery: string;
  selectedLibraryPath: string | null;
  selectedPath: string | null;
  state: MovieLogState;
}

type NavIconName = 'diary' | 'library' | 'search' | 'statistics' | 'settings';

const navIconPaths: Record<NavIconName, string> = {
  diary: 'M3.5 2h8v12h-8zM3.5 5h8M6 8h3M6 10.5h3',
  library: 'M2.5 2.5h4.6v11H2.5zM8.9 2.5h4.6v11H8.9zM4.8 5h0M11.2 5h0',
  search: 'M6.6 2.6a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM9.6 9.6l3.6 3.6',
  settings: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11M5.5 3v3M10.5 6.5v3M7.5 10v3',
  statistics: 'M3 13.5V8M6.5 13.5V4.5M10 13.5V10M13.5 13.5V2.5'
};

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg aria-hidden="true" className="nav-icon" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path d={navIconPaths[name]} stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.2" />
    </svg>
  );
}

const navigationItems: Array<{ icon: NavIconName; index: string; label: string; view: Exclude<ArchiveView, 'detail'> }> = [
  { icon: 'diary', index: '01', label: 'Diary', view: 'diary' },
  { icon: 'library', index: '02', label: 'Library', view: 'library' },
  { icon: 'search', index: '03', label: 'Search', view: 'search' },
  { icon: 'statistics', index: '04', label: 'Statistics', view: 'statistics' },
  { icon: 'settings', index: '05', label: 'Settings', view: 'settings' }
];

const periodFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

function readViewTitle(view: ArchiveView): string {
  if (view === 'detail') {
    return 'Film dossier';
  }

  return navigationItems.find((item) => item.view === view)?.label ?? 'Movie Log';
}

export function ArchiveApplication(props: ArchiveApplicationProps) {
  const activeNavigationView = props.activeView === 'detail' ? 'library' : props.activeView;
  const archiveItems = buildArchiveItems(props.state);
  const latestEntry = props.state.history[0];
  const periodLabel = latestEntry ? periodFormatter.format(new Date(latestEntry.watchedAt)).toUpperCase() : 'EMPTY';

  const navigation = (
    <>
      <div className="brand-mark">
        <span>ML</span>
        <small>Archive</small>
      </div>
      <nav aria-label="Primary" className="primary-navigation">
        {navigationItems.map((item) => (
          <button
            aria-current={activeNavigationView === item.view ? 'page' : undefined}
            className="nav-item"
            key={item.view}
            onClick={() => props.onViewChange(item.view)}
            type="button"
          >
            <NavIcon name={item.icon} />
            <span className="nav-item-label">{item.label}</span>
            <span className="nav-item-index">{item.index}</span>
          </button>
        ))}
      </nav>
      <button className="log-action" onClick={props.onOpenLogPanel} type="button">
        <span aria-hidden="true" className="log-action-plus">+</span>
        Log a Film
      </button>
      <p className="rail-caption">A private register of watched things.</p>
    </>
  );

  const mobileNavigation = (
    <>
      {navigationItems.slice(0, 2).map((item) => (
        <button
          aria-current={activeNavigationView === item.view ? 'page' : undefined}
          className="mobile-nav-item"
          key={item.view}
          onClick={() => props.onViewChange(item.view)}
          type="button"
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
      <button aria-label="Log a Film" className="log-action mobile-log-action" onClick={props.onOpenLogPanel} type="button">
        <span aria-hidden="true">+</span>
        <span className="mobile-log-label">Log</span>
      </button>
      {navigationItems.slice(2).map((item) => (
        <button
          aria-current={activeNavigationView === item.view ? 'page' : undefined}
          className="mobile-nav-item"
          key={item.view}
          onClick={() => props.onViewChange(item.view)}
          type="button"
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </>
  );

  let view = (
    <DiaryView
      diaryMode={props.diaryMode}
      onDiaryModeChange={props.onDiaryModeChange}
      onOpenLogPanel={props.onOpenLogPanel}
      onSelectPath={props.onSelectPath}
      onUpdateEntry={props.onUpdateEntry}
      state={props.state}
    />
  );

  if (props.loadError) {
    view = <ErrorState message={props.loadError} onRetry={props.onRetryLoad} />;
  } else if (props.loading) {
    view = <ViewSkeleton view={props.activeView === 'detail' ? 'detail' : props.activeView} />;
  } else if (props.activeView === 'library') {
    view = (
      <LibraryView
        filterSheetOpen={props.filterSheetOpen}
        filters={props.filters}
        onFilterChange={props.onFilterChange}
        onFilterSheetOpenChange={props.onFilterSheetOpenChange}
        onOpenPath={props.onSelectPath}
        onSelectLibraryPath={props.onSelectLibraryPath}
        selectedLibraryPath={props.selectedLibraryPath}
        state={props.state}
      />
    );
  } else if (props.activeView === 'search') {
    view = (
      <SearchView
        activeIndex={props.searchActiveIndex}
        catalogError={props.searchCatalogError}
        catalogPending={props.searchCatalogPending}
        groups={props.searchGroups}
        onActiveIndexChange={props.onSearchActiveIndexChange}
        onDismiss={props.onSearchDismiss}
        onOpenResult={props.onOpenSearchResult}
        onSearchQueryChange={props.onSearchQueryChange}
        searchQuery={props.searchQuery}
      />
    );
  } else if (props.activeView === 'statistics') {
    view = <StatisticsView state={props.state} />;
  } else if (props.activeView === 'settings') {
    view = (
      <SettingsView
        dataFilePath={props.dataFilePath}
        noteFilePath={props.noteFilePath}
        onAddWatchedFolders={props.onAddWatchedFolders}
        onOpenItem={props.onOpenItem}
        onRemoveWatchedFolder={props.onRemoveWatchedFolder}
        onScanNow={props.onScanNow}
        scanInProgress={props.scanInProgress}
        state={props.state}
      />
    );
  } else if (props.activeView === 'detail') {
    view = (
      <DossierView
        matchPending={props.dossierMatchPending}
        matchResults={props.dossierMatchResults}
        onCopyPath={props.onCopyPath}
        onMatchFilm={props.onMatchFilm}
        onOpenInFinder={props.onOpenInFinder}
        onOpenItem={props.onOpenItem}
        onSearchMatch={props.onSearchMatch}
        onUpdateEntry={props.onUpdateEntry}
        selectedPath={props.selectedPath}
        state={props.state}
      />
    );
  }

  const stage = (
    <div
      className={props.dropActive ? 'archive-canvas archive-canvas-drop' : 'archive-canvas'}
      onDragEnter={() => props.onDropActiveChange(true)}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        props.onDropActiveChange(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        props.onDropActiveChange(true);
      }}
      onDrop={props.onDrop}
    >
      <header className="archive-header">
        <div className="header-title-block">
          <p className="section-index">
            {navigationItems.find((item) => item.view === activeNavigationView)?.index ?? '02'} / {periodLabel}
          </p>
          <h1>{readViewTitle(props.activeView)}</h1>
          <p className="header-count-line">
            {props.state.history.length} diary entries · {archiveItems.length} titles
          </p>
          <span aria-hidden="true" className="header-rule" />
        </div>
        <div className="header-actions">
          {props.activeView === 'search' ? null : (
            <label className="header-search">
              <span className="visually-hidden">Search the archive</span>
              <svg aria-hidden="true" className="search-glyph" fill="none" height="14" viewBox="0 0 14 14" width="14">
                <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.4" />
                <path d="m9.4 9.4 3.1 3.1" stroke="currentColor" strokeLinecap="square" strokeWidth="1.4" />
              </svg>
              <input
                onChange={(event) => {
                  props.onSearchQueryChange(event.target.value);

                  if (props.activeView !== 'search') {
                    props.onViewChange('search');
                  }
                }}
                placeholder="Search archive"
                type="search"
                value={props.searchQuery}
              />
            </label>
          )}
          {props.activeView === 'library' ? (
            <button className="header-filters" onClick={() => props.onFilterSheetOpenChange(true)} type="button">
              Filters
            </button>
          ) : null}
          <button className="log-action header-log-action" onClick={props.onOpenLogPanel} type="button">
            <span aria-hidden="true" className="log-action-plus">+</span>
            Log a Film
          </button>
        </div>
      </header>
      {props.feedback ? (
        <div
          className={`status-banner status-${props.feedback.tone}`}
          role={props.feedback.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{props.feedback.message}</span>
          <button onClick={props.onFeedbackDismiss} type="button">Dismiss</button>
        </div>
      ) : null}
      <div className="archive-content">{view}</div>
      {props.dropActive ? (
        <div className="drop-overlay">
          <span>Drop to add to the log</span>
        </div>
      ) : null}
      {props.logPanelOpen ? (
        <LogPanel
          filmPending={props.logFilmPending}
          filmError={props.logFilmError}
          filmQuery={props.logFilmQuery}
          filmResults={props.logFilmResults}
          onChooseLogPaths={props.onChooseLogPaths}
          onClearLogPaths={props.onClearLogPaths}
          onClose={props.onCloseLogPanel}
          onCreateLog={props.onCreateLog}
          onFilmQueryChange={props.onLogFilmQueryChange}
          onReviewChange={props.onLogReviewChange}
          onSelectFilm={props.onSelectLogFilm}
          pendingLogPaths={props.pendingLogPaths}
          review={props.logReview}
          selectedFilm={props.logSelectedFilm}
        />
      ) : null}
    </div>
  );

  return <AppShell mobileNavigation={mobileNavigation} navigationRail={navigation} workspaceStage={stage} />;
}

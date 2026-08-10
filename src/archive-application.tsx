// ABOUTME: Composes Movie Log's navigation rail, authored header, and all archive views into one shell.
// ABOUTME: Stays a pure component over lifted state so the complete product surface tests without a DOM.
import type { DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { ArchiveNavigation, MobileArchiveNavigation } from './components/archive-navigation.js';
import { ConfirmationDialog } from './components/confirmation-dialog.js';
import { readNavigationView } from './components/archive-navigation-data.js';
import { FilterPanel, FilterSheet } from './components/filters.js';
import { PageHeader } from './components/page-header.js';
import { ViewSkeleton, ErrorState } from './components/states.js';
import { buildFilterOptions } from './filter-options.js';
import { DiaryView } from './views/diary.js';
import { DossierView } from './views/dossier.js';
import { LibraryView } from './views/library.js';
import { LogPanel } from './views/log-panel.js';
import { SearchView } from './views/search.js';
import { SettingsView } from './views/settings.js';
import { StatisticsView } from './views/statistics.js';
import {
  buildArchiveItems,
  filterArchiveItems,
  readArchiveCoverage,
  type ArchiveFilters,
  type ArchiveItem,
  type ArchiveView,
  type DiaryMode,
  type SearchGroups,
  type SearchResultItem
} from './archive-model.js';
import type { WorkspaceFeedback } from './feedback.js';
import type { CatalogSearchResult, LogEntryDetails, MovieLogState, WatchEntry } from '../shared/types.js';

export interface ArchiveApplicationProps {
  activeView: ArchiveView;
  dataFilePath: string;
  diaryMode?: DiaryMode;
  dossierMatchPending: boolean;
  dossierMatchError: string | null;
  dossierMatchResults: CatalogSearchResult[];
  dossierOriginLabel: string;
  dossierOriginView: Exclude<ArchiveView, 'detail'>;
  deleteConfirmation: WatchEntry | null;
  deleteInProgress: boolean;
  dropActive: boolean;
  expandedDiaryEntryIds?: ReadonlySet<string>;
  feedback: WorkspaceFeedback | null;
  filterSheetOpen: boolean;
  filterDraft: ArchiveFilters;
  filters: ArchiveFilters;
  loadError: string | null;
  loading: boolean;
  logFilmActiveIndex: number;
  logFilmError: string | null;
  logFilmPending: boolean;
  logFilmQuery: string;
  logFilmResults: CatalogSearchResult[];
  logPanelOpen: boolean;
  logReview: string;
  logSaving: boolean;
  logSelectedFilm: CatalogSearchResult | null;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onChooseLogPaths(): Promise<void>;
  onClearLogPaths(): void;
  onCloseLogPanel(): void;
  onCopyPath(path: string): Promise<void>;
  onCreateLog(details: LogEntryDetails): Promise<void>;
  onCancelDeleteEntry(): void;
  onConfirmDeleteEntry(): Promise<void>;
  onDiaryModeChange?(mode: DiaryMode): void;
  onDiaryEntryExpandedChange?(entryId: string, expanded: boolean): void;
  onDossierBack(): void;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(active: boolean): void;
  onFeedbackDismiss(): void;
  onFilterChange(filters: ArchiveFilters): void;
  onApplyFilterDraft(filters: ArchiveFilters): void;
  onFilterDraftChange(filters: ArchiveFilters): void;
  onFilterSheetOpenChange(open: boolean): void;
  onLogFilmActiveIndexChange(index: number): void;
  onLogFilmQueryChange(value: string): void;
  onLogItem(item: ArchiveItem): void;
  onLogReviewChange(value: string): void;
  onMatchFilm(item: ArchiveItem, selection: CatalogSearchResult | null): void;
  onOpenInFinder(path: string): Promise<void>;
  onOpenItem(path: string): Promise<void>;
  onOpenLogPanel(): void;
  onOpenSearchResult(result: SearchResultItem): void;
  onRemoveWatchedFolder(id: string): Promise<void>;
  onRequestDeleteEntry(entry: WatchEntry): void;
  onRetryLoad(): void;
  onRetryMetadata(): Promise<void>;
  onScanNow(): Promise<void>;
  onSearchDismiss(): void;
  onSearchActiveIndexChange(index: number): void;
  onSearchMatch(query: string): void;
  onSearchQueryChange(value: string): void;
  onSelectLibraryPath(path: string | null): void;
  onSelectLogFilm(film: CatalogSearchResult | null): void;
  onSelectPath(path: string): void;
  onUpdateEntry(entryId: string, details: LogEntryDetails): Promise<void>;
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

const periodFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const confirmationDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function ArchiveApplication(props: ArchiveApplicationProps) {
  const archiveItems = buildArchiveItems(props.state);
  const coverage = readArchiveCoverage(props.state);
  const filterOptions = buildFilterOptions(archiveItems);
  const latestEntry = props.state.history[0];
  const modalOpen = props.filterSheetOpen || props.logPanelOpen || props.deleteConfirmation !== null;
  const navigationView = readNavigationView(props.activeView === 'detail' ? props.dossierOriginView : props.activeView);
  const periodLabel = latestEntry ? periodFormatter.format(new Date(latestEntry.watchedAt)).toUpperCase() : 'EMPTY';

  const navigation = (
    <ArchiveNavigation
      activeView={navigationView}
      onOpenLogPanel={props.onOpenLogPanel}
      onViewChange={props.onViewChange}
    />
  );
  const mobileNavigation = (
    <MobileArchiveNavigation
      activeView={navigationView}
      onOpenLogPanel={props.onOpenLogPanel}
      onViewChange={props.onViewChange}
    />
  );

  let view = (
    <DiaryView
      diaryMode={props.diaryMode ?? 'timeline'}
      expandedEntryIds={props.expandedDiaryEntryIds ?? new Set()}
      onDiaryEntryExpandedChange={props.onDiaryEntryExpandedChange}
      onDiaryModeChange={props.onDiaryModeChange ?? (() => {})}
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
        filters={props.filters}
        onFilterChange={props.onFilterChange}
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
        matchError={props.dossierMatchError}
        matchResults={props.dossierMatchResults}
        originLabel={props.dossierOriginLabel}
        onCopyPath={props.onCopyPath}
        onBack={props.onDossierBack}
        onLogItem={props.onLogItem}
        onMatchFilm={props.onMatchFilm}
        onOpenInFinder={props.onOpenInFinder}
        onOpenItem={props.onOpenItem}
        onRequestDeleteEntry={props.onRequestDeleteEntry}
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
      onDragEnter={modalOpen ? undefined : () => props.onDropActiveChange(true)}
      onDragLeave={
        modalOpen
          ? undefined
          : (event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }

              props.onDropActiveChange(false);
            }
      }
      onDragOver={
        modalOpen
          ? undefined
          : (event) => {
              event.preventDefault();
              props.onDropActiveChange(true);
            }
      }
      onDrop={modalOpen ? undefined : props.onDrop}
    >
      <div
        aria-hidden={modalOpen ? 'true' : undefined}
        className="archive-background"
        inert={modalOpen ? true : undefined}
      >
        <PageHeader
          activeView={props.activeView}
          archiveCount={archiveItems.length}
          coverage={coverage}
          diaryCount={props.state.history.length}
          loading={props.loading}
          libraryTools={
            props.activeView === 'library' && !props.loadError && (props.loading || archiveItems.length > 0) ? (
              props.loading ? (
                <div aria-hidden="true" className="filter-panel-loading" inert>
                  <FilterPanel
                    filters={props.filters}
                    onFilterChange={props.onFilterChange}
                    onSheetOpenChange={props.onFilterSheetOpenChange}
                    options={filterOptions}
                    sheetOpen={false}
                  />
                </div>
              ) : (
                <FilterPanel
                  filters={props.filters}
                  onFilterChange={props.onFilterChange}
                  onSheetOpenChange={props.onFilterSheetOpenChange}
                  options={filterOptions}
                  sheetOpen={props.filterSheetOpen}
                />
              )
            ) : undefined
          }
          onOpenLogPanel={props.onOpenLogPanel}
          onRetryMetadata={props.onRetryMetadata}
          onSearchQueryChange={props.onSearchQueryChange}
          onViewChange={props.onViewChange}
          navigationView={navigationView}
          periodLabel={periodLabel}
          searchQuery={props.searchQuery}
        />
        {props.feedback ? (
          <div
            className={`status-banner status-${props.feedback.tone}`}
            role={props.feedback.tone === 'error' ? 'alert' : 'status'}
          >
            <span>{props.feedback.message}</span>
            <button onClick={props.onFeedbackDismiss} type="button">
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="archive-content">{view}</div>
        {props.dropActive ? (
          <div className="drop-overlay">
            <span>Drop to add to the log</span>
          </div>
        ) : null}
      </div>
      {props.filterSheetOpen &&
      props.activeView === 'library' &&
      !props.loading &&
      !props.loadError &&
      archiveItems.length > 0 ? (
        <FilterSheet
          filters={props.filterDraft}
          onApply={(filters) => {
            props.onApplyFilterDraft(filters);
            props.onFilterSheetOpenChange(false);
          }}
          onClose={() => props.onFilterSheetOpenChange(false)}
          onFilterChange={props.onFilterDraftChange}
          options={filterOptions}
          resultCount={filterArchiveItems(archiveItems, props.filterDraft).length}
        />
      ) : null}
      {props.logPanelOpen ? (
        <LogPanel
          filmActiveIndex={props.logFilmActiveIndex}
          filmPending={props.logFilmPending}
          filmError={props.logFilmError}
          filmQuery={props.logFilmQuery}
          filmResults={props.logFilmResults}
          onChooseLogPaths={props.onChooseLogPaths}
          onClearLogPaths={props.onClearLogPaths}
          onClose={props.onCloseLogPanel}
          onCreateLog={props.onCreateLog}
          onFilmActiveIndexChange={props.onLogFilmActiveIndexChange}
          onFilmQueryChange={props.onLogFilmQueryChange}
          onReviewChange={props.onLogReviewChange}
          onSelectFilm={props.onSelectLogFilm}
          pendingLogPaths={props.pendingLogPaths}
          review={props.logReview}
          saving={props.logSaving}
          selectedFilm={props.logSelectedFilm}
        />
      ) : null}
      {props.deleteConfirmation ? (
        <ConfirmationDialog
          busy={props.deleteInProgress}
          confirmLabel="Delete viewing"
          description={`Delete ${
            archiveItems.find((item) => item.viewings.some((entry) => entry.id === props.deleteConfirmation?.id))
              ?.displayTitle ?? props.deleteConfirmation.title
          } from ${confirmationDateFormatter.format(new Date(props.deleteConfirmation.watchedAt))}? This removes only this viewing and its personal notes. Indexed media stays in Library.`}
          onCancel={props.onCancelDeleteEntry}
          onConfirm={() => void props.onConfirmDeleteEntry()}
          title="Delete this viewing?"
        />
      ) : null}
    </div>
  );

  return (
    <AppShell
      mobileNavigation={mobileNavigation}
      modalOpen={modalOpen}
      navigationRail={navigation}
      workspaceStage={stage}
    />
  );
}

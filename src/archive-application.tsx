// ABOUTME: Composes Movie Log's navigation rail, authored header, and all archive views into one shell.
// ABOUTME: Stays a pure component over lifted state so the complete product surface tests without a DOM.
import type { DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { ArchiveNavigation, MobileArchiveNavigation } from './components/archive-navigation.js';
import { PageHeader } from './components/page-header.js';
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
  readArchiveCoverage,
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
  dossierMatchError: string | null;
  dossierMatchResults: CatalogSearchResult[];
  dossierOriginLabel: string;
  dropActive: boolean;
  feedback: WorkspaceFeedback | null;
  filterSheetOpen: boolean;
  filterDraft: ArchiveFilters;
  filters: ArchiveFilters;
  loadError: string | null;
  loading: boolean;
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
  onDiaryModeChange(mode: DiaryMode): void;
  onDossierBack(): void;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(active: boolean): void;
  onFeedbackDismiss(): void;
  onFilterChange(filters: ArchiveFilters): void;
  onApplyFilterDraft(filters: ArchiveFilters): void;
  onFilterDraftChange(filters: ArchiveFilters): void;
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
  onRetryMetadata(): Promise<void>;
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

const periodFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

export function ArchiveApplication(props: ArchiveApplicationProps) {
  const archiveItems = buildArchiveItems(props.state);
  const coverage = readArchiveCoverage(props.state);
  const latestEntry = props.state.history[0];
  const periodLabel = latestEntry ? periodFormatter.format(new Date(latestEntry.watchedAt)).toUpperCase() : 'EMPTY';

  const navigation = (
    <ArchiveNavigation
      activeView={props.activeView}
      onOpenLogPanel={props.onOpenLogPanel}
      onViewChange={props.onViewChange}
    />
  );
  const mobileNavigation = (
    <MobileArchiveNavigation
      activeView={props.activeView}
      onOpenLogPanel={props.onOpenLogPanel}
      onViewChange={props.onViewChange}
    />
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
        filterDraft={props.filterDraft}
        filters={props.filters}
        onApplyFilterDraft={props.onApplyFilterDraft}
        onFilterDraftChange={props.onFilterDraftChange}
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
        matchError={props.dossierMatchError}
        matchResults={props.dossierMatchResults}
        originLabel={props.dossierOriginLabel}
        onCopyPath={props.onCopyPath}
        onBack={props.onDossierBack}
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
      <PageHeader
        activeView={props.activeView}
        archiveCount={archiveItems.length}
        coverage={coverage}
        diaryCount={props.state.history.length}
        onOpenLogPanel={props.onOpenLogPanel}
        onRetryMetadata={props.onRetryMetadata}
        onSearchQueryChange={props.onSearchQueryChange}
        onViewChange={props.onViewChange}
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
          saving={props.logSaving}
          selectedFilm={props.logSelectedFilm}
        />
      ) : null}
    </div>
  );

  return <AppShell mobileNavigation={mobileNavigation} navigationRail={navigation} workspaceStage={stage} />;
}

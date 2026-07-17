// ABOUTME: Owns Movie Log's renderer state, IPC calls, dialogs, and catalog searches for the archive.
// ABOUTME: Feeds the pure ArchiveApplication surface and keeps every user action tied to real behavior.
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArchiveApplication } from './archive-application.js';
import {
  buildSearchResults,
  defaultArchiveFilters,
  type ArchiveItem,
  type ArchiveView,
  type DiaryMode,
  type SearchResultItem
} from './archive-model.js';
import { guardDragNavigation } from './drag-guard.js';
import {
  createDropFeedbackMessage,
  createScanFeedbackMessage,
  formatCount,
  type WorkspaceFeedback
} from './feedback.js';
import { readCatalogFailureMessage } from './catalog-search.js';
import { focusDossierReturnTarget, focusSearchReturnTarget } from './search-focus.js';
import { readActionFailureMessage, type ActionFailureContext } from './action-error.js';
import { updateArchiveState, useArchiveData } from './use-archive-data.js';
import { useCatalogSearch } from './use-catalog-search.js';
import { useDialogSurface } from './use-dialog-surface.js';
import { parseFilmTitle } from '../shared/film-title.js';
import { readVisibleHistory } from '../shared/history.js';
import type { CatalogSearchResult, LogEntryDetails, EntryDetails } from '../shared/types.js';

export default function App() {
  const [activeView, setActiveView] = useState<ArchiveView>('diary');
  const [diaryMode, setDiaryMode] = useState<DiaryMode>('timeline');
  const { dataFilePath, loadError, loading, noteFilePath, retryLoad, setState, state } = useArchiveData();
  const [dropActive, setDropActive] = useState(false);
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(null);
  const [filters, setFilters] = useState(defaultArchiveFilters);
  const [filterDraft, setFilterDraft] = useState(defaultArchiveFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [logFilmQuery, setLogFilmQuery] = useState('');
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [logReview, setLogReview] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logSelectedFilm, setLogSelectedFilm] = useState<CatalogSearchResult | null>(null);
  const [dossierMatchPending, setDossierMatchPending] = useState(false);
  const [dossierMatchError, setDossierMatchError] = useState<string | null>(null);
  const [dossierMatchResults, setDossierMatchResults] = useState<CatalogSearchResult[]>([]);
  const [pendingLogPaths, setPendingLogPaths] = useState<string[]>([]);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const dossierReturnFocus = useRef<HTMLElement | null>(null);
  const dossierReturnView = useRef<Exclude<ArchiveView, 'detail'>>('library');
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const searchReturnView = useRef<Exclude<ArchiveView, 'detail' | 'search'>>('diary');
  const rememberDialogOpener = useDialogSurface({
    filterSheetOpen,
    logPanelOpen,
    setFilterSheetOpen,
    setLogPanelOpen
  });

  const searchCatalog = useCatalogSearch(searchQuery, activeView === 'search');
  const logFilmSearch = useCatalogSearch(logFilmQuery, logPanelOpen && logSelectedFilm === null);
  const searchGroups = useMemo(
    () => buildSearchResults(state, searchQuery, searchCatalog.results),
    [searchCatalog.results, searchQuery, state]
  );

  useEffect(() => guardDragNavigation(window), []);

  const runAction = async (action: () => Promise<void>, context: ActionFailureContext) => {
    setFeedback(null);

    try {
      await action();
    } catch (error) {
      console.error(`Movie Log ${context} action failed.`, error);
      setFeedback({ message: readActionFailureMessage(error, context), tone: 'error' });
    }
  };

  const handleLogPanelOpenChange = (open: boolean) => {
    if (open) {
      rememberDialogOpener();
    }

    setLogPanelOpen(open);
  };

  const handleFilterSheetOpenChange = (open: boolean) => {
    if (open) {
      setFilterDraft(filters);
      rememberDialogOpener();
    }

    setFilterSheetOpen(open);
  };

  const handleAddWatchedFolders = () =>
    runAction(async () => {
      await window.movieLog.addWatchedFolders();
    }, 'add-folder');

  const handleCopyPathFor = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.copyPath(itemPath);
      setFeedback({ message: 'Path copied.', tone: 'notice' });
    }, 'copy-path');

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    setFeedback(null);

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.movieLog.pathForFile(file))
      .filter((itemPath) => itemPath.length > 0);

    if (paths.length === 0) {
      setFeedback({
        message: 'Drop a Finder file or folder so Movie Log can read its full path.',
        tone: 'error'
      });
      return;
    }

    setPendingLogPaths(paths);
    handleLogPanelOpenChange(true);
  };

  const handleChooseLogPaths = () =>
    runAction(async () => {
      const paths = await window.movieLog.chooseLogPaths();

      if (paths.length > 0) {
        setPendingLogPaths(paths);
      }
    }, 'log');

  const resetLogDraft = () => {
    setPendingLogPaths([]);
    setLogSelectedFilm(null);
    setLogFilmQuery('');
    setLogReview('');
  };

  const handleCreateLog = async (details: LogEntryDetails) => {
    if (logSaving) {
      return;
    }

    setFeedback(null);

    if (pendingLogPaths.length === 0 && !logSelectedFilm) {
      setFeedback({
        message: 'Search for a film or choose at least one media file.',
        tone: 'error'
      });
      return;
    }

    if (logSelectedFilm && pendingLogPaths.length > 1) {
      setFeedback({
        message:
          'Attach one media item for this catalog film, or clear the selected film before logging multiple items.',
        tone: 'error'
      });
      return;
    }

    setLogSaving(true);

    try {
      let outcome;

      if (pendingLogPaths.length > 0) {
        outcome = await window.movieLog.logPaths(
          pendingLogPaths,
          details,
          logSelectedFilm
            ? {
                catalogId: logSelectedFilm.catalogId,
                catalogSource: logSelectedFilm.catalogSource,
                director: logSelectedFilm.director,
                pageId: logSelectedFilm.pageId,
                posterUrl: logSelectedFilm.posterUrl,
                title: logSelectedFilm.title,
                year: logSelectedFilm.year
              }
            : undefined
        );
      } else if (logSelectedFilm) {
        outcome = await window.movieLog.logFilm(
          {
            catalogId: logSelectedFilm.catalogId,
            catalogSource: logSelectedFilm.catalogSource,
            director: logSelectedFilm.director,
            pageId: logSelectedFilm.pageId,
            posterUrl: logSelectedFilm.posterUrl,
            title: logSelectedFilm.title,
            year: logSelectedFilm.year
          },
          details
        );
      }

      if (!outcome || outcome.entryStatus === 'failed') {
        setFeedback({
          message: outcome?.skippedPaths.length
            ? 'None of the selected media could be logged. Choose a supported movie file or folder.'
            : readActionFailureMessage(new Error('persistence failed'), 'persistence'),
          tone: 'error'
        });
        return;
      }

      const metadataMessage =
        outcome.metadataStatus === 'pending' ? ' Film details will finish matching in the background.' : '';

      if (outcome.skippedPaths.length > 0) {
        setFeedback({
          message: `${createDropFeedbackMessage(outcome)}${metadataMessage}`,
          tone: 'error'
        });
      } else {
        const loggedLabel =
          outcome.addedCount === 1 && logSelectedFilm ? logSelectedFilm.title : formatCount(outcome.addedCount, 'item');
        setFeedback({
          message: `Logged ${loggedLabel}.${metadataMessage}`,
          tone: 'notice'
        });
      }

      updateArchiveState(await window.movieLog.getState(), setState);
      resetLogDraft();
      setLogPanelOpen(false);
      setActiveView('diary');
    } catch (error) {
      console.error('Movie Log logging action failed.', error);
      setFeedback({ message: readActionFailureMessage(error, 'log'), tone: 'error' });
    } finally {
      setLogSaving(false);
    }
  };

  const handleUpdateEntry = async (entryId: string, details: EntryDetails) => {
    setFeedback(null);

    try {
      const updatedEntry = await window.movieLog.updateEntry(entryId, details);

      if (!updatedEntry) {
        setFeedback({
          message: 'That diary entry is no longer available.',
          tone: 'error'
        });
        return;
      }

      updateArchiveState(await window.movieLog.getState(), setState);
      setFeedback({ message: 'Diary entry saved.', tone: 'notice' });
    } catch (error) {
      console.error('Movie Log update action failed.', error);
      setFeedback({ message: readActionFailureMessage(error, 'update-entry'), tone: 'error' });
    }
  };

  const handleOpenInFinder = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.openInFinder(itemPath);
    }, 'show-in-finder');

  const handleOpenItem = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.openItem(itemPath);
    }, 'open-item');

  const handleRemoveWatchedFolder = (folderId: string) =>
    runAction(async () => {
      await window.movieLog.removeWatchedFolder(folderId);
    }, 'remove-folder');

  const handleScanNow = async () => {
    setFeedback(null);
    setScanInProgress(true);
    const previousHistoryCount = readVisibleHistory(state.history).length;

    try {
      await window.movieLog.scanNow();
      const nextState = await window.movieLog.getState();
      const nextHistoryCount = readVisibleHistory(nextState.history).length;
      updateArchiveState(nextState, setState);
      setFeedback({
        message: createScanFeedbackMessage(Math.max(0, nextHistoryCount - previousHistoryCount)),
        tone: 'notice'
      });
    } catch (error) {
      console.error('Movie Log scan action failed.', error);
      setFeedback({ message: readActionFailureMessage(error, 'scan'), tone: 'error' });
    } finally {
      setScanInProgress(false);
    }
  };

  const handleSelectPath = (path: string) => {
    if (activeView !== 'detail') {
      dossierReturnView.current = activeView;
      dossierReturnFocus.current = document.activeElement as HTMLElement | null;
    }
    setSelectedPath(path);
    setSelectedLibraryPath(null);
    setDossierMatchResults([]);
    setActiveView('detail');
  };

  const handleDossierBack = () => {
    const returnTarget = dossierReturnFocus.current;
    const returnPath = selectedPath;
    setActiveView(dossierReturnView.current);
    setSelectedPath(null);
    window.setTimeout(() => focusDossierReturnTarget(returnTarget, returnPath), 0);
  };

  const handleOpenSearchResult = (result: SearchResultItem) => {
    if (result.kind === 'catalog') {
      setLogSelectedFilm({
        catalogId: result.catalogId,
        catalogSource: result.catalogSource,
        description: result.status,
        pageId: result.pageId ?? 0,
        posterUrl: result.posterUrl,
        title: result.title,
        year: result.year
      });
      handleLogPanelOpenChange(true);
      return;
    }

    if (result.sourcePath) {
      handleSelectPath(result.sourcePath);
    }
  };

  const handleSearchMatch = (query: string) => {
    setDossierMatchPending(true);
    setDossierMatchError(null);
    setDossierMatchResults([]);
    window.movieLog
      .searchCatalog(`${query} film`)
      .then((results) => setDossierMatchResults(results))
      .catch((error: unknown) => setDossierMatchError(readCatalogFailureMessage(error)))
      .finally(() => setDossierMatchPending(false));
  };

  const handleMatchFilm = (item: ArchiveItem, pageId: number | null) => {
    const selectedMatch = dossierMatchResults.find((result) => result.pageId === pageId);
    const parsed = selectedMatch
      ? { title: selectedMatch.title, year: selectedMatch.year }
      : parseFilmTitle(item.title);
    setDossierMatchResults([]);
    setDossierMatchError(null);
    void (async () => {
      try {
        await Promise.all(
          item.filmRecordKeys.map((filmRecordKey) =>
            window.movieLog.matchFilm(filmRecordKey, { title: parsed.title, year: parsed.year }, pageId)
          )
        );
        updateArchiveState(await window.movieLog.getState(), setState);
        setFeedback({
          message: pageId === null ? 'Catalog match cleared.' : 'Catalog match updated.',
          tone: 'notice'
        });
      } catch (error) {
        console.error('Movie Log catalog match action failed.', error);
        setDossierMatchError(readActionFailureMessage(error, 'metadata'));
      }
    })();
  };

  const handleRetryMetadata = () =>
    runAction(async () => {
      await window.movieLog.retryFilmEnrichment();
      setFeedback({ message: 'Metadata matching resumed.', tone: 'notice' });
    }, 'metadata');

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    setSearchActiveIndex(0);
  };

  const handleSearchDismiss = () => {
    const returnTarget = searchReturnFocus.current;
    setSearchQuery('');
    setSearchActiveIndex(0);
    setActiveView(searchReturnView.current);
    searchReturnFocus.current = null;
    window.setTimeout(() => focusSearchReturnTarget(returnTarget), 0);
  };

  const handleViewChange = (view: ArchiveView) => {
    if (view === 'search' && activeView !== 'search') {
      searchReturnView.current = activeView === 'detail' ? 'library' : activeView;
      searchReturnFocus.current = document.activeElement as HTMLElement | null;
    }

    setActiveView(view);
  };

  const handleRetryLoad = () => {
    retryLoad();
  };

  return (
    <ArchiveApplication
      activeView={activeView}
      dataFilePath={dataFilePath}
      diaryMode={diaryMode}
      dossierMatchError={dossierMatchError}
      dossierMatchPending={dossierMatchPending}
      dossierMatchResults={dossierMatchResults}
      dossierOriginLabel={
        dossierReturnView.current === 'statistics'
          ? 'Statistics'
          : `${dossierReturnView.current[0]?.toUpperCase()}${dossierReturnView.current.slice(1)}`
      }
      dropActive={dropActive}
      feedback={feedback}
      filterSheetOpen={filterSheetOpen}
      filterDraft={filterDraft}
      filters={filters}
      loadError={loadError}
      loading={loading}
      logFilmPending={logFilmSearch.pending}
      logFilmError={logFilmSearch.error}
      logFilmQuery={logFilmQuery}
      logFilmResults={logFilmSearch.results}
      logPanelOpen={logPanelOpen}
      logReview={logReview}
      logSaving={logSaving}
      logSelectedFilm={logSelectedFilm}
      noteFilePath={noteFilePath}
      onAddWatchedFolders={handleAddWatchedFolders}
      onChooseLogPaths={handleChooseLogPaths}
      onClearLogPaths={() => setPendingLogPaths([])}
      onCloseLogPanel={() => setLogPanelOpen(false)}
      onCopyPath={handleCopyPathFor}
      onCreateLog={handleCreateLog}
      onDiaryModeChange={setDiaryMode}
      onDossierBack={handleDossierBack}
      onDrop={handleDrop}
      onDropActiveChange={setDropActive}
      onFeedbackDismiss={() => setFeedback(null)}
      onFilterChange={setFilters}
      onApplyFilterDraft={setFilters}
      onFilterDraftChange={setFilterDraft}
      onFilterSheetOpenChange={handleFilterSheetOpenChange}
      onLogFilmQueryChange={setLogFilmQuery}
      onLogReviewChange={setLogReview}
      onMatchFilm={handleMatchFilm}
      onOpenInFinder={handleOpenInFinder}
      onOpenItem={handleOpenItem}
      onOpenLogPanel={() => handleLogPanelOpenChange(true)}
      onOpenSearchResult={handleOpenSearchResult}
      onRemoveWatchedFolder={handleRemoveWatchedFolder}
      onRetryLoad={handleRetryLoad}
      onRetryMetadata={handleRetryMetadata}
      onScanNow={handleScanNow}
      onSearchDismiss={handleSearchDismiss}
      onSearchActiveIndexChange={setSearchActiveIndex}
      onSearchMatch={handleSearchMatch}
      onSearchQueryChange={handleSearchQueryChange}
      onSelectLibraryPath={setSelectedLibraryPath}
      onSelectLogFilm={(film) => {
        setLogSelectedFilm(film);

        if (film === null) {
          setLogFilmQuery('');
        }
      }}
      onSelectPath={handleSelectPath}
      onUpdateEntry={handleUpdateEntry}
      onViewChange={handleViewChange}
      pendingLogPaths={pendingLogPaths}
      scanInProgress={scanInProgress}
      searchActiveIndex={Math.min(searchActiveIndex, Math.max(0, searchGroups.flat.length - 1))}
      searchCatalogPending={searchCatalog.pending}
      searchCatalogError={searchCatalog.error}
      searchGroups={searchGroups}
      searchQuery={searchQuery}
      selectedLibraryPath={selectedLibraryPath}
      selectedPath={selectedPath}
      state={state}
    />
  );
}

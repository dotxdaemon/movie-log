// ABOUTME: Owns Movie Log's renderer state, IPC calls, dialogs, and catalog searches for the archive.
// ABOUTME: Feeds the pure ArchiveApplication surface and keeps every user action tied to real behavior.
import { startTransition, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
import { readDialogFocusTarget } from './dialog-focus.js';
import {
  createDropFeedbackMessage,
  createScanFeedbackMessage,
  formatCount,
  type WorkspaceFeedback
} from './feedback.js';
import { readCatalogFailureMessage } from './catalog-search.js';
import { focusSearchReturnTarget } from './search-focus.js';
import { readArchiveLoadFailureMessage } from './load-error.js';
import { parseFilmTitle } from '../shared/film-title.js';
import { readVisibleHistory } from '../shared/history.js';
import type { CatalogSearchResult, LogEntryDetails, EntryDetails, MovieLogState } from '../shared/types.js';

const emptyState: MovieLogState = {
  films: {},
  history: [],
  libraryItems: [],
  watchedFolders: []
};

function updateState(nextState: MovieLogState, setState: (value: MovieLogState) => void): void {
  startTransition(() => {
    setState(nextState);
  });
}

function useCatalogSearch(
  query: string,
  enabled: boolean
): { error: string | null; pending: boolean; results: CatalogSearchResult[] } {
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const active = enabled && trimmed.length >= 2;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        if (!active) {
          setError(null);
          setResults([]);
          setPending(false);
          return;
        }

        setPending(true);
        setError(null);
        window.movieLog
          .searchCatalog(`${trimmed} film`)
          .then((nextResults) => {
            if (!cancelled) {
              setResults(nextResults);
            }
          })
          .catch((catalogError: unknown) => {
            if (!cancelled) {
              setResults([]);
              setError(readCatalogFailureMessage(catalogError));
            }
          })
          .finally(() => {
            if (!cancelled) {
              setPending(false);
            }
          });
      },
      active ? 300 : 0
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, query]);

  return { error, pending, results };
}

export default function App() {
  const [activeView, setActiveView] = useState<ArchiveView>('diary');
  const [dataFilePath, setDataFilePath] = useState('');
  const [diaryMode, setDiaryMode] = useState<DiaryMode>('timeline');
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(null);
  const [filters, setFilters] = useState(defaultArchiveFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logFilmQuery, setLogFilmQuery] = useState('');
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [logReview, setLogReview] = useState('');
  const [logSelectedFilm, setLogSelectedFilm] = useState<CatalogSearchResult | null>(null);
  const [dossierMatchPending, setDossierMatchPending] = useState(false);
  const [dossierMatchError, setDossierMatchError] = useState<string | null>(null);
  const [dossierMatchResults, setDossierMatchResults] = useState<CatalogSearchResult[]>([]);
  const [noteFilePath, setNoteFilePath] = useState('');
  const [pendingLogPaths, setPendingLogPaths] = useState<string[]>([]);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibraryPath, setSelectedLibraryPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const searchReturnView = useRef<Exclude<ArchiveView, 'detail' | 'search'>>('diary');

  const searchCatalog = useCatalogSearch(searchQuery, activeView === 'search');
  const logFilmSearch = useCatalogSearch(logFilmQuery, logPanelOpen && logSelectedFilm === null);
  const searchGroups = useMemo(
    () => buildSearchResults(state, searchQuery, searchCatalog.results),
    [searchCatalog.results, searchQuery, state]
  );

  useEffect(() => {
    let isMounted = true;
    let hasLiveState = false;
    const captureProfile = new URLSearchParams(window.location.search).get('capture');
    document.documentElement.dataset.movieLogCaptureReady = 'false';

    if (captureProfile === 'loading') {
      document.documentElement.dataset.movieLogCaptureReady = 'true';
    }

    const unsubscribe = window.movieLog.subscribe((nextState) => {
      hasLiveState = true;
      updateState(nextState, setState);
    });

    const loadAppData = async () => {
      try {
        const [nextState, nextDataFilePath, nextNoteFilePath] = await Promise.all([
          window.movieLog.getState(),
          window.movieLog.getDataFilePath(),
          window.movieLog.getNoteFilePath()
        ]);

        if (!isMounted) {
          return;
        }

        if (!hasLiveState) {
          updateState(nextState, setState);
        }

        setDataFilePath(nextDataFilePath);
        setNoteFilePath(nextNoteFilePath);
        setLoadError(null);
        document.documentElement.dataset.movieLogCaptureReady = 'true';
      } catch (error) {
        if (isMounted) {
          setLoadError(readArchiveLoadFailureMessage(error));
          document.documentElement.dataset.movieLogCaptureReady = 'true';
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAppData();

    return () => {
      isMounted = false;
      delete document.documentElement.dataset.movieLogCaptureReady;
      unsubscribe();
    };
  }, [loadAttempt]);

  useEffect(() => guardDragNavigation(window), []);

  useEffect(() => {
    if (!logPanelOpen && !filterSheetOpen) {
      return;
    }

    const selector = logPanelOpen ? '.log-sheet' : '.filter-sheet';
    const readDialog = () => document.querySelector<HTMLElement>(selector);
    const readFocusable = () =>
      [...(readDialog()?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary') ?? [])].filter(
        (element) => !element.hasAttribute('disabled')
      );

    const initialTarget = readDialog()?.querySelector<HTMLElement>('input, textarea, select') ?? readFocusable()[0];
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();

        if (logPanelOpen) {
          setLogPanelOpen(false);
        } else {
          setFilterSheetOpen(false);
        }

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = readFocusable();
      const target = readDialogFocusTarget(focusable, document.activeElement, event.shiftKey);

      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.setTimeout(() => {
        if (!document.querySelector('.log-sheet, .filter-sheet')) {
          dialogReturnFocus.current?.focus();
          dialogReturnFocus.current = null;
        }
      }, 0);
    };
  }, [filterSheetOpen, logPanelOpen]);

  const runAction = async (action: () => Promise<void>) => {
    setFeedback(null);

    try {
      await action();
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const rememberDialogOpener = () => {
    const activeElement = document.activeElement as HTMLElement | null;

    if (activeElement && !activeElement.closest('.log-sheet, .filter-sheet')) {
      dialogReturnFocus.current = activeElement;
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
      rememberDialogOpener();
    }

    setFilterSheetOpen(open);
  };

  const handleAddWatchedFolders = () =>
    runAction(async () => {
      await window.movieLog.addWatchedFolders();
    });

  const handleCopyPathFor = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.copyPath(itemPath);
      setFeedback({ message: 'Path copied.', tone: 'notice' });
    });

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
    });

  const resetLogDraft = () => {
    setPendingLogPaths([]);
    setLogSelectedFilm(null);
    setLogFilmQuery('');
    setLogReview('');
  };

  const handleCreateLog = async (details: LogEntryDetails) => {
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

    try {
      if (pendingLogPaths.length > 0) {
        const loggedPaths = await window.movieLog.logPaths(
          pendingLogPaths,
          details,
          logSelectedFilm
            ? {
                pageId: logSelectedFilm.pageId,
                title: logSelectedFilm.title,
                year: logSelectedFilm.year
              }
            : undefined
        );

        if (loggedPaths.skippedPaths.length > 0) {
          setFeedback({
            message: createDropFeedbackMessage(loggedPaths),
            tone: 'error'
          });
        } else if (loggedPaths.addedCount === 0) {
          setFeedback({
            message: 'Only folders and likely media files are logged. Hidden files and junk are ignored.',
            tone: 'error'
          });
          return;
        } else {
          setFeedback({
            message: `Logged ${formatCount(loggedPaths.addedCount, 'item')}.`,
            tone: 'notice'
          });
        }
      } else if (logSelectedFilm) {
        await window.movieLog.logFilm(
          {
            pageId: logSelectedFilm.pageId,
            title: logSelectedFilm.title,
            year: logSelectedFilm.year
          },
          details
        );
        setFeedback({
          message: `Logged ${logSelectedFilm.title}.`,
          tone: 'notice'
        });
      }

      updateState(await window.movieLog.getState(), setState);
      resetLogDraft();
      setLogPanelOpen(false);
      setActiveView('diary');
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
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

      updateState(await window.movieLog.getState(), setState);
      setFeedback({ message: 'Diary entry saved.', tone: 'notice' });
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleOpenInFinder = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.openInFinder(itemPath);
    });

  const handleOpenItem = (itemPath: string) =>
    runAction(async () => {
      await window.movieLog.openItem(itemPath);
    });

  const handleRemoveWatchedFolder = (folderId: string) =>
    runAction(async () => {
      await window.movieLog.removeWatchedFolder(folderId);
    });

  const handleScanNow = async () => {
    setFeedback(null);
    setScanInProgress(true);
    const previousHistoryCount = readVisibleHistory(state.history).length;

    try {
      await window.movieLog.scanNow();
      const nextState = await window.movieLog.getState();
      const nextHistoryCount = readVisibleHistory(nextState.history).length;
      updateState(nextState, setState);
      setFeedback({
        message: createScanFeedbackMessage(Math.max(0, nextHistoryCount - previousHistoryCount)),
        tone: 'notice'
      });
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    } finally {
      setScanInProgress(false);
    }
  };

  const handleSelectPath = (path: string) => {
    setSelectedPath(path);
    setSelectedLibraryPath(null);
    setDossierMatchResults([]);
    setActiveView('detail');
  };

  const handleOpenSearchResult = (result: SearchResultItem) => {
    if (result.kind === 'catalog') {
      setLogSelectedFilm({
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
    const parsed = parseFilmTitle(item.title);
    setDossierMatchResults([]);
    setDossierMatchError(null);
    void (async () => {
      try {
        await window.movieLog.matchFilm(item.filmKey, { title: parsed.title, year: parsed.year }, pageId);
        updateState(await window.movieLog.getState(), setState);
        setFeedback({
          message: pageId === null ? 'Catalog match cleared.' : 'Catalog match updated.',
          tone: 'notice'
        });
      } catch (error) {
        setDossierMatchError(readCatalogFailureMessage(error));
      }
    })();
  };

  const handleRetryMetadata = () =>
    runAction(async () => {
      await window.movieLog.retryFilmEnrichment();
      setFeedback({ message: 'Metadata matching resumed.', tone: 'notice' });
    });

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
    setLoadError(null);
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  };

  return (
    <ArchiveApplication
      activeView={activeView}
      dataFilePath={dataFilePath}
      diaryMode={diaryMode}
      dossierMatchError={dossierMatchError}
      dossierMatchPending={dossierMatchPending}
      dossierMatchResults={dossierMatchResults}
      dropActive={dropActive}
      feedback={feedback}
      filterSheetOpen={filterSheetOpen}
      filters={filters}
      loadError={loadError}
      loading={loading}
      logFilmPending={logFilmSearch.pending}
      logFilmError={logFilmSearch.error}
      logFilmQuery={logFilmQuery}
      logFilmResults={logFilmSearch.results}
      logPanelOpen={logPanelOpen}
      logReview={logReview}
      logSelectedFilm={logSelectedFilm}
      noteFilePath={noteFilePath}
      onAddWatchedFolders={handleAddWatchedFolders}
      onChooseLogPaths={handleChooseLogPaths}
      onClearLogPaths={() => setPendingLogPaths([])}
      onCloseLogPanel={() => setLogPanelOpen(false)}
      onCopyPath={handleCopyPathFor}
      onCreateLog={handleCreateLog}
      onDiaryModeChange={setDiaryMode}
      onDrop={handleDrop}
      onDropActiveChange={setDropActive}
      onFeedbackDismiss={() => setFeedback(null)}
      onFilterChange={setFilters}
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

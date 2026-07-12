// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shapes arrivals and folder controls into one character-sheet dossier workspace.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { ArchiveApplication } from './archive-application.js';
import { defaultArchiveFilters, type ArchiveView, type DiaryMode } from './archive-model.js';
import { guardDragNavigation } from './drag-guard.js';
import { createDropFeedbackMessage, createScanFeedbackMessage, formatCount, type WorkspaceFeedback } from './feedback.js';
import { groupEntriesByDay } from './ledger-groups.js';
import { closeRecordMenuFromAction, closeRecordMenusOutside } from './record-menu.js';
import { readTitleFromPath, readVisibleHistory } from '../shared/history.js';
import type { EntryDetails, LogEntryDetails, MovieLogState, WatchEntry } from '../shared/types.js';

const emptyState: MovieLogState = {
  history: [],
  libraryItems: [],
  watchedFolders: []
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short'
});

interface MovieLogWorkspaceProps {
  dropActive: boolean;
  feedback: WorkspaceFeedback | null;
  loading: boolean;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onCopyPath(itemPath: string): Promise<void>;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(isActive: boolean): void;
  onFeedbackDismiss(): void;
  onOpenInFinder(itemPath: string): Promise<void>;
  onOpenItem(itemPath: string): Promise<void>;
  onRemoveWatchedFolder(folderId: string): Promise<void>;
  onScanNow(): Promise<void>;
  onSearchQueryChange(value: string): void;
  scanInProgress: boolean;
  searchQuery: string;
  state: MovieLogState;
}

function updateState(nextState: MovieLogState, setState: (value: MovieLogState) => void): void {
  startTransition(() => {
    setState(nextState);
  });
}

function formatSource(source: WatchEntry['source']): string {
  return source === 'drop' ? 'Manual Drop' : 'Watched Folder';
}

function formatEntryMeta(entry: WatchEntry): string {
  const timeLabel = timeFormatter.format(new Date(entry.watchedAt));
  const kindSuffix = entry.sourceKind === 'directory' ? ' · Folder' : '';

  return `${timeLabel} · ${formatSource(entry.source)}${kindSuffix}`;
}

function readEntryTitle(entry: WatchEntry): string {
  return readTitleFromPath(entry.sourcePath, entry.sourceKind);
}

function matchesSearch(entry: WatchEntry, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const query = normalizedQuery.toLowerCase();
  const title = readEntryTitle(entry);

  return (
    title.toLowerCase().includes(query) ||
    entry.title.toLowerCase().includes(query) ||
    entry.sourcePath.toLowerCase().includes(query)
  );
}

function createLedgerSummary(
  historyCount: number,
  filteredHistory: WatchEntry[],
  searchQuery: string,
  scanInProgress: boolean,
  watchedFolderCount: number
): string {
  if (searchQuery) {
    return `${formatCount(filteredHistory.length, 'result')} from ${formatCount(historyCount, 'entry', 'entries')}`;
  }

  if (scanInProgress) {
    return `Scanning ${formatCount(watchedFolderCount, 'folder')}…`;
  }

  if (historyCount === 0) {
    return 'No arrivals yet';
  }

  if (watchedFolderCount === 0) {
    return `${formatCount(historyCount, 'entry', 'entries')}`;
  }

  return `${formatCount(historyCount, 'entry', 'entries')} across ${formatCount(watchedFolderCount, 'folder')}`;
}

type ControlIconName = 'diary' | 'folder' | 'note' | 'scan';

const controlIconPaths: Record<ControlIconName, string> = {
  diary: 'M3 2.5h7.5v9H3zM5 5h3.5M5 7.25h3.5M5 9.5h2',
  folder: 'M1.75 4h4l1-1.5h5.5v8.75H1.75z',
  note: 'M3 1.75h6.5l2 2v8.5H3zM9.5 1.75v2h2M5 6.5h4.5M5 8.75h4.5',
  scan: 'M3.5 2H2v3.5M10.5 2H12v3.5M3.5 12H2V8.5M10.5 12H12V8.5M4.5 7h5'
};

function ControlIcon({ name }: { name: ControlIconName }) {
  return (
    <svg aria-hidden="true" className="control-icon" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path d={controlIconPaths[name]} stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.2" />
    </svg>
  );
}

export function MovieLogWorkspace({
  dropActive,
  feedback,
  loading,
  noteFilePath,
  onAddWatchedFolders,
  onCopyPath,
  onDrop,
  onDropActiveChange,
  onFeedbackDismiss,
  onOpenInFinder,
  onOpenItem,
  onRemoveWatchedFolder,
  onScanNow,
  onSearchQueryChange,
  scanInProgress,
  searchQuery,
  state
}: MovieLogWorkspaceProps) {
  const history = readVisibleHistory(state.history);
  const normalizedQuery = searchQuery.trim();
  const filteredHistory = history.filter((entry) => matchesSearch(entry, normalizedQuery));
  const ledgerSummary = createLedgerSummary(history.length, filteredHistory, normalizedQuery, scanInProgress, state.watchedFolders.length);
  const visibleFolderItems = state.libraryItems.slice(0, 5);
  const hiddenFolderItemCount = state.libraryItems.length - visibleFolderItems.length;
  const statusBanner = feedback ? (
    <section
      className={feedback.tone === 'notice' ? 'status-banner status-banner-notice' : 'status-banner'}
      role={feedback.tone === 'notice' ? 'status' : 'alert'}
    >
      <span className="status-message">{feedback.message}</span>
      <button aria-label="Dismiss message" className="status-dismiss" onClick={onFeedbackDismiss} type="button">
        ×
      </button>
    </section>
  ) : null;

  const navigationRail = (
    <>
      <div aria-label="Movie Log" className="spine-mark">
        <span>ML</span>
        <small>01</small>
      </div>
      <div aria-current="page" className="spine-current">
        <ControlIcon name="diary" />
        <span>Diary</span>
      </div>
      <button
        className="spine-action"
        disabled={!noteFilePath}
        onClick={() => void onOpenItem(noteFilePath)}
        type="button"
      >
        <ControlIcon name="note" />
        <span>Note</span>
      </button>
      <p className="spine-caption">Arrival archive</p>
    </>
  );

  const mobileNavigation = (
    <>
      <span aria-current="page" className="mobile-nav-current">
        <ControlIcon name="diary" />
        <span>Diary</span>
      </span>
      <button className="mobile-nav-action" onClick={() => void onAddWatchedFolders()} type="button">
        <ControlIcon name="folder" />
        <span>Add</span>
      </button>
      <button
        className="mobile-nav-action"
        disabled={state.watchedFolders.length === 0 || scanInProgress}
        onClick={() => void onScanNow()}
        type="button"
      >
        <ControlIcon name="scan" />
        <span>Scan</span>
      </button>
      <button
        className="mobile-nav-action"
        disabled={!noteFilePath}
        onClick={() => void onOpenItem(noteFilePath)}
        type="button"
      >
        <ControlIcon name="note" />
        <span>Note</span>
      </button>
    </>
  );

  return (
    <AppShell
      mobileNavigation={mobileNavigation}
      navigationRail={navigationRail}
      workspaceStage={
        <div
          className={dropActive ? 'dossier-canvas dossier-canvas-active' : 'dossier-canvas'}
          onDragEnter={() => onDropActiveChange(true)}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }

            onDropActiveChange(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            onDropActiveChange(true);
          }}
          onDrop={onDrop}
        >
          <header className="dossier-head">
            <div className="title-block">
              <p className="section-index">01 / DIARY</p>
              <h1 className="workspace-title">Movie Log</h1>
              <p className="workspace-status">{ledgerSummary}</p>
            </div>

            <label className="dossier-search workspace-search" htmlFor="workspace-search-input">
              <span className="search-label">Search archive</span>
              <span className="search-field">
                <svg aria-hidden="true" className="search-glyph" fill="none" height="14" viewBox="0 0 14 14" width="14">
                  <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.4" />
                  <path d="m9.4 9.4 3.1 3.1" stroke="currentColor" strokeLinecap="square" strokeWidth="1.4" />
                </svg>
                <input
                  id="workspace-search-input"
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      onSearchQueryChange('');
                    }
                  }}
                  placeholder="Title or path"
                  type="search"
                  value={searchQuery}
                />
              </span>
            </label>

            <div className="head-actions">
              <button className="command-button command-button-primary" onClick={() => void onAddWatchedFolders()} type="button">
                <ControlIcon name="folder" />
                <span>Add Folder</span>
              </button>
              <button
                className="command-button"
                disabled={state.watchedFolders.length === 0 || scanInProgress}
                onClick={() => void onScanNow()}
                type="button"
              >
                <ControlIcon name="scan" />
                <span>{scanInProgress ? 'Scanning…' : 'Scan Now'}</span>
              </button>
            </div>
          </header>

          {statusBanner}

          <div className="dossier-grid">
            <section className="diary-body">
              <div className="diary-shoulder">
                <div>
                  <span className="diary-label">Chronological diary</span>
                  <span className="diary-rule" />
                </div>
                <button className="note-button" disabled={!noteFilePath} onClick={() => void onOpenItem(noteFilePath)} type="button">
                  Open Note
                </button>
              </div>

              <div className="records-frame">
                {loading ? (
                  <div aria-label="Loading movie log" className="diary-loading" role="status">
                    <span className="visually-hidden">Loading diary</span>
                    {Array.from({ length: 5 }, (_, index) => (
                      <div className="loading-row" key={index}>
                        <span />
                        <span />
                      </div>
                    ))}
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="blank-slate blank-slate-entries">
                    <p className="blank-title">{normalizedQuery ? 'No matches' : 'Nothing here yet'}</p>
                    {normalizedQuery ? null : <p className="blank-hint">Drop files here or add a watched folder.</p>}
                  </div>
                ) : (
                  <ol className="records-list">
                    {groupEntriesByDay(filteredHistory, new Date()).map((group) => (
                      <li className="record-day" key={group.key}>
                        <h2 className="record-day-title">{group.label}</h2>
                        <ol className="record-day-list">
                          {group.entries.map((entry) => (
                            <li className="record-row" key={entry.id}>
                              <div className="record-copy">
                                <strong className="record-title" title={entry.sourcePath}>
                                  {readEntryTitle(entry)}
                                </strong>
                                <p className="record-meta" title={timestampFormatter.format(new Date(entry.watchedAt))}>
                                  {formatEntryMeta(entry)}
                                </p>
                              </div>

                              <details className="record-menu">
                                <summary className="record-menu-trigger" aria-label={`Actions for ${readEntryTitle(entry)}`}>
                                  ⋯
                                </summary>
                                <div className="record-menu-panel">
                                  <button
                                    className="action-button"
                                    onClick={(event) => {
                                      closeRecordMenuFromAction(event.currentTarget);
                                      void onOpenInFinder(entry.sourcePath);
                                    }}
                                    type="button"
                                  >
                                    Reveal
                                  </button>
                                  {entry.sourceKind === 'file' ? (
                                    <button
                                      className="action-button"
                                      onClick={(event) => {
                                        closeRecordMenuFromAction(event.currentTarget);
                                        void onOpenItem(entry.sourcePath);
                                      }}
                                      type="button"
                                    >
                                      Open
                                    </button>
                                  ) : null}
                                  <button
                                    className="action-button action-button-dim"
                                    onClick={(event) => {
                                      closeRecordMenuFromAction(event.currentTarget);
                                      void onCopyPath(entry.sourcePath);
                                    }}
                                    type="button"
                                  >
                                    Copy Path
                                  </button>
                                </div>
                              </details>
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            <aside aria-label="Folder context" className="context-studies">
              <section className="route-study">
                <div className="study-head">
                  <span className="study-index">A</span>
                  <h2>Watched folders</h2>
                </div>
                {state.watchedFolders.length > 0 ? (
                  <ul className="folder-list">
                    {state.watchedFolders.map((folder) => (
                      <li className="folder-row" key={folder.id}>
                        <div className="folder-info">
                          <strong className="folder-name" title={folder.path}>
                            {folder.name}
                          </strong>
                          <p className="folder-meta">{`Added ${timestampFormatter.format(new Date(folder.addedAt))}`}</p>
                        </div>
                        <button className="folder-remove" onClick={() => void onRemoveWatchedFolder(folder.id)} type="button">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="study-empty">No watched folder.</p>
                )}
              </section>

              <details className="inventory-study folder-state">
                <summary className="folder-state-trigger">
                  <span className="study-index">B</span>
                  <span>Current Contents</span>
                  <span>{formatCount(state.libraryItems.length, 'current item')}</span>
                </summary>
                <div className="folder-state-panel">
                  <ul className="folder-scan-list">
                    {state.watchedFolders.map((folder) => (
                      <li className="folder-scan-row" key={folder.id}>
                        <span>{folder.name}</span>
                        <span>{folder.lastScannedAt ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}` : 'Not scanned yet'}</span>
                      </li>
                    ))}
                  </ul>
                  {visibleFolderItems.length > 0 ? (
                    <ol className="folder-content-list">
                      {visibleFolderItems.map((item) => (
                        <li className="folder-content-row" key={item.id}>
                          <strong title={item.sourcePath}>{readTitleFromPath(item.sourcePath, item.sourceKind)}</strong>
                          <span>{item.sourceKind === 'file' ? 'File' : 'Folder'}</span>
                        </li>
                      ))}
                      {hiddenFolderItemCount > 0 ? (
                        <li className="folder-content-row folder-content-more">{`${formatCount(hiddenFolderItemCount, 'more', 'more')} not shown`}</li>
                      ) : null}
                    </ol>
                  ) : (
                    <p className="folder-state-empty">No current items from watched folders.</p>
                  )}
                </div>
              </details>

              <section className="note-study">
                <div className="study-head">
                  <span className="study-index">C</span>
                  <h2>Readable note</h2>
                </div>
                <button className="note-study-action" disabled={!noteFilePath} onClick={() => void onOpenItem(noteFilePath)} type="button">
                  Open Note
                </button>
              </section>
            </aside>
          </div>

          {dropActive ? (
            <div aria-hidden="true" className="drop-overlay">
              <p className="drop-overlay-title">Drop to log it</p>
              <p className="drop-overlay-hint">Files and folders are recorded with their full paths</p>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ArchiveView>('diary');
  const [dataFilePath, setDataFilePath] = useState('');
  const [diaryMode, setDiaryMode] = useState<DiaryMode>('timeline');
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [noteFilePath, setNoteFilePath] = useState('');
  const [pendingLogPaths, setPendingLogPaths] = useState<string[]>([]);
  const [filters, setFilters] = useState(defaultArchiveFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInProgress, setScanInProgress] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let hasLiveState = false;
    document.documentElement.dataset.movieLogCaptureReady = 'false';

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
        document.documentElement.dataset.movieLogCaptureReady = 'true';
      } catch (error) {
        if (isMounted) {
          setFeedback({ message: (error as Error).message, tone: 'error' });
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
  }, []);

  useEffect(() => {
    const releaseDragGuard = guardDragNavigation(window);
    const closeMenusOutside = (event: PointerEvent) => {
      closeRecordMenusOutside(document, event.target);
    };

    document.addEventListener('pointerdown', closeMenusOutside);

    return () => {
      releaseDragGuard();
      document.removeEventListener('pointerdown', closeMenusOutside);
    };
  }, []);

  const handleAddWatchedFolders = async () => {
    setFeedback(null);

    try {
      await window.movieLog.addWatchedFolders();
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleCopyPath = async (itemPath: string) => {
    setFeedback(null);

    try {
      await window.movieLog.copyPath(itemPath);
      setFeedback({ message: 'Path copied.', tone: 'notice' });
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    setFeedback(null);

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.movieLog.pathForFile(file))
      .filter((itemPath) => itemPath.length > 0);

    if (paths.length === 0) {
      setFeedback({ message: 'Drop a Finder file or folder so Movie Log can read its full path.', tone: 'error' });
      return;
    }

    setPendingLogPaths(paths);
    setLogPanelOpen(true);
  };

  const handleChooseLogPaths = async () => {
    setFeedback(null);

    try {
      const paths = await window.movieLog.chooseLogPaths();

      if (paths.length > 0) {
        setPendingLogPaths(paths);
      }
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleCreateLog = async (details: LogEntryDetails) => {
    setFeedback(null);

    if (pendingLogPaths.length === 0) {
      setFeedback({ message: 'Choose at least one media file or folder.', tone: 'error' });
      return;
    }

    try {
      const loggedPaths = await window.movieLog.logPaths(pendingLogPaths, details);

      if (loggedPaths.skippedPaths.length > 0) {
        setFeedback({ message: createDropFeedbackMessage(loggedPaths), tone: 'error' });
      } else if (loggedPaths.addedCount === 0) {
        setFeedback({ message: 'Only folders and likely media files are logged. Hidden files and junk are ignored.', tone: 'error' });
        return;
      } else {
        setFeedback({ message: `Logged ${formatCount(loggedPaths.addedCount, 'item')}.`, tone: 'notice' });
      }

      updateState(await window.movieLog.getState(), setState);
      setPendingLogPaths([]);
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
        setFeedback({ message: 'That diary entry is no longer available.', tone: 'error' });
        return;
      }

      updateState(await window.movieLog.getState(), setState);
      setFeedback({ message: 'Diary entry saved.', tone: 'notice' });
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleOpenInFinder = async (itemPath: string) => {
    setFeedback(null);

    try {
      await window.movieLog.openInFinder(itemPath);
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleOpenItem = async (itemPath: string) => {
    setFeedback(null);

    try {
      await window.movieLog.openItem(itemPath);
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleRemoveWatchedFolder = async (folderId: string) => {
    setFeedback(null);

    try {
      await window.movieLog.removeWatchedFolder(folderId);
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    }
  };

  const handleScanNow = async () => {
    setFeedback(null);
    setScanInProgress(true);
    const previousHistoryCount = readVisibleHistory(state.history).length;

    try {
      await window.movieLog.scanNow();
      const nextState = await window.movieLog.getState();
      const nextHistoryCount = readVisibleHistory(nextState.history).length;
      updateState(nextState, setState);
      setFeedback({ message: createScanFeedbackMessage(Math.max(0, nextHistoryCount - previousHistoryCount)), tone: 'notice' });
    } catch (error) {
      setFeedback({ message: (error as Error).message, tone: 'error' });
    } finally {
      setScanInProgress(false);
    }
  };

  return (
    <ArchiveApplication
      activeView={activeView}
      dataFilePath={dataFilePath}
      diaryMode={diaryMode}
      dropActive={dropActive}
      feedback={feedback}
      filters={filters}
      loading={loading}
      logPanelOpen={logPanelOpen}
      noteFilePath={noteFilePath}
      onAddWatchedFolders={handleAddWatchedFolders}
      onChooseLogPaths={handleChooseLogPaths}
      onClearLogPaths={() => setPendingLogPaths([])}
      onCloseLogPanel={() => setLogPanelOpen(false)}
      onCopyPath={handleCopyPath}
      onCreateLog={handleCreateLog}
      onDiaryModeChange={setDiaryMode}
      onDrop={handleDrop}
      onDropActiveChange={setDropActive}
      onFeedbackDismiss={() => setFeedback(null)}
      onFilterChange={setFilters}
      onOpenInFinder={handleOpenInFinder}
      onOpenItem={handleOpenItem}
      onOpenLogPanel={() => setLogPanelOpen(true)}
      onRemoveWatchedFolder={handleRemoveWatchedFolder}
      onScanNow={handleScanNow}
      onSearchQueryChange={setSearchQuery}
      onSelectPath={(path) => {
        setSelectedPath(path);
        setActiveView('detail');
      }}
      onUpdateEntry={handleUpdateEntry}
      onViewChange={setActiveView}
      pendingLogPaths={pendingLogPaths}
      scanInProgress={scanInProgress}
      searchQuery={searchQuery}
      selectedPath={selectedPath}
      state={state}
    />
  );
}

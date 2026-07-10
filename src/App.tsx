// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shapes arrivals and folder controls into one tailored ledger workspace.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { guardDragNavigation } from './drag-guard.js';
import { createDropFeedbackMessage, createScanFeedbackMessage, formatCount, type WorkspaceFeedback } from './feedback.js';
import { closeRecordMenuFromAction, closeRecordMenusOutside } from './record-menu.js';
import { readTitleFromPath, readVisibleHistory } from '../shared/history.js';
import type { MovieLogState, WatchEntry } from '../shared/types.js';

const emptyState: MovieLogState = {
  history: [],
  libraryItems: [],
  watchedFolders: []
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

interface MovieLogWorkspaceProps {
  dropActive: boolean;
  feedback: WorkspaceFeedback | null;
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

function formatEntryType(sourceKind: WatchEntry['sourceKind']): string {
  return sourceKind === 'file' ? 'File' : 'Folder';
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

export function MovieLogWorkspace({
  dropActive,
  feedback,
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

  return (
    <AppShell
      workspaceStage={
        <div className="workspace-stack tailored-stage">
          <header className="workspace-head">
            <div className="title-block">
              <h1 className="workspace-title">Movie Log</h1>
              <p className="workspace-status">{ledgerSummary}</p>
            </div>
          </header>

          {statusBanner}

          <section
            className={dropActive ? 'tailored-room tailored-room-active' : 'tailored-room'}
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
            <section className="command-bar">
              <button className="note-button" disabled={!noteFilePath} onClick={() => void onOpenItem(noteFilePath)} type="button">
                Open Note
              </button>
              <label className="workspace-search" htmlFor="workspace-search-input">
                <input
                  id="workspace-search-input"
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      onSearchQueryChange('');
                    }
                  }}
                  placeholder="Search…"
                  type="search"
                  value={searchQuery}
                />
              </label>
              <div className="command-actions">
                <button className="command-button command-button-primary" onClick={() => void onAddWatchedFolders()} type="button">
                  Add Folder
                </button>
                <button
                  className="command-button"
                  disabled={state.watchedFolders.length === 0 || scanInProgress}
                  onClick={() => void onScanNow()}
                  type="button"
                >
                  {scanInProgress ? 'Scanning…' : 'Scan Now'}
                </button>
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
              ) : null}

              {state.watchedFolders.length > 0 ? (
                <details className="folder-state">
                  <summary className="folder-state-trigger">
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
              ) : null}
            </section>

            <section className="entries-panel ledger-surface">
              <div className="records-frame">
                {filteredHistory.length === 0 ? (
                  <div className="blank-slate blank-slate-entries">
                    <p className="blank-title">{normalizedQuery ? 'No matches' : 'Nothing here yet'}</p>
                    {normalizedQuery ? null : <p className="blank-hint">Drop files here or add a watched folder.</p>}
                  </div>
                ) : (
                  <ol className="records-list">
                    {filteredHistory.map((entry) => (
                      <li className="record-row" key={entry.id}>
                        <div className="record-copy">
                          <strong className="record-title" title={entry.sourcePath}>
                            {readEntryTitle(entry)}
                          </strong>
                          <p className="record-meta">
                            {timestampFormatter.format(new Date(entry.watchedAt))} · {formatSource(entry.source)} · {formatEntryType(entry.sourceKind)}
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
                )}
              </div>
            </section>
          </section>
        </div>
      }
    />
  );
}

export default function App() {
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(null);
  const [noteFilePath, setNoteFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInProgress, setScanInProgress] = useState(false);

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
        const [nextState, nextNoteFilePath] = await Promise.all([
          window.movieLog.getState(),
          window.movieLog.getNoteFilePath()
        ]);

        if (!isMounted) {
          return;
        }

        if (!hasLiveState) {
          updateState(nextState, setState);
        }

        setNoteFilePath(nextNoteFilePath);
        document.documentElement.dataset.movieLogCaptureReady = 'true';
      } catch (error) {
        if (isMounted) {
          setFeedback({ message: (error as Error).message, tone: 'error' });
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

    try {
      const loggedPaths = await window.movieLog.logPaths(paths);

      if (loggedPaths.skippedPaths.length > 0) {
        setFeedback({ message: createDropFeedbackMessage(loggedPaths), tone: 'error' });
        return;
      }

      if (loggedPaths.addedCount === 0) {
        setFeedback({ message: 'Only folders and likely media files are logged. Hidden files and junk are ignored.', tone: 'error' });
        return;
      }

      setFeedback({ message: `Logged ${formatCount(loggedPaths.addedCount, 'item')}.`, tone: 'notice' });
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
    <MovieLogWorkspace
      dropActive={dropActive}
      feedback={feedback}
      noteFilePath={noteFilePath}
      onAddWatchedFolders={handleAddWatchedFolders}
      onCopyPath={handleCopyPath}
      onDrop={handleDrop}
      onDropActiveChange={setDropActive}
      onFeedbackDismiss={() => setFeedback(null)}
      onOpenInFinder={handleOpenInFinder}
      onOpenItem={handleOpenItem}
      onRemoveWatchedFolder={handleRemoveWatchedFolder}
      onScanNow={handleScanNow}
      onSearchQueryChange={setSearchQuery}
      scanInProgress={scanInProgress}
      searchQuery={searchQuery}
      state={state}
    />
  );
}

// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shapes arrivals and folder controls into one tailored ledger workspace.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { createDropFeedbackMessage, createScanFeedbackMessage, formatCount } from './feedback.js';
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
  errorMessage: string;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onCopyPath(itemPath: string): Promise<void>;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(isActive: boolean): void;
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

function matchesSearch(entry: WatchEntry, searchQuery: string): boolean {
  if (!searchQuery) {
    return true;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const title = readEntryTitle(entry);

  if (!normalizedQuery) {
    return true;
  }

  return (
    title.toLowerCase().includes(normalizedQuery) ||
    entry.title.toLowerCase().includes(normalizedQuery) ||
    entry.sourcePath.toLowerCase().includes(normalizedQuery)
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
  errorMessage,
  noteFilePath,
  onAddWatchedFolders,
  onCopyPath,
  onDrop,
  onDropActiveChange,
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
  const filteredHistory = history.filter((entry) => matchesSearch(entry, searchQuery));
  const ledgerSummary = createLedgerSummary(history.length, filteredHistory, searchQuery, scanInProgress, state.watchedFolders.length);
  const issueMark = String(history.length).padStart(2, '0');
  const visibleFolderItems = state.libraryItems.slice(0, 5);
  const hiddenFolderItemCount = state.libraryItems.length - visibleFolderItems.length;
  const statusBanner = errorMessage ? (
    <section className="status-banner" role="alert">
      {errorMessage}
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

            <p aria-hidden="true" className="entry-count">
              {issueMark}
            </p>

          </header>

          {statusBanner}

          <section
            className={dropActive ? 'tailored-room tailored-room-active' : 'tailored-room'}
            onDragEnter={() => onDropActiveChange(true)}
            onDragLeave={() => onDropActiveChange(false)}
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
                        <strong className="folder-name">{folder.name}</strong>
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
                            <strong>{readTitleFromPath(item.sourcePath, item.sourceKind)}</strong>
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
                    <p className="blank-title">{searchQuery ? 'No matches' : 'Nothing here yet'}</p>
                  </div>
                ) : (
                  <ol className="records-list">
                    {filteredHistory.map((entry) => (
                      <li className="record-row" key={entry.id}>
                        <div className="record-copy">
                          <strong className="record-title">{readEntryTitle(entry)}</strong>
                          <p className="record-meta">
                            {timestampFormatter.format(new Date(entry.watchedAt))} · {formatSource(entry.source)} · {formatEntryType(entry.sourceKind)}
                          </p>
                        </div>

                        <details className="record-menu">
                          <summary className="record-menu-trigger" aria-label={`Actions for ${readEntryTitle(entry)}`}>
                            ...
                          </summary>
                          <div className="record-menu-panel">
                            <button className="action-button" onClick={() => void onOpenInFinder(entry.sourcePath)} type="button">
                              Reveal
                            </button>
                            {entry.sourceKind === 'file' ? (
                              <button className="action-button" onClick={() => void onOpenItem(entry.sourcePath)} type="button">
                                Open
                              </button>
                            ) : null}
                            <button className="action-button action-button-dim" onClick={() => void onCopyPath(entry.sourcePath)} type="button">
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
  const [errorMessage, setErrorMessage] = useState('');
  const [noteFilePath, setNoteFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInProgress, setScanInProgress] = useState(false);

  useEffect(() => {
    let isMounted = true;
    document.documentElement.dataset.movieLogCaptureReady = 'false';

    const loadAppData = async () => {
      const [nextState, nextNoteFilePath] = await Promise.all([
        window.movieLog.getState(),
        window.movieLog.getNoteFilePath()
      ]);

      if (!isMounted) {
        return;
      }

      updateState(nextState, setState);
      setNoteFilePath(nextNoteFilePath);
      document.documentElement.dataset.movieLogCaptureReady = 'true';
    };

    void loadAppData();

    const unsubscribe = window.movieLog.subscribe((nextState) => {
      updateState(nextState, setState);
    });

    return () => {
      isMounted = false;
      delete document.documentElement.dataset.movieLogCaptureReady;
      unsubscribe();
    };
  }, []);

  const handleAddWatchedFolders = async () => {
    setErrorMessage('');

    try {
      await window.movieLog.addWatchedFolders();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleCopyPath = async (itemPath: string) => {
    setErrorMessage('');

    try {
      await window.movieLog.copyPath(itemPath);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    setErrorMessage('');

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.movieLog.pathForFile(file))
      .filter((itemPath) => itemPath.length > 0);

    if (paths.length === 0) {
      setErrorMessage('Drop a Finder file or folder so Movie Log can read its full path.');
      return;
    }

    try {
      const loggedPaths = await window.movieLog.logPaths(paths);

      if (loggedPaths.skippedPaths.length > 0) {
        setErrorMessage(createDropFeedbackMessage(loggedPaths));
        return;
      }

      if (loggedPaths.addedCount === 0) {
        setErrorMessage('Only folders and likely media files are logged. Hidden files and junk are ignored.');
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleOpenInFinder = async (itemPath: string) => {
    setErrorMessage('');

    try {
      await window.movieLog.openInFinder(itemPath);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleOpenItem = async (itemPath: string) => {
    setErrorMessage('');

    try {
      await window.movieLog.openItem(itemPath);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleRemoveWatchedFolder = async (folderId: string) => {
    setErrorMessage('');

    try {
      await window.movieLog.removeWatchedFolder(folderId);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleScanNow = async () => {
    setErrorMessage('');
    setScanInProgress(true);
    const previousHistoryCount = readVisibleHistory(state.history).length;

    try {
      await window.movieLog.scanNow();
      const nextState = await window.movieLog.getState();
      const nextHistoryCount = readVisibleHistory(nextState.history).length;
      updateState(nextState, setState);
      setErrorMessage(createScanFeedbackMessage(Math.max(0, nextHistoryCount - previousHistoryCount)));
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setScanInProgress(false);
    }
  };

  return (
    <MovieLogWorkspace
      dropActive={dropActive}
      errorMessage={errorMessage}
      noteFilePath={noteFilePath}
      onAddWatchedFolders={handleAddWatchedFolders}
      onCopyPath={handleCopyPath}
      onDrop={handleDrop}
      onDropActiveChange={setDropActive}
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

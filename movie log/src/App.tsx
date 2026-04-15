// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Keeps one poster-led workspace with a focal arrivals stage and framed folder utilities.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell.js';
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

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function matchesSearch(entry: WatchEntry, searchQuery: string): boolean {
  if (!searchQuery) {
    return true;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    entry.title.toLowerCase().includes(normalizedQuery) ||
    entry.sourcePath.toLowerCase().includes(normalizedQuery)
  );
}

function collapseHistory(entries: WatchEntry[]): WatchEntry[] {
  const historyByPath = new Map<string, WatchEntry>();
  const manualEntries: WatchEntry[] = [];

  for (const entry of entries) {
    if (entry.source !== 'watch') {
      manualEntries.push(entry);
      continue;
    }

    const existing = historyByPath.get(entry.sourcePath);

    if (!existing || entry.watchedAt < existing.watchedAt) {
      historyByPath.set(entry.sourcePath, entry);
    }
  }

  return [...manualEntries, ...historyByPath.values()].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
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
  const history = collapseHistory(state.history);
  const filteredHistory = history.filter((entry) => matchesSearch(entry, searchQuery));
  const ledgerSummary = createLedgerSummary(history.length, filteredHistory, searchQuery, scanInProgress, state.watchedFolders.length);
  const watchedFolderSummary =
    state.watchedFolders.length === 0 ? 'None active' : `${formatCount(state.watchedFolders.length, 'folder')} active`;
  const issueMark = String(history.length).padStart(2, '0');
  const statusBanner = errorMessage ? (
    <section className="status-banner" role="alert">
      {errorMessage}
    </section>
  ) : null;

  return (
    <AppShell
      workspaceStage={
        <div className="workspace-stack poster-stage">
          <div aria-hidden="true" className="sunbeam-field">
            <span className="sunbeam sunbeam-one" />
            <span className="sunbeam sunbeam-two" />
            <span className="sunbeam sunbeam-three" />
          </div>

          <div aria-hidden="true" className="botanical-edge botanical-edge-left" />
          <div aria-hidden="true" className="botanical-edge botanical-edge-right" />

          <header className="poster-head">
            <div className="masthead-banner">
              <h1 className="workspace-title">Movie Log</h1>
            </div>

            <div className="issue-column">
              <p className="issue-label">Issue</p>
              <p className="issue-mark">{issueMark}</p>
            </div>

            <div className="title-mark">
              <p className="records-label">Arrivals</p>
              <p className="workspace-status">{ledgerSummary}</p>
            </div>

            <div className="head-actions">
              <button className="note-button" disabled={!noteFilePath} onClick={() => void onOpenItem(noteFilePath)} type="button">
                Open Note
              </button>
              <label className="workspace-search">
                <input onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search arrivals…" type="search" value={searchQuery} />
              </label>
            </div>
          </header>

          {statusBanner}

          <section
            className={dropActive ? 'poster-room poster-room-active' : 'poster-room'}
            onDragEnter={() => onDropActiveChange(true)}
            onDragLeave={() => onDropActiveChange(false)}
            onDragOver={(event) => {
              event.preventDefault();
              onDropActiveChange(true);
            }}
            onDrop={onDrop}
          >
            <section className="focal-seat">
              <div aria-hidden="true" className="seat-shadow" />
              <div className="records-frame">
                <div className="records-head">
                  <div>
                    <p className="records-label">Recent Arrivals</p>
                    <p className="seat-caption">Finder drops and watched-folder arrivals appear here in order.</p>
                  </div>
                </div>

                <section className="records-scroll">
                  {filteredHistory.length === 0 ? (
                    <div className="blank-slate blank-slate-records">
                      <p className="blank-title">{searchQuery ? 'No matches' : 'Nothing here yet'}</p>
                      {!searchQuery ? <p className="blank-copy">Drop files or add a watched folder to start logging.</p> : null}
                    </div>
                  ) : (
                    <ol className="records-list">
                      {filteredHistory.map((entry) => (
                        <li className="record-row" key={entry.id}>
                          <div className="record-copy">
                            <strong className="record-title">{entry.title}</strong>
                            <p className="record-meta">
                              {timestampFormatter.format(new Date(entry.watchedAt))} · {formatSource(entry.source)} · {formatEntryType(entry.sourceKind)}
                            </p>
                          </div>

                          <div className="record-actions">
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
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </section>

            <aside className="wall-gallery">
              <div aria-hidden="true" className="gallery-frame gallery-frame-tall" />
              <section className="routes-frame">
                <div className="routes-body">
                  <div className="routes-head">
                    <p className="routes-label">Watched Folders</p>
                    <p className="routes-status">{watchedFolderSummary}</p>
                  </div>

                  <div className="routes-actions">
                    <button className="routes-button routes-button-primary" onClick={() => void onAddWatchedFolders()} type="button">
                      Add Folder
                    </button>
                    <button
                      className="routes-button"
                      disabled={state.watchedFolders.length === 0 || scanInProgress}
                      onClick={() => void onScanNow()}
                      type="button"
                    >
                      {scanInProgress ? 'Scanning…' : 'Scan Now'}
                    </button>
                  </div>

                  <section className="routes-list">
                    {state.watchedFolders.length === 0 ? (
                      <div className="blank-slate blank-slate-compact">
                        <p className="blank-copy">No folders watched yet.</p>
                      </div>
                    ) : (
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
                    )}
                  </section>
                </div>
              </section>
              <div aria-hidden="true" className="gallery-frame gallery-frame-wide" />
            </aside>
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
        setErrorMessage(
          `Logged ${formatCount(loggedPaths.addedCount, 'item')}. Skipped ${formatCount(loggedPaths.skippedPaths.length, 'path')} that could not be read.`
        );
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

    try {
      await window.movieLog.scanNow();
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

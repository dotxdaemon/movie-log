// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows a cinematic archive ledger first, with watched-folder status and local details alongside it.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell.js';
import { FolderSnapshotPanel } from './folder-snapshot-panel.js';
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

type ActiveView = 'details' | 'log';

interface MovieLogWorkspaceProps {
  activeView: ActiveView;
  dropActive: boolean;
  errorMessage: string;
  logFilePath: string;
  noteFilePath: string;
  onActivateDetails(): void;
  onActivateLog(): void;
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

function createLedgerSummary(
  state: MovieLogState,
  filteredHistory: WatchEntry[],
  searchQuery: string,
  scanInProgress: boolean
): string {
  const watchedFolderStatus =
    state.watchedFolders.length === 0
      ? 'No watched folders are active yet.'
      : `Watching ${formatCount(state.watchedFolders.length, 'folder')} for new arrivals.`;

  if (searchQuery) {
    return `${formatCount(filteredHistory.length, 'entry', 'entries')} of ${formatCount(state.history.length, 'entry', 'entries')} shown. ${watchedFolderStatus}`;
  }

  if (state.history.length === 0) {
    return `${watchedFolderStatus} Drop a file or add a watched folder to start the ledger.`;
  }

  if (scanInProgress) {
    return `${formatCount(state.history.length, 'entry', 'entries')} recorded. Scanning watched folders now.`;
  }

  return `${formatCount(state.history.length, 'entry', 'entries')} recorded. ${watchedFolderStatus}`;
}

export function MovieLogWorkspace({
  activeView,
  dropActive,
  errorMessage,
  logFilePath,
  noteFilePath,
  onActivateDetails,
  onActivateLog,
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
  const filteredHistory = state.history.filter((entry) => matchesSearch(entry, searchQuery));
  const ledgerSummary = createLedgerSummary(state, filteredHistory, searchQuery, scanInProgress);
  const watchedFolderSummary =
    state.watchedFolders.length === 0 ? 'None active' : `${formatCount(state.watchedFolders.length, 'folder')} active`;
  const statusBanner = errorMessage ? (
    <section className="status-banner" role="alert">
      {errorMessage}
    </section>
  ) : null;

  return (
    <AppShell
      archiveStage={
        activeView === 'log' ? (
          <div className="poster-view">
            <header className="poster-header">
              <div className="poster-title-block">
                <p className="poster-overline">Arrival Index</p>
                <p className="poster-brand">Movie Log</p>
                <h2 className="poster-title">Watch Ledger</h2>
                <p className="poster-summary">{ledgerSummary}</p>
              </div>
              <p className="poster-axis">WATCH / SEARCH / SCAN</p>
            </header>

            <section
              className={dropActive ? 'ledger-plane ledger-plane-active' : 'ledger-plane'}
              onDragEnter={() => onDropActiveChange(true)}
              onDragLeave={() => onDropActiveChange(false)}
              onDragOver={(event) => {
                event.preventDefault();
                onDropActiveChange(true);
              }}
              onDrop={onDrop}
            >
              <div className="plane-toolbar">
                <div className="drop-panel">
                  <span className="poster-overline">Manual Drop</span>
                  <div className="drop-panel-copy">
                    <strong>Drop media here</strong>
                    <p>Folders and files land directly in the running index.</p>
                  </div>
                </div>

                <label className="toolbar-search">
                  <span className="visually-hidden">Search history</span>
                  <input
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    placeholder="Search title or path"
                    type="search"
                    value={searchQuery}
                  />
                </label>
              </div>

              {statusBanner}

              {filteredHistory.length === 0 ? (
                <div className="blank-slate blank-slate-records">
                  <p className="blank-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
                  {!searchQuery ? <p className="blank-copy">New arrivals will appear here.</p> : null}
                </div>
              ) : (
                <ol className="ledger-list">
                  {filteredHistory.map((entry) => (
                    <li className="ledger-row" key={entry.id}>
                      <div className="ledger-copy">
                        <strong className="ledger-title">{entry.title}</strong>
                        <p className="ledger-meta">
                          {timestampFormatter.format(new Date(entry.watchedAt))} • {formatSource(entry.source)} •{' '}
                          {formatEntryType(entry.sourceKind)}
                        </p>
                        <p className="path-line">{entry.sourcePath}</p>
                      </div>

                      <div className="ledger-actions">
                        <button className="finder-button" onClick={() => void onOpenInFinder(entry.sourcePath)} type="button">
                          Show in Finder
                        </button>
                        <details className="row-more">
                          <summary>More</summary>
                          <div className="row-more-menu">
                            {entry.sourceKind === 'file' ? (
                              <button className="text-button" onClick={() => void onOpenItem(entry.sourcePath)} type="button">
                                Open
                              </button>
                            ) : null}
                            <button className="text-button" onClick={() => void onCopyPath(entry.sourcePath)} type="button">
                              Copy Path
                            </button>
                          </div>
                        </details>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : (
          <div className="poster-view poster-view-details">
            <header className="poster-header poster-header-details">
              <div className="poster-title-block">
                <p className="poster-overline">Local Archive</p>
                <p className="poster-brand">Movie Log</p>
                <h2 className="poster-title">Archive Files</h2>
                <p className="poster-summary">
                  {formatCount(state.libraryItems.length, 'item')} in current contents. The readable note and app store live
                  here, off the main ledger.
                </p>
              </div>
              <div className="poster-aside">
                <p className="poster-axis">NOTE / STORE / CONTENTS</p>
                <button className="stage-link" onClick={onActivateLog} type="button">
                  Back to Log
                </button>
              </div>
            </header>

            <section className="ledger-plane ledger-plane-details">
              {statusBanner}

              <section className="detail-panel">
                <div className="plane-section-head">
                  <p className="poster-overline">Archive Files</p>
                  <h3>Archive Files</h3>
                </div>
                <FolderSnapshotPanel
                  compact
                  items={state.libraryItems}
                  onCopyPath={onCopyPath}
                  onOpenInFinder={onOpenInFinder}
                  onOpenItem={onOpenItem}
                  timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
                />
              </section>

              <section className="detail-panel">
                <div className="plane-section-head">
                  <p className="poster-overline">Readable Note</p>
                  <h3>Readable Note</h3>
                </div>
                <p className="details-copy">The append-only note mirrors the archive ledger on disk.</p>
                <p className="path-line">{noteFilePath}</p>
                <div className="details-actions">
                  <button className="finder-button" disabled={!noteFilePath} onClick={() => void onOpenItem(noteFilePath)} type="button">
                    Open Note
                  </button>
                  <button className="text-button" disabled={!noteFilePath} onClick={() => void onCopyPath(noteFilePath)} type="button">
                    Copy Note Path
                  </button>
                </div>
              </section>

              <section className="detail-panel">
                <div className="plane-section-head">
                  <p className="poster-overline">Data Store</p>
                  <h3>Data Store</h3>
                </div>
                <p className="details-copy">The local JSON store stays out of the main working surface.</p>
                <p className="path-line">{logFilePath}</p>
                <div className="details-actions">
                  <button className="finder-button" disabled={!logFilePath} onClick={() => void onOpenInFinder(logFilePath)} type="button">
                    Show in Finder
                  </button>
                  <button className="text-button" disabled={!logFilePath} onClick={() => void onCopyPath(logFilePath)} type="button">
                    Copy Store Path
                  </button>
                </div>
              </section>
            </section>
          </div>
        )
      }
      statusSpine={
        <div className="control-stack">
          <div className="control-head">
            <p className="control-overline">Cinematic archive</p>
            <h1 className="control-title">Movie Log</h1>
            <p className="control-note">Tracks watched arrivals, scan routes, and the files still alive in the archive.</p>
          </div>

          <div className="control-actions">
            <button className="slab-primary" onClick={() => void onAddWatchedFolders()} type="button">
              Add Folder
            </button>
            <button
              className="slab-secondary"
              disabled={state.watchedFolders.length === 0 || scanInProgress}
              onClick={() => void onScanNow()}
              type="button"
            >
              {scanInProgress ? 'Scanning...' : 'Scan Now'}
            </button>
            <button
              aria-pressed={activeView === 'details'}
              className={activeView === 'details' ? 'slab-switch slab-switch-active' : 'slab-switch'}
              onClick={onActivateDetails}
              type="button"
            >
              Details
            </button>
          </div>

          <section className="control-section">
            <div className="control-section-head">
              <h2>Watch Routes</h2>
              <p className="control-section-note">{watchedFolderSummary}</p>
            </div>

            {state.watchedFolders.length === 0 ? (
              <div className="blank-slate blank-slate-compact">
                <p className="blank-title">No watched folders</p>
                <p className="blank-copy">Add one to watch new arrivals land in the ledger.</p>
              </div>
            ) : (
              <ul className="folder-list">
                {state.watchedFolders.map((folder) => (
                  <li className="folder-row" key={folder.id}>
                    <div className="folder-copy">
                      <strong className="folder-title">{folder.name}</strong>
                      <p className="folder-meta">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for scan or arrival'}
                      </p>
                      <p className="path-line">{folder.path}</p>
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
      }
    />
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('log');
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [logFilePath, setLogFilePath] = useState('');
  const [noteFilePath, setNoteFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInProgress, setScanInProgress] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAppData = async () => {
      const [nextState, nextLogFilePath, nextNoteFilePath] = await Promise.all([
        window.movieLog.getState(),
        window.movieLog.getDataFilePath(),
        window.movieLog.getNoteFilePath()
      ]);

      if (!isMounted) {
        return;
      }

      updateState(nextState, setState);
      setLogFilePath(nextLogFilePath);
      setNoteFilePath(nextNoteFilePath);
    };

    void loadAppData();

    const unsubscribe = window.movieLog.subscribe((nextState) => {
      updateState(nextState, setState);
    });

    return () => {
      isMounted = false;
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
      activeView={activeView}
      dropActive={dropActive}
      errorMessage={errorMessage}
      logFilePath={logFilePath}
      noteFilePath={noteFilePath}
      onActivateDetails={() => setActiveView('details')}
      onActivateLog={() => setActiveView('log')}
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

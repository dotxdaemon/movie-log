// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows a controlled archive workspace with watched-folder controls beside history and file details.
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
  const archiveSummary = `${formatCount(state.libraryItems.length, 'item')} in current contents. The readable note and data store live here, off the main ledger.`;
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
          <div className="records-view">
            <header className="workspace-band">
              <div className="band-mark">
                <div aria-hidden="true" className="rail-mark" />
                <p className="section-label">Movie Log</p>
                <h2 className="workspace-title">Watch Ledger</h2>
              </div>
              <div className="band-status">
                <p className="section-label">Status</p>
                <p className="workspace-status">{ledgerSummary}</p>
              </div>
              <div className="band-tools">
                <div className="band-tools-frame">
                  <div className="band-tools-stack">
                    <div className="drop-hint">
                      <p className="section-label">Manual Drop</p>
                      <p className="drop-copy">Drop media here</p>
                    </div>
                    <label className="workspace-search">
                      <span className="visually-hidden">Search history</span>
                      <input
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="Search title or path"
                        type="search"
                        value={searchQuery}
                      />
                    </label>
                  </div>
                </div>
                <p className="band-axis">Watch / Search / Scan</p>
              </div>
            </header>

            <section
              className={dropActive ? 'records-surface records-surface-active' : 'records-surface'}
              onDragEnter={() => onDropActiveChange(true)}
              onDragLeave={() => onDropActiveChange(false)}
              onDragOver={(event) => {
                event.preventDefault();
                onDropActiveChange(true);
              }}
              onDrop={onDrop}
            >
              {statusBanner}

              {filteredHistory.length === 0 ? (
                <div className="blank-slate blank-slate-records">
                  <p className="blank-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
                  {!searchQuery ? <p className="blank-copy">New arrivals will appear here.</p> : null}
                </div>
              ) : (
                <ol className="records-list">
                  {filteredHistory.map((entry) => (
                    <li className="record-row" key={entry.id}>
                      <div className="record-copy">
                        <strong className="record-title">{entry.title}</strong>
                        <p className="record-meta">
                          {timestampFormatter.format(new Date(entry.watchedAt))} • {formatSource(entry.source)} •{' '}
                          {formatEntryType(entry.sourceKind)}
                        </p>
                        <p className="path-line">{entry.sourcePath}</p>
                      </div>

                      <div className="record-actions">
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
          <div className="records-view records-view-details">
            <header className="workspace-band">
              <div className="band-mark">
                <div aria-hidden="true" className="rail-mark" />
                <p className="section-label">Movie Log</p>
                <h2 className="workspace-title">Archive Files</h2>
              </div>
              <div className="band-status">
                <p className="section-label">Reference</p>
                <p className="workspace-status">{archiveSummary}</p>
              </div>
              <div className="band-tools band-tools-reference">
                <div className="band-tools-frame">
                  <div className="band-tools-stack">
                    <p className="section-label">Storage</p>
                    <p className="drop-copy">Readable note and JSON store paths.</p>
                  </div>
                </div>
                <p className="band-axis">Note / Store / Contents</p>
              </div>
            </header>

            <section className="records-surface records-surface-details">
              {statusBanner}

              <section className="detail-panel">
                <div className="detail-section-head">
                  <p className="section-label">Archive Files</p>
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
                <div className="detail-section-head">
                  <p className="section-label">Readable Note</p>
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
                <div className="detail-section-head">
                  <p className="section-label">Data Store</p>
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
        <div className="rail-stack">
          <div className="rail-head">
            <div aria-hidden="true" className="rail-mark" />
            <p className="section-label">Movie Log</p>
            <p className="rail-note">Watched folders, scan controls, and view changes stay on this side of the workspace.</p>
          </div>

          <div className="rail-actions">
            <button className="rail-button rail-button-primary" onClick={() => void onAddWatchedFolders()} type="button">
              Add Folder
            </button>
            <button
              className="rail-button"
              disabled={state.watchedFolders.length === 0 || scanInProgress}
              onClick={() => void onScanNow()}
              type="button"
            >
              {scanInProgress ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>

          <div className="view-switcher" aria-label="Workspace view">
            <button
              aria-pressed={activeView === 'log'}
              className={activeView === 'log' ? 'view-switch view-switch-active' : 'view-switch'}
              onClick={onActivateLog}
              type="button"
            >
              Log
            </button>
            <button
              aria-pressed={activeView === 'details'}
              className={activeView === 'details' ? 'view-switch view-switch-active' : 'view-switch'}
              onClick={onActivateDetails}
              type="button"
            >
              Details
            </button>
          </div>

          <section className="rail-section">
            <div className="rail-section-head">
              <h2>Watch Routes</h2>
              <p className="rail-section-note">{watchedFolderSummary}</p>
            </div>

            {state.watchedFolders.length === 0 ? (
              <div className="blank-slate blank-slate-compact">
                <p className="blank-title">No watched folders</p>
                <p className="blank-copy">Add one to watch new arrivals land in the ledger.</p>
              </div>
            ) : (
              <ul className="route-list">
                {state.watchedFolders.map((folder) => (
                  <li className="route-row" key={folder.id}>
                    <div className="route-copy">
                      <strong className="route-title">{folder.name}</strong>
                      <p className="route-meta">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for scan or arrival'}
                      </p>
                      <p className="path-line">{folder.path}</p>
                    </div>
                    <button className="route-remove" onClick={() => void onRemoveWatchedFolder(folder.id)} type="button">
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

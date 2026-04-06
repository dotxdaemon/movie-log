// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Keeps one history-first workspace with embedded routes and collapsed archive details.
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

interface MovieLogWorkspaceProps {
  dropActive: boolean;
  errorMessage: string;
  logFilePath: string;
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
  onSelectHistoryEntry(entryId: string): void;
  scanInProgress: boolean;
  searchQuery: string;
  selectedHistoryEntryId: string | null;
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

  return [...manualEntries, ...historyByPath.values()].sort((left, right) => left.watchedAt.localeCompare(right.watchedAt));
}

function createLedgerSummary(
  historyCount: number,
  filteredHistory: WatchEntry[],
  searchQuery: string,
  scanInProgress: boolean,
  watchedFolderCount: number
): string {
  if (searchQuery) {
    return `${formatCount(filteredHistory.length, 'entry', 'entries')} shown from ${formatCount(historyCount, 'entry', 'entries')}.`;
  }

  if (scanInProgress) {
    return `Scanning ${formatCount(watchedFolderCount, 'route')} now.`;
  }

  if (historyCount === 0) {
    return 'No arrivals logged yet.';
  }

  if (watchedFolderCount === 0) {
    return `${formatCount(historyCount, 'entry', 'entries')} recorded.`;
  }

  return `${formatCount(historyCount, 'entry', 'entries')} recorded across ${formatCount(watchedFolderCount, 'route')}.`;
}

function createInspectorSummary(activeEntry: WatchEntry | null, itemCount: number): string {
  if (!activeEntry) {
    return 'No arrival selected';
  }

  return `${formatCount(itemCount, 'item')} linked to this arrival.`;
}

export function MovieLogWorkspace({
  dropActive,
  errorMessage,
  logFilePath,
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
  onSelectHistoryEntry,
  scanInProgress,
  searchQuery,
  selectedHistoryEntryId,
  state
}: MovieLogWorkspaceProps) {
  const history = collapseHistory(state.history);
  const filteredHistory = history.filter((entry) => matchesSearch(entry, searchQuery));
  const activeEntry = filteredHistory.find((entry) => entry.id === selectedHistoryEntryId) ?? filteredHistory[0] ?? null;
  const selectedLibraryItems = activeEntry ? state.libraryItems.filter((item) => item.sourcePath === activeEntry.sourcePath) : [];
  const ledgerSummary = createLedgerSummary(history.length, filteredHistory, searchQuery, scanInProgress, state.watchedFolders.length);
  const inspectorSummary = createInspectorSummary(activeEntry, selectedLibraryItems.length);
  const watchedFolderSummary =
    state.watchedFolders.length === 0 ? 'None active' : `${formatCount(state.watchedFolders.length, 'folder')} active`;
  const statusBanner = errorMessage ? (
    <section className="status-banner" role="alert">
      {errorMessage}
    </section>
  ) : null;

  const archivePanel =
    !activeEntry ? (
      <div className="blank-slate blank-slate-compact">
        <p className="blank-title">No arrival selected</p>
        <p className="blank-copy">Select one arrival to inspect its archive details.</p>
      </div>
    ) : (
      <FolderSnapshotPanel
        compact
        items={selectedLibraryItems}
        onCopyPath={onCopyPath}
        onOpenInFinder={onOpenInFinder}
        onOpenItem={onOpenItem}
        timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
      />
    );

  const pathsPanel = activeEntry ? (
    <details className="paths-disclosure">
      <summary className="paths-summary">Paths</summary>
      <div className="paths-grid">
        <section className="paths-entry">
          <p className="section-label">Note Path</p>
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

        <section className="paths-entry">
          <p className="section-label">Store Path</p>
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
      </div>
    </details>
  ) : null;

  return (
    <AppShell
      workspaceStage={
        <div className="workspace-stack">
          <section className="history-panel">
            <header className="workspace-head">
              <div className="title-mark">
                <h2 className="workspace-title">Arrivals</h2>
                <p className="workspace-status">{ledgerSummary}</p>
              </div>

              <label className="workspace-search">
                <span className="section-label">Search</span>
                <input onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search ledger" type="search" value={searchQuery} />
              </label>
            </header>

            {statusBanner}

            <section
              className={dropActive ? 'history-dropzone history-dropzone-active' : 'history-dropzone'}
              onDragEnter={() => onDropActiveChange(true)}
              onDragLeave={() => onDropActiveChange(false)}
              onDragOver={(event) => {
                event.preventDefault();
                onDropActiveChange(true);
              }}
              onDrop={onDrop}
            >
              <div className="history-layout">
                <section className="history-panel-body">
                  <div className="ledger-head">
                    <p className="ledger-note">{searchQuery ? 'Filtered arrivals.' : 'Arrival history.'}</p>
                    <p className="ledger-count">{formatCount(filteredHistory.length, 'entry', 'entries')}</p>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div className="blank-slate blank-slate-records">
                      <p className="blank-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
                      {!searchQuery ? <p className="blank-copy">New arrivals will appear here.</p> : null}
                    </div>
                  ) : (
                    <ol className="records-list">
                      {filteredHistory.map((entry) => (
                        <li
                          className={activeEntry?.id === entry.id ? 'record-row record-row-active' : 'record-row'}
                          key={entry.id}
                          onClick={() => onSelectHistoryEntry(entry.id)}
                        >
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

                <aside className="routes-block">
                  <div className="routes-body">
                    <div className="routes-head">
                      <p className="section-label">Routes</p>
                      <p className="signal-note">{watchedFolderSummary}</p>
                    </div>

                    <div className="routes-actions">
                      <button className="signal-button signal-button-primary" onClick={() => void onAddWatchedFolders()} type="button">
                        Add Folder
                      </button>
                      <button
                        className="signal-button"
                        disabled={state.watchedFolders.length === 0 || scanInProgress}
                        onClick={() => void onScanNow()}
                        type="button"
                      >
                        {scanInProgress ? 'Scanning...' : 'Scan'}
                      </button>
                    </div>

                    <section className="routes-list">
                      {state.watchedFolders.length === 0 ? (
                        <div className="blank-slate blank-slate-compact">
                          <p className="blank-title">No routes yet</p>
                          <p className="blank-copy">Add one folder to start the ledger.</p>
                        </div>
                      ) : (
                        <ul className="signal-route-list">
                          {state.watchedFolders.map((folder) => (
                            <li className="signal-route" key={folder.id}>
                              <div className="signal-route-copy">
                                <strong className="route-title">{folder.name}</strong>
                                <p className="route-meta">{`Added ${timestampFormatter.format(new Date(folder.addedAt))}`}</p>
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
                </aside>
              </div>
              <section className="archive-block">
                <div className="archive-head">
                  <p className="section-label">Archive</p>
                  <h3 className="archive-title">{activeEntry ? activeEntry.title : 'No arrival selected'}</h3>
                  <p className="details-copy">{inspectorSummary}</p>
                </div>
                <div className="archive-body">{archivePanel}</div>
                {pathsPanel}
              </section>
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
  const [logFilePath, setLogFilePath] = useState('');
  const [noteFilePath, setNoteFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [scanInProgress, setScanInProgress] = useState(false);

  useEffect(() => {
    let isMounted = true;
    document.documentElement.dataset.movieLogCaptureReady = 'false';

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
      logFilePath={logFilePath}
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
      onSelectHistoryEntry={setSelectedHistoryEntryId}
      scanInProgress={scanInProgress}
      searchQuery={searchQuery}
      selectedHistoryEntryId={selectedHistoryEntryId}
      state={state}
    />
  );
}

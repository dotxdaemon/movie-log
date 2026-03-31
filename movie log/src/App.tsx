// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Keeps one distorted ledger surface with embedded route controls and an overlaid archive echo.
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

type InspectorTab = 'contents' | 'note' | 'store';

const inspectorTabs = [
  { id: 'contents', label: 'Contents', title: 'Contents' },
  { id: 'note', label: 'Note', title: 'Field Note' },
  { id: 'store', label: 'Store', title: 'Store Path' }
] as const;

interface MovieLogWorkspaceProps {
  activeInspectorTab: InspectorTab;
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
  onSelectInspectorTab(tab: InspectorTab): void;
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

function createInspectorSummary(activeInspectorTab: InspectorTab, state: MovieLogState): string {
  if (activeInspectorTab === 'contents') {
    return `${formatCount(state.libraryItems.length, 'item')} held.`;
  }

  if (activeInspectorTab === 'note') {
    return 'Local note.';
  }

  return 'JSON store path.';
}

export function MovieLogWorkspace({
  activeInspectorTab,
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
  onSelectInspectorTab,
  scanInProgress,
  searchQuery,
  state
}: MovieLogWorkspaceProps) {
  const history = collapseHistory(state.history);
  const filteredHistory = history.filter((entry) => matchesSearch(entry, searchQuery));
  const ledgerSummary = createLedgerSummary(history.length, filteredHistory, searchQuery, scanInProgress, state.watchedFolders.length);
  const inspectorSummary = createInspectorSummary(activeInspectorTab, state);
  const activeInspector = inspectorTabs.find((tab) => tab.id === activeInspectorTab) ?? inspectorTabs[0];
  const watchedFolderSummary =
    state.watchedFolders.length === 0 ? 'None active' : `${formatCount(state.watchedFolders.length, 'folder')} active`;
  const statusBanner = errorMessage ? (
    <section className="status-banner" role="alert">
      {errorMessage}
    </section>
  ) : null;

  const archivePanel =
    activeInspectorTab === 'contents' ? (
      <FolderSnapshotPanel
        compact
        items={state.libraryItems}
        onCopyPath={onCopyPath}
        onOpenInFinder={onOpenInFinder}
        onOpenItem={onOpenItem}
        timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
      />
    ) : activeInspectorTab === 'note' ? (
      <section className="reference-panel">
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
    ) : (
      <section className="reference-panel">
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
    );

  return (
    <AppShell
      archiveStage={
        <div className="poster-figure">
          <div aria-hidden="true" className="figure-headpiece">
            <span className="head-horn head-horn-left" />
            <span className="head-horn head-horn-right" />
            <span className="head-glow" />
          </div>
          <div aria-hidden="true" className="figure-sleeve-left" />
          <div aria-hidden="true" className="figure-sleeve-right" />
          <div aria-hidden="true" className="figure-waist" />

          <section className="figure-torso">
            <header className="torso-head">
              <div className="title-mark">
                <p className="section-label">Movie Log</p>
                <h2 className="figure-title">Arrivals</h2>
              </div>

              <div className="status-mark">
                <p className="section-label">Ledger</p>
                <p className="workspace-status">{ledgerSummary}</p>
              </div>

              <label className="torso-search">
                <span className="command-label">Search</span>
                <input onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search ledger" type="search" value={searchQuery} />
              </label>
            </header>

            {statusBanner}

            <section
              className={dropActive ? 'torso-ledger torso-ledger-active' : 'torso-ledger'}
              onDragEnter={() => onDropActiveChange(true)}
              onDragLeave={() => onDropActiveChange(false)}
              onDragOver={(event) => {
                event.preventDefault();
                onDropActiveChange(true);
              }}
              onDrop={onDrop}
            >
              <div className="ledger-head">
                <div className="ledger-copy">
                  <p className="section-label">History</p>
                  <p className="ledger-note">{searchQuery ? 'Filtered arrivals.' : 'Latest arrivals.'}</p>
                </div>
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
          </section>

          <aside className="archive-satchel">
            <div aria-hidden="true" className="satchel-strap" />
            <div className="satchel-head">
              <p className="section-label">Archive</p>
              <h3 className="archive-title">{activeInspector.title}</h3>
              <p className="details-copy">{inspectorSummary}</p>
            </div>
            <div className="satchel-tabs" aria-label="Archive" role="tablist">
              {inspectorTabs.map((tab) => (
                <button
                  aria-label={tab.title}
                  aria-selected={activeInspectorTab === tab.id}
                  className={activeInspectorTab === tab.id ? 'satchel-tab satchel-tab-active' : 'satchel-tab'}
                  key={tab.id}
                  onClick={() => onSelectInspectorTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="satchel-body">{archivePanel}</div>
          </aside>
        </div>
      }
      statusSpine={
        <div className="talisman-body">
          <div aria-hidden="true" className="talisman-strap" />
          <div className="talisman-head">
            <div aria-hidden="true" className="signal-mark" />
            <p className="section-label">Routes</p>
            <p className="signal-note">{watchedFolderSummary}</p>
          </div>

          <div className="talisman-actions">
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

          <section className="talisman-list">
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
                      <p className="route-meta">
                        {`Added ${timestampFormatter.format(new Date(folder.addedAt))}`}
                      </p>
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
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('contents');
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [logFilePath, setLogFilePath] = useState('');
  const [noteFilePath, setNoteFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
      activeInspectorTab={activeInspectorTab}
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
      onSelectInspectorTab={setActiveInspectorTab}
      scanInProgress={scanInProgress}
      searchQuery={searchQuery}
      state={state}
    />
  );
}

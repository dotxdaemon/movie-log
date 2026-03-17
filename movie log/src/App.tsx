// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows recent history, watched-folder settings, and local file actions for logged entries.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { AppShell } from './app-shell';
import { FolderSnapshotPanel } from './folder-snapshot-panel';
import type { MovieLogState, WatchEntry } from '../shared/types';

const emptyState: MovieLogState = {
  history: [],
  libraryItems: [],
  watchedFolders: []
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

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

export default function App() {
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

  const filteredHistory = state.history.filter((entry) => matchesSearch(entry, searchQuery));
  const historySummary = searchQuery
    ? `Showing ${formatCount(filteredHistory.length, 'entry', 'entries')} of ${formatCount(
        state.history.length,
        'entry',
        'entries'
      )}.`
    : state.history.length === 0
      ? 'No recorded arrivals yet.'
      : `${formatCount(state.history.length, 'entry', 'entries')} recorded.`;
  const watchedFolderSummary =
    state.watchedFolders.length === 0
      ? 'No watched folders yet.'
      : `${formatCount(state.watchedFolders.length, 'folder')} active. Use Scan Now for catch-up.`;

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
      const loggedEntries = await window.movieLog.logPaths(paths);

      if (loggedEntries.length === 0) {
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
    <AppShell
      commandBar={
        <div className="command-bar">
          <label className="search-field">
            <span className="visually-hidden">Search history</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title or path"
              type="search"
              value={searchQuery}
            />
          </label>
          <button className="panel-button" onClick={() => void handleAddWatchedFolders()} type="button">
            Add Folder
          </button>
          <button
            className="ghost-button"
            disabled={state.watchedFolders.length === 0 || scanInProgress}
            onClick={() => void handleScanNow()}
            type="button"
          >
            {scanInProgress ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      }
      historyLedger={
        <section className="history-ledger">
          <div className="ledger-header">
            <div>
              <h2>History</h2>
              <p className="ledger-note">{historySummary}</p>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="blank-slate">
              <p className="blank-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
              <p className="blank-copy">
                {searchQuery
                  ? 'Try a different title or path search.'
                  : 'Drop a media file or folder, or add a watched folder to start logging arrivals.'}
              </p>
            </div>
          ) : (
            <ol className="ledger-list">
              {filteredHistory.map((entry) => (
                <li className="ledger-row" key={entry.id}>
                  <div className="ledger-row-top">
                    <strong className="ledger-title">{entry.title}</strong>
                    <div className="row-actions">
                      <button className="ghost-button" onClick={() => void handleCopyPath(entry.sourcePath)} type="button">
                        Copy Path
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => void handleOpenInFinder(entry.sourcePath)}
                        type="button"
                      >
                        Show in Finder
                      </button>
                      <button
                        className="ghost-button"
                        disabled={entry.sourceKind !== 'file'}
                        onClick={() => void handleOpenItem(entry.sourcePath)}
                        type="button"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                  <p className="ledger-row-meta">
                    {timestampFormatter.format(new Date(entry.watchedAt))} • {formatSource(entry.source)} •{' '}
                    {formatEntryType(entry.sourceKind)}
                  </p>
                  <p className="path-line">{entry.sourcePath}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      }
      intakeBar={
        <section
          className={dropActive ? 'intake-bar intake-bar-active' : 'intake-bar'}
          onDragEnter={() => setDropActive(true)}
          onDragLeave={() => setDropActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDrop={handleDrop}
        >
          <p className="intake-label">Manual Drop</p>
          <div className="intake-copy">
            <strong>Drop a media file or folder</strong>
            <span>One drop becomes one history entry.</span>
          </div>
        </section>
      }
      note="local arrivals ledger"
      sideRail={
        <aside className="side-rail">
          <section className="rail-group">
            <div className="rail-heading">
              <div>
                <h2>Watched folders</h2>
                <p className="rail-note">{watchedFolderSummary}</p>
              </div>
            </div>

            {state.watchedFolders.length === 0 ? (
              <div className="blank-slate blank-slate-compact">
                <p className="blank-title">No watched folders</p>
                <p className="blank-copy">
                  Add one or more folders and Movie Log will watch for new top-level folders or supported media files.
                </p>
              </div>
            ) : (
              <ul className="watch-list">
                {state.watchedFolders.map((folder) => (
                  <li className="watch-row" key={folder.id}>
                    <div className="watch-copy">
                      <strong className="watch-name">{folder.name}</strong>
                      <p className="rail-meta">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for first catch-up or arrival'}
                      </p>
                      <p className="path-line">{folder.path}</p>
                    </div>
                    <button
                      className="ghost-button"
                      onClick={() => void handleRemoveWatchedFolder(folder.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="rail-detail">
            <summary className="rail-detail-summary">
              <span>Current top-level contents</span>
              <span>{formatCount(state.libraryItems.length, 'item')}</span>
            </summary>
            <div className="rail-detail-body">
              <FolderSnapshotPanel
                compact
                items={state.libraryItems}
                onCopyPath={handleCopyPath}
                onOpenInFinder={handleOpenInFinder}
                onOpenItem={handleOpenItem}
                timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
              />
            </div>
          </details>

          <details className="rail-detail">
            <summary className="rail-detail-summary">
              <span>Stored on this Mac</span>
              <span>Paths and note</span>
            </summary>
            <div className="rail-detail-body">
              <div className="data-block">
                <p className="data-label">Readable Note</p>
                <p className="path-line">{noteFilePath}</p>
                <div className="row-actions">
                  <button
                    className="ghost-button"
                    disabled={!noteFilePath}
                    onClick={() => void handleOpenItem(noteFilePath)}
                    type="button"
                  >
                    Open Note
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!noteFilePath}
                    onClick={() => void handleCopyPath(noteFilePath)}
                    type="button"
                  >
                    Copy Note Path
                  </button>
                </div>
              </div>

              <div className="data-block">
                <p className="data-label">App Store</p>
                <p className="path-line">{logFilePath}</p>
              </div>
            </div>
          </details>
        </aside>
      }
      statusBanner={
        errorMessage ? (
          <section className="status-banner" role="alert">
            {errorMessage}
          </section>
        ) : undefined
      }
      title="Movie Log"
    />
  );
}

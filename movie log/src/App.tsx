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
    ? `${formatCount(filteredHistory.length, 'entry', 'entries')} of ${formatCount(state.history.length, 'entry', 'entries')} shown`
    : state.history.length === 0
      ? 'Nothing recorded'
      : `${formatCount(state.history.length, 'entry', 'entries')} recorded`;
  const watchedFolderSummary =
    state.watchedFolders.length === 0
      ? 'None'
      : `${formatCount(state.watchedFolders.length, 'folder')} active`;

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
      contentHeader={
        <header className="records-header">
          <div className="records-copy">
            <h2>History</h2>
            <p className="records-note">{historySummary}</p>
          </div>
          <label className="search-field">
            <span className="visually-hidden">Search history</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title or path"
              type="search"
              value={searchQuery}
            />
          </label>
        </header>
      }
      intakeBar={
        <section
          className={dropActive ? 'drop-inline drop-inline-active' : 'drop-inline'}
          onDragEnter={() => setDropActive(true)}
          onDragLeave={() => setDropActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDrop={handleDrop}
        >
          <span className="drop-tag">Drop</span>
          <span className="drop-text">Media file or folder</span>
        </section>
      }
      note=""
      recordsPanel={
        <section className="records-panel">
          {filteredHistory.length === 0 ? (
            <div className="blank-slate blank-slate-records">
              <p className="blank-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
              {!searchQuery ? <p className="blank-copy">Drop a file or add a watched folder.</p> : null}
            </div>
          ) : (
            <ol className="record-list">
              {filteredHistory.map((entry) => (
                <li className="record-row" key={entry.id}>
                  <div className="record-head">
                    <div className="record-main">
                      <strong className="record-title">{entry.title}</strong>
                      <p className="path-line">{entry.sourcePath}</p>
                    </div>
                    <div className="inline-actions">
                      <button className="text-button" onClick={() => void handleCopyPath(entry.sourcePath)} type="button">
                        Copy Path
                      </button>
                      <button
                        className="text-button"
                        onClick={() => void handleOpenInFinder(entry.sourcePath)}
                        type="button"
                      >
                        Show in Finder
                      </button>
                      <button
                        className="text-button"
                        disabled={entry.sourceKind !== 'file'}
                        onClick={() => void handleOpenItem(entry.sourcePath)}
                        type="button"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                  <p className="record-details">
                    {timestampFormatter.format(new Date(entry.watchedAt))} • {formatSource(entry.source)} •{' '}
                    {formatEntryType(entry.sourceKind)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      }
      utilityPanel={
        <div className="rail-stack">
          <section className="rail-panel rail-actions">
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
          </section>

          <section className="rail-panel">
            <div className="panel-heading">
              <div>
                <h2>Watched folders</h2>
                <p className="panel-note">{watchedFolderSummary}</p>
              </div>
            </div>

            {state.watchedFolders.length === 0 ? (
              <div className="blank-slate blank-slate-compact">
                <p className="blank-title">No watched folders</p>
              </div>
            ) : (
              <ul className="secondary-list">
                {state.watchedFolders.map((folder) => (
                  <li className="secondary-row" key={folder.id}>
                    <div className="secondary-copy">
                      <strong className="secondary-title">{folder.name}</strong>
                      <p className="secondary-meta">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for scan or arrival'}
                      </p>
                      <p className="path-line">{folder.path}</p>
                    </div>
                    <button
                      className="text-button"
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

          <details className="rail-disclosure">
            <summary className="disclosure-summary">
              <span>Reference</span>
              <span>{formatCount(state.libraryItems.length, 'item')}</span>
            </summary>
            <div className="disclosure-body">
              <div className="reference-block">
                <p className="reference-label">Current contents</p>
                <FolderSnapshotPanel
                  compact
                  items={state.libraryItems}
                  onCopyPath={handleCopyPath}
                  onOpenInFinder={handleOpenInFinder}
                  onOpenItem={handleOpenItem}
                  timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
                />
              </div>

              <div className="reference-block">
                <p className="reference-label">Readable note</p>
                <p className="path-line">{noteFilePath}</p>
                <div className="inline-actions">
                  <button
                    className="text-button"
                    disabled={!noteFilePath}
                    onClick={() => void handleOpenItem(noteFilePath)}
                    type="button"
                  >
                    Open Note
                  </button>
                  <button
                    className="text-button"
                    disabled={!noteFilePath}
                    onClick={() => void handleCopyPath(noteFilePath)}
                    type="button"
                  >
                    Copy Note Path
                  </button>
                </div>
              </div>

              <div className="reference-block">
                <p className="reference-label">App store</p>
                <p className="path-line">{logFilePath}</p>
              </div>
            </div>
          </details>
        </div>
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

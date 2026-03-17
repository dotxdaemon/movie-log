// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows recent history, watched-folder settings, and local file actions for logged entries.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
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
      ? 'Nothing logged yet.'
      : `${formatCount(state.history.length, 'entry', 'entries')} kept locally.`;
  const watchedFolderSummary =
    state.watchedFolders.length === 0
      ? 'Add a folder to log arrivals automatically.'
      : `${formatCount(state.watchedFolders.length, 'folder')} watching for arrivals. Use Scan Now for catch-up.`;

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
    <main className="app-shell">
      <header className="workspace-header">
        <div className="workspace-title">
          <p className="app-name">Movie Log</p>
          <h1>Local history for what lands in your library.</h1>
          <p className="workspace-summary">
            Manual drops and watched-folder arrivals stay on this Mac and remain easy to find.
          </p>
        </div>
        <div className="command-strip">
          <label className="search-field search-field-compact">
            <span className="search-label">Search</span>
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
      </header>

      {errorMessage ? (
        <section className="message-strip" role="alert">
          {errorMessage}
        </section>
      ) : null}

      <section className="workspace-grid">
        <div className="primary-column">
          <section
            className={dropActive ? 'drop-strip drop-strip-active' : 'drop-strip'}
            onDragEnter={() => setDropActive(true)}
            onDragLeave={() => setDropActive(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDrop={handleDrop}
          >
            <div>
              <p className="section-label">Manual Drop</p>
              <h2>Drop a media file or folder</h2>
            </div>
            <p className="section-note">
              Every supported file or folder dropped here becomes one history entry.
            </p>
          </section>

          <section className="surface section-card">
            <div className="section-header">
              <div>
                <p className="section-label">Activity</p>
                <h2>Recent history</h2>
                <p className="section-note">{historySummary}</p>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
                <p className="empty-copy">
                  {searchQuery
                    ? 'Try a different title or path search.'
                    : 'Drop a media file or folder, or add a watched folder to start logging arrivals.'}
                </p>
              </div>
            ) : (
              <ol className="history-list">
                {filteredHistory.map((entry) => (
                  <li className="history-card" key={entry.id}>
                    <div className="history-topline">
                      <strong>{entry.title}</strong>
                    </div>
                    <p className="history-meta">
                      {timestampFormatter.format(new Date(entry.watchedAt))} • {formatSource(entry.source)} •{' '}
                      {formatEntryType(entry.sourceKind)}
                    </p>
                    <p className="meta-path">{entry.sourcePath}</p>
                    <div className="action-row">
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
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="secondary-column">
          <section className="surface section-card">
            <div className="section-header">
              <div>
                <p className="section-label">Watched Folders</p>
                <h2>Automatic arrivals</h2>
                <p className="section-note">{watchedFolderSummary}</p>
              </div>
            </div>

            {state.watchedFolders.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">No watched folders yet</p>
                <p className="empty-copy">
                  Add one or more folders and Movie Log will watch for new top-level folders or supported media files.
                </p>
              </div>
            ) : (
              <ul className="stack-list">
                {state.watchedFolders.map((folder) => (
                  <li className="list-card" key={folder.id}>
                    <div>
                      <strong>{folder.name}</strong>
                      <p className="history-meta">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for first catch-up or arrival'}
                      </p>
                      <p className="meta-path">{folder.path}</p>
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

          <details className="detail-block">
            <summary className="detail-summary">
              <span className="detail-label-group">
                <span className="section-label section-label-inline">Library</span>
                <strong>Current top-level contents</strong>
              </span>
              <span className="detail-count">{formatCount(state.libraryItems.length, 'item')}</span>
            </summary>
            <div className="detail-content">
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

          <details className="detail-block">
            <summary className="detail-summary">
              <span className="detail-label-group">
                <span className="section-label section-label-inline">Local Data</span>
                <strong>Stored on this Mac</strong>
              </span>
              <span className="detail-count">Paths and note</span>
            </summary>
            <div className="detail-content">
              <div className="data-row">
                <p className="section-label">Readable Note</p>
                <p className="meta-path">{noteFilePath}</p>
                <div className="data-actions">
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

              <div className="data-row">
                <p className="section-label">App Store</p>
                <p className="meta-path">{logFilePath}</p>
              </div>
            </div>
          </details>
        </aside>
      </section>
    </main>
  );
}

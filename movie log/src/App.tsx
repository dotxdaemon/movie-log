// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows recent history, watched-folder settings, and local file actions for logged entries.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import { FolderSnapshotPanel } from './folder-snapshot-panel';
import type { MovieLogState, WatchEntry } from '../shared/types';

type Screen = 'history' | 'settings';

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
  const [activeScreen, setActiveScreen] = useState<Screen>('history');
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

  const handleAddWatchedFolders = async () => {
    setErrorMessage('');

    try {
      await window.movieLog.addWatchedFolders();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleClearHistory = async () => {
    const confirmed = window.confirm('Clear all history entries? Watched folders will stay in place.');

    if (!confirmed) {
      return;
    }

    setErrorMessage('');

    try {
      await window.movieLog.clearHistory();
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
      <section className="hero">
        <div>
          <p className="eyebrow">Movie Log</p>
          <h1>Keep a local history of what you just added.</h1>
          <p className="summary">
            Movie Log is a small macOS desktop utility that logs media files and folders you drop in by hand or add
            through watched folders. It stays local, keeps the history newest first, and does not try to be a media
            server.
          </p>
        </div>
        <div className="stat-grid" aria-label="Current totals">
          <article className="stat-card">
            <span className="stat-value">{state.history.length}</span>
            <span className="stat-label">History Entries</span>
          </article>
          <article className="stat-card">
            <span className="stat-value">{state.watchedFolders.length}</span>
            <span className="stat-label">Watched Folders</span>
          </article>
          <article className="stat-card">
            <span className="stat-value">{filteredHistory.length}</span>
            <span className="stat-label">Visible Results</span>
          </article>
        </div>
      </section>

      <nav className="tab-row" aria-label="Screens">
        <button
          className={activeScreen === 'history' ? 'tab-button tab-button-active' : 'tab-button'}
          onClick={() => setActiveScreen('history')}
          type="button"
        >
          History
        </button>
        <button
          className={activeScreen === 'settings' ? 'tab-button tab-button-active' : 'tab-button'}
          onClick={() => setActiveScreen('settings')}
          type="button"
        >
          Settings
        </button>
      </nav>

      {errorMessage ? (
        <section className="message-strip" role="alert">
          {errorMessage}
        </section>
      ) : null}

      {activeScreen === 'history' ? (
        <>
          <section
            className={dropActive ? 'drop-zone drop-zone-active' : 'drop-zone'}
            onDragEnter={() => setDropActive(true)}
            onDragLeave={() => setDropActive(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDropActive(true);
            }}
            onDrop={handleDrop}
          >
            <p className="drop-kicker">Manual Drop</p>
            <h2>Drop a media file or folder</h2>
            <p className="drop-copy">
              Every supported file or folder dropped here becomes one history entry. Files use a conservative
              media-file allowlist, and folders keep their folder name as the title.
            </p>
          </section>

          <section className="panel panel-history">
            <div className="panel-header panel-header-stacked">
              <div>
                <p className="panel-kicker">Recent History</p>
                <h2>Newest first</h2>
              </div>
              <div className="toolbar-row">
                <label className="search-field">
                  <span className="search-label">Search</span>
                  <input
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search title or path"
                    type="search"
                    value={searchQuery}
                  />
                </label>
                <button className="ghost-button" onClick={() => void handleClearHistory()} type="button">
                  Clear History
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="empty-card">
                <p className="empty-title">{searchQuery ? 'No matching history entries' : 'Nothing logged yet'}</p>
                <p className="empty-copy">
                  {searchQuery
                    ? 'Try a different title or path search.'
                    : 'Drop a media file or folder, or add a watched folder in Settings to start logging arrivals.'}
                </p>
              </div>
            ) : (
              <ol className="history-list">
                {filteredHistory.map((entry) => (
                  <li className="history-card" key={entry.id}>
                    <div className="history-topline">
                      <strong>{entry.title}</strong>
                      <div className="badge-row">
                        <span className="history-badge">{formatSource(entry.source)}</span>
                        <span className="history-badge history-badge-secondary">{formatEntryType(entry.sourceKind)}</span>
                      </div>
                    </div>
                    <p className="history-time">{timestampFormatter.format(new Date(entry.watchedAt))}</p>
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
        </>
      ) : (
        <section className="content-grid content-grid-settings">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Watched Folders</p>
                <h2>Automatic logging</h2>
              </div>
              <div className="button-row">
                <button className="panel-button" onClick={() => void handleAddWatchedFolders()} type="button">
                  Add Folders
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
            </div>
            <p className="summary">
              The first scan logs everything already in a watched folder. Later scans add only top-level arrivals, and
              renames or moves inside the same watched folder do not log again.
            </p>

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
                      <p className="meta-path">{folder.path}</p>
                      <p className="history-time">
                        {folder.lastScannedAt
                          ? `Last scanned ${timestampFormatter.format(new Date(folder.lastScannedAt))}`
                          : 'Waiting for first scan'}
                      </p>
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
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Local Data</p>
                <h2>Stored on this Mac</h2>
              </div>
            </div>
            <p className="summary">
              Movie Log keeps its history and watched folders in a local JSON file. Nothing is uploaded or synced.
            </p>
            <p className="panel-kicker">Readable Note</p>
            <p className="meta-path">{noteFilePath}</p>
            <div className="button-row">
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
            <p className="panel-kicker">App Store</p>
            <p className="meta-path">{logFilePath}</p>
          </article>

          <FolderSnapshotPanel
            items={state.libraryItems}
            onCopyPath={handleCopyPath}
            onOpenInFinder={handleOpenInFinder}
            onOpenItem={handleOpenItem}
            timestampLabel={(isoTime) => timestampFormatter.format(new Date(isoTime))}
          />
        </section>
      )}
    </main>
  );
}

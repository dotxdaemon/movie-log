// ABOUTME: Renders the desktop movie log interface and responds to folder and drop events.
// ABOUTME: Shows watched folders, a manual drop target, and the recent watch history list.
import { startTransition, useEffect, useState, type DragEvent } from 'react';
import type { MovieLogState } from '../shared/types';

const emptyState: MovieLogState = {
  history: [],
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

export default function App() {
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [dropActive, setDropActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      const nextState = await window.movieLog.getState();
      if (isMounted) {
        updateState(nextState, setState);
      }
    };

    void loadState();

    const unsubscribe = window.movieLog.subscribe((nextState) => {
      updateState(nextState, setState);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handlePickWatchedFolder = async () => {
    setErrorMessage('');

    try {
      await window.movieLog.pickWatchedFolder();
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

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    setErrorMessage('');

    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.movieLog.pathForFile(file))
      .filter((itemPath) => itemPath.length > 0);

    if (paths.length === 0) {
      setErrorMessage('Drop a Finder file or folder so the app can record its full path.');
      return;
    }

    try {
      await window.movieLog.logPaths(paths);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const historyItems = state.history.slice(0, 20);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Local Desktop Watch Log</p>
          <h1>Drop it in. Keep the record. Move on.</h1>
          <p className="summary">
            Movie Log keeps a recent watch history from Finder drops and watched inbox folders. It stores only the
            title, watched time, and original path on this machine.
          </p>
        </div>
        <div className="stat-grid" aria-label="Current totals">
          <article className="stat-card">
            <span className="stat-value">{state.history.length}</span>
            <span className="stat-label">Logged Items</span>
          </article>
          <article className="stat-card">
            <span className="stat-value">{state.watchedFolders.length}</span>
            <span className="stat-label">Watched Folders</span>
          </article>
        </div>
      </section>

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
        <p className="drop-kicker">Manual Log</p>
        <h2>Drop a file or folder from Finder</h2>
        <p className="drop-copy">
          Each top-level drop becomes one history entry. The app leaves the original item alone and records its name,
          path, and timestamp.
        </p>
      </section>

      {errorMessage ? (
        <section className="message-strip" role="alert">
          {errorMessage}
        </section>
      ) : null}

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Folder Watchers</p>
              <h2>Watched inbox folders</h2>
            </div>
            <button className="panel-button" onClick={() => void handlePickWatchedFolder()} type="button">
              Add Watched Folder
            </button>
          </div>

          {state.watchedFolders.length === 0 ? (
            <p className="empty-copy">Add a folder to log new top-level arrivals automatically.</p>
          ) : (
            <ul className="stack-list">
              {state.watchedFolders.map((folder) => (
                <li className="list-card" key={folder.id}>
                  <div>
                    <strong>{folder.name}</strong>
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
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Recent History</p>
              <h2>What you watched recently</h2>
            </div>
          </div>

          {historyItems.length === 0 ? (
            <p className="empty-copy">Nothing logged yet. Drop a title or add a watched folder to start the record.</p>
          ) : (
            <ol className="history-list">
              {historyItems.map((entry) => (
                <li className="history-card" key={entry.id}>
                  <div className="history-topline">
                    <strong>{entry.title}</strong>
                    <span className="history-badge">{entry.source === 'drop' ? 'Dropped' : 'Watched Folder'}</span>
                  </div>
                  <p className="history-time">{timestampFormatter.format(new Date(entry.watchedAt))}</p>
                  <p className="meta-path">{entry.sourcePath}</p>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </main>
  );
}

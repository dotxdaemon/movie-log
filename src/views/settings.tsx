// ABOUTME: Renders watched-folder sources, current index contents, and durable data files as studies.
// ABOUTME: Every control maps to a real folder, scan, open, or remove action on the local machine.
import { EmptyState } from '../components/states.js';
import { AccessibleTooltip } from '../components/accessible-tooltip.js';
import type { MovieLogState } from '../../shared/types.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

interface SettingsViewProps {
  dataFilePath: string;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onOpenItem(path: string): Promise<void>;
  onRemoveWatchedFolder(id: string): Promise<void>;
  onScanNow(): Promise<void>;
  scanInProgress: boolean;
  state: MovieLogState;
}

export function SettingsView(props: SettingsViewProps) {
  return (
    <section className="settings-view">
      <section className="settings-section">
        <header className="settings-head">
          <span className="study-index">A</span>
          <div>
            <p className="eyebrow">Sources</p>
            <h2>Watched folders</h2>
          </div>
          <button className="command-block" onClick={() => void props.onAddWatchedFolders()} type="button">
            Add folder
          </button>
        </header>
        <div className="watched-folder-list">
          {props.state.watchedFolders.length === 0 ? (
            <EmptyState
              fragment="panel"
              hint="Watched folders index arriving media automatically."
              title="No folders are being watched."
            />
          ) : (
            props.state.watchedFolders.map((folder) => (
              <article className="watched-folder-row" key={folder.id}>
                <div className="watched-folder-copy">
                  <h3>{folder.name}</h3>
                  <p>
                    <AccessibleTooltip id={`watched-folder-${folder.id}-path`} text={folder.path}>
                      <span tabIndex={0}>{folder.path}</span>
                    </AccessibleTooltip>
                  </p>
                  <small>
                    {folder.lastScannedAt
                      ? `Scanned ${dateFormatter.format(new Date(folder.lastScannedAt))}`
                      : 'Not scanned yet'}
                  </small>
                </div>
                <button
                  className="folder-remove"
                  onClick={() => void props.onRemoveWatchedFolder(folder.id)}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))
          )}
        </div>
        <button
          className="command-block"
          disabled={props.scanInProgress || props.state.watchedFolders.length === 0}
          onClick={() => void props.onScanNow()}
          type="button"
        >
          {props.scanInProgress ? 'Scanning…' : 'Scan now'}
        </button>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <span className="study-index">B</span>
          <div>
            <p className="eyebrow">Index</p>
            <h2>Current contents</h2>
          </div>
        </header>
        <div className="current-contents-list">
          {props.state.libraryItems.length === 0 ? (
            <p className="settings-empty">No current items from watched folders.</p>
          ) : (
            props.state.libraryItems.map((item) => (
              <AccessibleTooltip
                className="accessible-tooltip-fill"
                id={`current-item-${item.id}-path`}
                key={item.id}
                text={item.sourcePath}
              >
                <button
                  aria-label={`Open ${item.title} at ${item.sourcePath}`}
                  onClick={() => void props.onOpenItem(item.sourcePath)}
                  type="button"
                >
                  <span>{item.title}</span>
                  <small>{item.sourcePath}</small>
                </button>
              </AccessibleTooltip>
            ))
          )}
        </div>
      </section>

      <section className="settings-section file-register">
        <header className="settings-head">
          <span className="study-index">C</span>
          <div>
            <p className="eyebrow">Local record</p>
            <h2>Data files</h2>
          </div>
        </header>
        <button onClick={() => void props.onOpenItem(props.dataFilePath)} type="button">
          <span>Application data</span>
          <small>{props.dataFilePath}</small>
        </button>
        <button onClick={() => void props.onOpenItem(props.noteFilePath)} type="button">
          <span>Readable note</span>
          <small>{props.noteFilePath}</small>
        </button>
      </section>
    </section>
  );
}

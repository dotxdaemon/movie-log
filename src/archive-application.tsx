// ABOUTME: Renders Movie Log's diary, library, search, statistics, settings, detail, and logging surfaces.
// ABOUTME: Keeps the complete product interface testable as a pure component over persisted application state.
import type { DragEvent, FormEvent } from 'react';
import { AppShell } from './app-shell.js';
import {
  buildArchiveItems,
  filterArchiveItems,
  readArchiveStats,
  type ArchiveFilters,
  type ArchiveItem,
  type ArchiveView,
  type DiaryMode
} from './archive-model.js';
import type { WorkspaceFeedback } from './feedback.js';
import type { EntryDetails, LogEntryDetails, MovieLogState, WatchEntry } from '../shared/types.js';

interface ArchiveApplicationProps {
  activeView: ArchiveView;
  dataFilePath: string;
  diaryMode: DiaryMode;
  dropActive: boolean;
  feedback: WorkspaceFeedback | null;
  filters: ArchiveFilters;
  loading: boolean;
  logPanelOpen: boolean;
  noteFilePath: string;
  onAddWatchedFolders(): Promise<void>;
  onChooseLogPaths(): Promise<void>;
  onClearLogPaths(): void;
  onCloseLogPanel(): void;
  onCopyPath(path: string): Promise<void>;
  onCreateLog(details: LogEntryDetails): Promise<void>;
  onDiaryModeChange(mode: DiaryMode): void;
  onDrop(event: DragEvent<HTMLElement>): Promise<void> | void;
  onDropActiveChange(active: boolean): void;
  onFeedbackDismiss(): void;
  onFilterChange(filters: ArchiveFilters): void;
  onOpenInFinder(path: string): Promise<void>;
  onOpenItem(path: string): Promise<void>;
  onOpenLogPanel(): void;
  onRemoveWatchedFolder(id: string): Promise<void>;
  onScanNow(): Promise<void>;
  onSearchQueryChange(value: string): void;
  onSelectPath(path: string): void;
  onUpdateEntry(entryId: string, details: EntryDetails): Promise<void>;
  onViewChange(view: ArchiveView): void;
  pendingLogPaths: string[];
  scanInProgress: boolean;
  searchQuery: string;
  selectedPath: string | null;
  state: MovieLogState;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

const navigationItems: Array<{ index: string; label: string; view: Exclude<ArchiveView, 'detail'> }> = [
  { index: '01', label: 'Diary', view: 'diary' },
  { index: '02', label: 'Library', view: 'library' },
  { index: '03', label: 'Search', view: 'search' },
  { index: '04', label: 'Statistics', view: 'statistics' },
  { index: '05', label: 'Settings', view: 'settings' }
];

function RatingControl({ name, value }: { name: string; value: number | null }) {
  return (
    <fieldset className="rating-control">
      <legend>Rating</legend>
      <div className="rating-segments">
        {Array.from({ length: 10 }, (_item, index) => {
          const rating = (index + 1) / 2;
          return (
            <label className="rating-segment" key={rating}>
              <input defaultChecked={value === rating} name={name} type="radio" value={rating} />
              <span>{rating}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function readEntryDetails(form: HTMLFormElement): EntryDetails {
  const values = new FormData(form);
  const ratingValue = values.get('rating');
  const tags = String(values.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);

  return {
    favorite: values.get('favorite') === 'on',
    rating: ratingValue ? Number(ratingValue) : null,
    review: String(values.get('review') ?? '').trim(),
    rewatch: values.get('rewatch') === 'on',
    tags,
    viewingFormat: String(values.get('viewingFormat') ?? '').trim()
  };
}

function EntryForm({ entry, onSubmit }: { entry: WatchEntry; onSubmit(details: EntryDetails): Promise<void> }) {
  return (
    <form
      className="entry-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(readEntryDetails(event.currentTarget));
      }}
    >
      <RatingControl name="rating" value={entry.rating ?? null} />
      <label className="field-block">
        <span>Review</span>
        <textarea defaultValue={entry.review ?? ''} name="review" rows={5} />
      </label>
      <div className="field-pair">
        <label className="field-block">
          <span>Tags</span>
          <input defaultValue={(entry.tags ?? []).join(', ')} name="tags" placeholder="Drama, Noir" />
        </label>
        <label className="field-block">
          <span>Viewing format</span>
          <input defaultValue={entry.viewingFormat ?? ''} name="viewingFormat" placeholder="Cinema, Digital, 35mm" />
        </label>
      </div>
      <div className="check-row">
        <label><input defaultChecked={entry.favorite} name="favorite" type="checkbox" /> Favorite</label>
        <label><input defaultChecked={entry.rewatch} name="rewatch" type="checkbox" /> Rewatch</label>
      </div>
      <button className="primary-button" type="submit">Save entry</button>
    </form>
  );
}

function PosterPlate({ item }: { item: ArchiveItem }) {
  return (
    <div aria-hidden="true" className="poster-plate">
      <span className="poster-index">{item.year ?? '—'}</span>
      <span className="poster-monogram">{item.title.slice(0, 2).toUpperCase()}</span>
      <span className="poster-rule" />
    </div>
  );
}

function RatingDisplay({ rating }: { rating: number }) {
  return <span aria-label={`${rating} out of 5`} className="rating-display">{rating.toFixed(1)} / 5</span>;
}

function DiaryView({ diaryMode, onDiaryModeChange, onSelectPath, state }: Pick<ArchiveApplicationProps, 'diaryMode' | 'onDiaryModeChange' | 'onSelectPath' | 'state'>) {
  const history = [...state.history].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
  const latestDate = history[0] ? new Date(history[0].watchedAt) : new Date();
  const monthKey = history[0]?.watchedAt.slice(0, 7);
  const monthEntries = history.filter((entry) => entry.watchedAt.startsWith(monthKey ?? ''));
  const monthRatings = monthEntries.filter((entry) => typeof entry.rating === 'number');
  const highestRated = [...monthRatings].sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];

  if (history.length === 0) {
    return (
      <section className="blank-slate">
        <p className="eyebrow">No. 00</p>
        <h2>Your diary begins here.</h2>
        <p>Drop a film or use Log a Film to make the first entry.</p>
      </section>
    );
  }

  return (
    <section className={`diary-view diary-${diaryMode}`}>
      <header className="month-summary">
        <div><p className="eyebrow">Viewing register</p><h2>{monthFormatter.format(latestDate)}</h2></div>
        <dl><div><dt>Films watched</dt><dd>{monthEntries.length}</dd></div><div><dt>Average rating</dt><dd>{monthRatings.length === 0 ? '—' : (monthRatings.reduce((total, entry) => total + (entry.rating ?? 0), 0) / monthRatings.length).toFixed(2)}</dd></div><div><dt>Total runtime</dt><dd>—</dd></div><div><dt>Rewatches</dt><dd>{monthEntries.filter((entry) => entry.rewatch).length}</dd></div><div className="summary-wide"><dt>Highest rated</dt><dd>{highestRated?.title ?? '—'}</dd></div></dl>
      </header>
      <div aria-label="Diary layout" className="view-switcher">
        {(['timeline', 'ledger', 'grid'] as DiaryMode[]).map((mode) => (
          <button aria-pressed={diaryMode === mode} key={mode} onClick={() => onDiaryModeChange(mode)} type="button">{mode}</button>
        ))}
      </div>
      <div className="diary-list">
        {history.map((entry, index) => (
          <article className="diary-entry" key={entry.id}>
            <button className="entry-date" onClick={() => onSelectPath(entry.sourcePath)} type="button">
              <span>{String(new Date(entry.watchedAt).getDate()).padStart(2, '0')}</span>
              <small>{dateFormatter.format(new Date(entry.watchedAt))}</small>
            </button>
            <div className="entry-body">
              <div aria-hidden="true" className="entry-poster"><span>{entry.title.slice(0, 2).toUpperCase()}</span></div>
              <p className="entry-sequence">ENTRY {String(history.length - index).padStart(3, '0')}</p>
              <h3><button onClick={() => onSelectPath(entry.sourcePath)} type="button">{entry.title}</button></h3>
              <p className="entry-source">{entry.source === 'watch' ? 'Watched folder' : 'Manual log'} · {entry.viewingFormat || entry.sourceKind}</p>
              {typeof entry.rating === 'number' ? <RatingDisplay rating={entry.rating} /> : null}
              {(entry.tags ?? []).length > 0 ? <ul className="tag-list">{entry.tags?.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}
              {entry.review ? <details className="diary-review"><summary>Read review</summary><p className="diary-entry-review">{entry.review}</p><button onClick={() => onSelectPath(entry.sourcePath)} type="button">Open dossier to edit</button></details> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FilterToolbar({ filters, items, onFilterChange }: { filters: ArchiveFilters; items: ArchiveItem[]; onFilterChange(filters: ArchiveFilters): void }) {
  const decades = [...new Set(items.map((item) => item.year === null ? null : `${Math.floor(item.year / 10) * 10}s`).filter(Boolean))] as string[];
  const tags = [...new Set(items.flatMap((item) => item.tags))].sort();
  const change = (key: keyof ArchiveFilters, value: string) => onFilterChange({ ...filters, [key]: value });

  return (
    <div className="filter-toolbar">
      <label><span>Decade</span><select onChange={(event) => change('decade', event.target.value)} value={filters.decade}><option value="all">All</option>{decades.map((decade) => <option key={decade}>{decade}</option>)}</select></label>
      <label><span>Genre</span><select onChange={(event) => change('genre', event.target.value)} value={filters.genre}><option value="all">All</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <label><span>Rating</span><select onChange={(event) => change('rating', event.target.value)} value={filters.rating}><option value="all">All</option><option value="4-plus">4.0+</option></select></label>
      <label><span>Watched status</span><select onChange={(event) => change('status', event.target.value)} value={filters.status}><option value="all">All</option><option value="current">Currently indexed</option><option value="archive">Diary only</option></select></label>
      <label><span>Favorite</span><select onChange={(event) => change('favorite', event.target.value)} value={filters.favorite}><option value="all">All</option><option value="favorite">Favorite</option></select></label>
      <label><span>Rewatch</span><select onChange={(event) => change('rewatch', event.target.value)} value={filters.rewatch}><option value="all">All</option><option value="rewatched">Rewatched</option></select></label>
      <label><span>Tags</span><select onChange={(event) => change('tag', event.target.value)} value={filters.tag}><option value="all">All</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <label><span>Sort</span><select onChange={(event) => change('sort', event.target.value)} value={filters.sort}><option value="recent">Recent</option><option value="title">Title</option><option value="rating">Rating</option></select></label>
    </div>
  );
}

function LibraryView({ filters, onFilterChange, onSelectPath, state }: Pick<ArchiveApplicationProps, 'filters' | 'onFilterChange' | 'onSelectPath' | 'state'>) {
  const items = buildArchiveItems(state);
  const visibleItems = filterArchiveItems(items, filters);

  const activeFilters = (Object.entries(filters) as Array<[keyof ArchiveFilters, string]>).filter(([key, value]) => key !== 'sort' && value !== 'all');

  return (
    <section className="library-view">
      <details className="filter-drawer" open>
        <summary>Filters</summary>
        <FilterToolbar filters={filters} items={items} onFilterChange={onFilterChange} />
        <div className="mobile-filter-actions"><button onClick={() => onFilterChange({ ...filters, decade: 'all', favorite: 'all', genre: 'all', rating: 'all', rewatch: 'all', status: 'all', tag: 'all' })} type="button">Reset</button><button onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} type="button">Apply</button></div>
      </details>
      {activeFilters.length > 0 ? <div className="active-filters">{activeFilters.map(([key, value]) => <button key={key} onClick={() => onFilterChange({ ...filters, [key]: 'all' })} type="button">{key}: {value} ×</button>)}</div> : null}
      <div className="library-result-line"><span>{visibleItems.length} titles</span><span>{state.libraryItems.length} currently indexed</span></div>
      {visibleItems.length === 0 ? <div className="blank-slate"><h2>No titles match these filters.</h2><p>Adjust the archive controls to widen the selection.</p></div> : (
        <div className="movie-grid">
          {visibleItems.map((item) => (
            <button className="movie-card" key={item.sourcePath} onClick={() => onSelectPath(item.sourcePath)} type="button">
              <PosterPlate item={item} />
              <span className="movie-card-title">{item.title}</span>
              <span className="movie-card-meta">{item.viewings.length} {item.viewings.length === 1 ? 'viewing' : 'viewings'}{item.rating === null ? '' : ` · ${item.rating.toFixed(1)}`}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SearchView({ onSearchQueryChange, onSelectPath, searchQuery, state }: Pick<ArchiveApplicationProps, 'onSearchQueryChange' | 'onSelectPath' | 'searchQuery' | 'state'>) {
  const query = searchQuery.trim().toLowerCase();
  const matches = (value: string) => !query || value.toLowerCase().includes(query);
  const history = state.history.filter((entry) => matches(`${entry.title} ${entry.sourcePath} ${(entry.tags ?? []).join(' ')}`));
  const currentItems = state.libraryItems.filter((item) => matches(`${item.title} ${item.sourcePath}`));

  return (
    <section className="search-view">
      <label className="archive-search"><span>Search the complete archive</span><input autoFocus onChange={(event) => onSearchQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onSearchQueryChange(''); if (event.key === 'Enter') { const path = history[0]?.sourcePath ?? currentItems[0]?.sourcePath; if (path) onSelectPath(path); } }} placeholder="Title, path, or tag" value={searchQuery} /></label>
      {query && history.length === 0 && currentItems.length === 0 ? <div className="blank-slate"><p className="eyebrow">Search / 00</p><h2>No archive matches.</h2><p>Try a title, local path, or diary tag.</p></div> : <div className="search-groups">
        <section className="search-group"><header><h2>Diary history</h2><span>{history.length}</span></header>{history.map((entry) => <button className="search-result" key={entry.id} onClick={() => onSelectPath(entry.sourcePath)} type="button"><span>{entry.title}</span><small>{dateFormatter.format(new Date(entry.watchedAt))}</small></button>)}</section>
        <section className="search-group"><header><h2>Current library</h2><span>{currentItems.length}</span></header>{currentItems.map((item) => <button className="search-result" key={item.id} onClick={() => onSelectPath(item.sourcePath)} type="button"><span>{item.title}</span><small>{item.sourceKind}</small></button>)}</section>
      </div>}
    </section>
  );
}

function StatisticsView({ state }: Pick<ArchiveApplicationProps, 'state'>) {
  const stats = readArchiveStats(state);
  const maxMonth = Math.max(1, ...stats.months.map((month) => month.count));
  const maxRating = Math.max(1, ...stats.ratings.map((rating) => rating.count));

  return (
    <section className="statistics-view">
      <dl className="metric-strip"><div><dt>Viewings</dt><dd>{stats.totalViewings}</dd></div><div><dt>Average rating</dt><dd>{stats.averageRating?.toFixed(2) ?? '—'}</dd></div><div><dt>Favorites</dt><dd>{stats.favorites}</dd></div><div><dt>Rewatches</dt><dd>{stats.rewatches}</dd></div></dl>
      <div className="statistics-panels">
        <section className="chart-panel monthly-chart"><header><p className="eyebrow">Frequency</p><h2>Monthly viewings</h2></header>{stats.months.length === 0 ? <p className="chart-empty">No monthly activity yet.</p> : <div className="bar-chart">{stats.months.map((month) => <div className="bar-column" key={month.key}><span style={{ height: `${Math.max(8, month.count / maxMonth * 100)}%` }} /><small>{month.label}</small></div>)}</div>}</section>
        <section className="chart-panel rating-chart"><header><p className="eyebrow">Distribution</p><h2>Ratings</h2></header>{stats.ratings.length === 0 ? <p className="chart-empty">No rated entries yet.</p> : <div className="rating-bars">{stats.ratings.map((rating) => <div key={rating.value}><span>{rating.value}</span><i style={{ width: `${rating.count / maxRating * 100}%` }} /><small>{rating.count}</small></div>)}</div>}</section>
      </div>
      <section className="activity-panel"><header><p className="eyebrow">Last 12 weeks</p><h2>Viewing activity</h2></header><div className="activity-grid">{stats.activity.map((day) => <span aria-label={`${day.date}: ${day.count} viewings`} className={`activity-cell activity-level-${Math.min(3, day.count)}`} key={day.date} />)}</div></section>
      <section className="tag-frequency"><p className="eyebrow">Tag register</p>{stats.tags.map((tag) => <span key={tag.name}>{tag.name} <strong>{tag.count}</strong></span>)}</section>
    </section>
  );
}

function SettingsView(props: Pick<ArchiveApplicationProps, 'dataFilePath' | 'noteFilePath' | 'onAddWatchedFolders' | 'onOpenItem' | 'onRemoveWatchedFolder' | 'onScanNow' | 'scanInProgress' | 'state'>) {
  return (
    <section className="settings-view">
      <section className="settings-section"><header><p className="eyebrow">Sources</p><h2>Watched folders</h2><button className="secondary-button" onClick={() => void props.onAddWatchedFolders()} type="button">Add folder</button></header><div className="watched-folder-list">{props.state.watchedFolders.length === 0 ? <p>No folders are being watched.</p> : props.state.watchedFolders.map((folder) => <article key={folder.id}><div><h3>{folder.name}</h3><p>{folder.path}</p><small>{folder.lastScannedAt ? `Scanned ${dateFormatter.format(new Date(folder.lastScannedAt))}` : 'Not scanned yet'}</small></div><button onClick={() => void props.onRemoveWatchedFolder(folder.id)} type="button">Remove</button></article>)}</div><button className="text-button" disabled={props.scanInProgress || props.state.watchedFolders.length === 0} onClick={() => void props.onScanNow()} type="button">{props.scanInProgress ? 'Scanning…' : 'Scan now'}</button></section>
      <section className="settings-section"><header><p className="eyebrow">Index</p><h2>Current contents</h2></header><div className="current-contents-list">{props.state.libraryItems.map((item) => <button key={item.id} onClick={() => void props.onOpenItem(item.sourcePath)} type="button"><span>{item.title}</span><small>{item.sourcePath}</small></button>)}</div></section>
      <section className="settings-section file-register"><header><p className="eyebrow">Local record</p><h2>Data files</h2></header><button onClick={() => void props.onOpenItem(props.dataFilePath)} type="button"><span>Application data</span><small>{props.dataFilePath}</small></button><button onClick={() => void props.onOpenItem(props.noteFilePath)} type="button"><span>Readable note</span><small>{props.noteFilePath}</small></button></section>
    </section>
  );
}

function DetailView({ onCopyPath, onOpenInFinder, onOpenItem, onUpdateEntry, selectedPath, state }: Pick<ArchiveApplicationProps, 'onCopyPath' | 'onOpenInFinder' | 'onOpenItem' | 'onUpdateEntry' | 'selectedPath' | 'state'>) {
  const item = buildArchiveItems(state).find((candidate) => candidate.sourcePath === selectedPath);

  if (!item) {
    return <section className="blank-slate"><h2>This archive item is unavailable.</h2><p>Return to the library and choose another title.</p></section>;
  }

  return (
    <section className="movie-dossier">
      <div className="dossier-identity"><PosterPlate item={item} /><div><p className="eyebrow">Archive dossier</p><h2>{item.title}</h2><p>{item.year ?? 'Year unknown'} · {item.sourceKind} · {item.current ? 'Currently indexed' : 'Diary only'}</p>{item.rating === null ? null : <RatingDisplay rating={item.rating} />}<div className="dossier-actions"><button onClick={() => void onOpenItem(item.sourcePath)} type="button">Open</button><button onClick={() => void onOpenInFinder(item.sourcePath)} type="button">Show in Finder</button><button onClick={() => void onCopyPath(item.sourcePath)} type="button">Copy path</button></div></div></div>
      <section className="viewing-history"><header><p className="eyebrow">Chronology</p><h3>Viewing history</h3></header>{item.viewings.map((entry) => <article key={entry.id}><time>{dateFormatter.format(new Date(entry.watchedAt))}</time><div><strong>{entry.viewingFormat || 'Format not recorded'}</strong><span>{entry.rewatch ? 'Rewatch' : 'Viewing'}</span>{entry.review ? <p>{entry.review}</p> : null}</div>{typeof entry.rating === 'number' ? <RatingDisplay rating={entry.rating} /> : null}</article>)}</section>
      <section className="annotation-panel"><header><p className="eyebrow">Annotations</p><h3>Edit latest entry</h3></header><EntryForm entry={item.latestViewing} onSubmit={(details) => onUpdateEntry(item.latestViewing.id, details)} /></section>
    </section>
  );
}

function LogPanel({ onChooseLogPaths, onClearLogPaths, onCloseLogPanel, onCreateLog, pendingLogPaths }: Pick<ArchiveApplicationProps, 'onChooseLogPaths' | 'onClearLogPaths' | 'onCloseLogPanel' | 'onCreateLog' | 'pendingLogPaths'>) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const date = String(values.get('watchedAt') ?? '');
    void onCreateLog({ ...readEntryDetails(event.currentTarget), watchedAt: date ? new Date(`${date}T12:00:00`).toISOString() : undefined });
  }

  return (
    <div className="log-backdrop" onClick={onCloseLogPanel} role="presentation">
      <section aria-label="Log a Film" aria-modal="true" className="log-sheet" onClick={(event) => event.stopPropagation()} role="dialog">
        <header><div><p className="eyebrow">New diary entry</p><h2>Log a Film</h2></div><button aria-label="Close log panel" onClick={onCloseLogPanel} type="button">×</button></header>
        <button className="media-chooser" onClick={() => void onChooseLogPaths()} type="button"><span>Choose Media</span><small>File or folder · multiple selection supported</small></button>
        {pendingLogPaths.length > 0 ? <div className="selected-media"><header><span>Selected media</span><button onClick={onClearLogPaths} type="button">Clear</button></header>{pendingLogPaths.map((path) => <p key={path}>{path}</p>)}</div> : null}
        <form className="entry-form" onSubmit={submit}>
          <label className="field-block"><span>Viewing date</span><input defaultValue={new Date().toISOString().slice(0, 10)} name="watchedAt" type="date" /></label>
          <RatingControl name="rating" value={null} />
          <label className="field-block"><span>Review</span><textarea name="review" rows={5} /></label>
          <div className="field-pair"><label className="field-block"><span>Tags</span><input name="tags" placeholder="Drama, Noir" /></label><label className="field-block"><span>Viewing format</span><input name="viewingFormat" placeholder="Cinema, Digital, 35mm" /></label></div>
          <div className="check-row"><label><input name="favorite" type="checkbox" /> Favorite</label><label><input name="rewatch" type="checkbox" /> Rewatch</label></div>
          <button className="primary-button" disabled={pendingLogPaths.length === 0} type="submit">Create diary entry</button>
        </form>
      </section>
    </div>
  );
}

function LoadingView() {
  return <section aria-label="Loading Movie Log" className="screen-loading">{Array.from({ length: 6 }, (_item, index) => <div className="loading-row" key={index}><span /><i /></div>)}</section>;
}

function readViewTitle(view: ArchiveView): string {
  if (view === 'detail') {
    return 'Film dossier';
  }

  return navigationItems.find((item) => item.view === view)?.label ?? 'Movie Log';
}

export function ArchiveApplication(props: ArchiveApplicationProps) {
  const activeNavigationView = props.activeView === 'detail' ? 'library' : props.activeView;
  const navigation = (
    <>
      <div className="brand-mark"><span>ML</span><small>Archive / 01</small></div>
      <nav aria-label="Primary" className="primary-navigation">
        {navigationItems.map((item) => <button aria-current={activeNavigationView === item.view ? 'page' : undefined} className="nav-item" key={item.view} onClick={() => props.onViewChange(item.view)} type="button"><span>{item.index}</span>{item.label}</button>)}
      </nav>
      <button className="log-action" onClick={props.onOpenLogPanel} type="button"><span>+</span>Log a Film</button>
      <p className="rail-caption">A private register of watched things.</p>
    </>
  );
  const mobileNavigation = (
    <>
      {navigationItems.map((item) => <button aria-current={activeNavigationView === item.view ? 'page' : undefined} className="mobile-nav-item" key={item.view} onClick={() => props.onViewChange(item.view)} type="button"><span>{item.index}</span>{item.label}</button>)}
      <button aria-label="Log a Film" className="log-action mobile-log-action" onClick={props.onOpenLogPanel} type="button">+</button>
    </>
  );

  let view = <DiaryView diaryMode={props.diaryMode} onDiaryModeChange={props.onDiaryModeChange} onSelectPath={props.onSelectPath} state={props.state} />;

  if (props.loading) {
    view = <LoadingView />;
  } else if (props.activeView === 'library') {
    view = <LibraryView filters={props.filters} onFilterChange={props.onFilterChange} onSelectPath={props.onSelectPath} state={props.state} />;
  } else if (props.activeView === 'search') {
    view = <SearchView onSearchQueryChange={props.onSearchQueryChange} onSelectPath={props.onSelectPath} searchQuery={props.searchQuery} state={props.state} />;
  } else if (props.activeView === 'statistics') {
    view = <StatisticsView state={props.state} />;
  } else if (props.activeView === 'settings') {
    view = <SettingsView dataFilePath={props.dataFilePath} noteFilePath={props.noteFilePath} onAddWatchedFolders={props.onAddWatchedFolders} onOpenItem={props.onOpenItem} onRemoveWatchedFolder={props.onRemoveWatchedFolder} onScanNow={props.onScanNow} scanInProgress={props.scanInProgress} state={props.state} />;
  } else if (props.activeView === 'detail') {
    view = <DetailView onCopyPath={props.onCopyPath} onOpenInFinder={props.onOpenInFinder} onOpenItem={props.onOpenItem} onUpdateEntry={props.onUpdateEntry} selectedPath={props.selectedPath} state={props.state} />;
  }

  const stage = (
    <div className={props.dropActive ? 'archive-canvas archive-canvas-drop' : 'archive-canvas'} onDragEnter={() => props.onDropActiveChange(true)} onDragLeave={() => props.onDropActiveChange(false)} onDragOver={(event) => { event.preventDefault(); props.onDropActiveChange(true); }} onDrop={props.onDrop}>
      <header className="archive-header"><div><p className="section-index">{navigationItems.find((item) => item.view === activeNavigationView)?.index ?? '02'} / MOVIE LOG</p><h1>{readViewTitle(props.activeView)}</h1></div><p>{props.state.history.length} diary entries · {buildArchiveItems(props.state).length} titles</p></header>
      {props.feedback ? <div className={`status-banner status-${props.feedback.tone}`} role={props.feedback.tone === 'error' ? 'alert' : 'status'}><span>{props.feedback.message}</span><button onClick={props.onFeedbackDismiss} type="button">Dismiss</button></div> : null}
      <div className="archive-content">{view}</div>
      {props.dropActive ? <div className="drop-overlay"><span>Drop to add to the log</span></div> : null}
      {props.logPanelOpen ? <LogPanel onChooseLogPaths={props.onChooseLogPaths} onClearLogPaths={props.onClearLogPaths} onCloseLogPanel={props.onCloseLogPanel} onCreateLog={props.onCreateLog} pendingLogPaths={props.pendingLogPaths} /> : null}
    </div>
  );

  return <AppShell mobileNavigation={mobileNavigation} navigationRail={navigation} workspaceStage={stage} />;
}

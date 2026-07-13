// ABOUTME: Renders the chronological diary as the emotional center with month metrics and three modes.
// ABOUTME: Timeline entries expand in place; ledger and grid modes reuse the same persisted entries.
import { DiaryEntryRow } from '../components/diary-entry.js';
import { FilmPoster } from '../components/film-poster.js';
import { EmptyState } from '../components/states.js';
import { formatRuntime, readEntryFilm, sumRuntime, type DiaryMode } from '../archive-model.js';
import { parseFilmTitle } from '../../shared/film-title.js';
import type { EntryDetails, MovieLogState } from '../../shared/types.js';

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' });

interface DiaryViewProps {
  diaryMode: DiaryMode;
  onDiaryModeChange(mode: DiaryMode): void;
  onOpenLogPanel(): void;
  onSelectPath(path: string): void;
  onUpdateEntry(entryId: string, details: EntryDetails): Promise<void>;
  state: MovieLogState;
}

export function DiaryView({ diaryMode, onDiaryModeChange, onOpenLogPanel, onSelectPath, onUpdateEntry, state }: DiaryViewProps) {
  const history = [...state.history].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));

  if (history.length === 0) {
    return (
      <EmptyState
        actions={
          <button className="command-block command-block-primary" onClick={onOpenLogPanel} type="button">
            Log a Film
          </button>
        }
        fragment="sleeve"
        hint="Search the catalog from Log a Film, or drop a media file anywhere on this window."
        title="Your diary begins here."
      />
    );
  }

  const latestDate = new Date((history[0] as (typeof history)[0]).watchedAt);
  const monthKey = history[0]?.watchedAt.slice(0, 7) ?? '';
  const monthEntries = history.filter((entry) => entry.watchedAt.startsWith(monthKey));
  const monthRatings = monthEntries.filter((entry) => typeof entry.rating === 'number');
  const highestRated = [...monthRatings].sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];
  const monthRuntime = sumRuntime(monthEntries, state.films);
  const averageRating =
    monthRatings.length === 0
      ? null
      : monthRatings.reduce((total, entry) => total + (entry.rating ?? 0), 0) / monthRatings.length;

  return (
    <section className={`diary-view diary-${diaryMode}`}>
      <header className="month-summary">
        <div className="month-summary-title">
          <p className="eyebrow">Viewing register</p>
          <h2>{monthFormatter.format(latestDate)}</h2>
        </div>
        <dl className="month-metrics">
          <div>
            <dt>Films watched</dt>
            <dd>{monthEntries.length}</dd>
          </div>
          <div>
            <dt>Average rating</dt>
            <dd>{averageRating === null ? '—' : averageRating.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Total runtime</dt>
            <dd>
              {monthRuntime.knownCount === 0 ? '—' : formatRuntime(monthRuntime.minutes)}
              {monthRuntime.knownCount > 0 && monthRuntime.knownCount < monthEntries.length ? (
                <small className="metric-note">{` / ${monthRuntime.knownCount} known`}</small>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Rewatches</dt>
            <dd>{monthEntries.filter((entry) => entry.rewatch).length}</dd>
          </div>
          <div className="summary-wide">
            <dt>Highest rated</dt>
            <dd>{highestRated ? parseFilmTitle(highestRated.title).title : '—'}</dd>
          </div>
        </dl>
      </header>

      <div aria-label="Diary layout" className="view-switcher" role="tablist">
        {(['timeline', 'ledger', 'grid'] as DiaryMode[]).map((mode) => (
          <button
            aria-selected={diaryMode === mode}
            key={mode}
            onClick={() => onDiaryModeChange(mode)}
            role="tab"
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>

      {diaryMode === 'grid' ? (
        <div className="diary-list diary-poster-grid">
          {history.map((entry) => {
            const parsed = parseFilmTitle(entry.title);
            const film = readEntryFilm(entry, state.films);

            return (
              <button className="diary-grid-card" key={entry.id} onClick={() => onSelectPath(entry.sourcePath)} type="button">
                <FilmPoster
                  displayTitle={film?.status === 'matched' ? film.title : parsed.title}
                  film={film}
                  size="card"
                  year={film?.year ?? parsed.year}
                />
                <span className="diary-grid-caption">
                  <span className="diary-grid-title">{film?.status === 'matched' ? film.title : parsed.title}</span>
                  <span className="diary-grid-date">{shortDateFormatter.format(new Date(entry.watchedAt))}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : diaryMode === 'ledger' ? (
        <ol className="diary-list diary-ledger-list">
          {history.map((entry) => {
            const parsed = parseFilmTitle(entry.title);
            const film = readEntryFilm(entry, state.films);

            return (
              <li className="diary-entry diary-ledger-row" key={entry.id}>
                <button onClick={() => onSelectPath(entry.sourcePath)} type="button">
                  <span className="ledger-date">{shortDateFormatter.format(new Date(entry.watchedAt))}</span>
                  <span className="ledger-title">{film?.status === 'matched' ? film.title : parsed.title}</span>
                  <span className="ledger-year">{film?.year ?? parsed.year ?? '—'}</span>
                  <span className="ledger-rating">{typeof entry.rating === 'number' ? entry.rating.toFixed(1) : 'NR'}</span>
                  <span className="ledger-marks">
                    {entry.favorite ? <i className="entry-mark entry-mark-favorite">FAV</i> : null}
                    {entry.rewatch ? <i className="entry-mark entry-mark-rewatch">RW</i> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="diary-list">
          {history.map((entry, index) => {
            const parsed = parseFilmTitle(entry.title);
            const film = readEntryFilm(entry, state.films);

            return (
              <DiaryEntryRow
                displayTitle={film?.status === 'matched' ? film.title : parsed.title}
                entry={entry}
                film={film}
                key={entry.id}
                onOpen={onSelectPath}
                onUpdateEntry={onUpdateEntry}
                sequence={history.length - index}
                year={film?.year ?? parsed.year}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

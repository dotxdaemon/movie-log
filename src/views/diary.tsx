// ABOUTME: Renders the chronological diary as the emotional center with month metrics and three modes.
// ABOUTME: Timeline entries expand in place; ledger and grid modes reuse the same persisted entries.
import type { KeyboardEvent } from 'react';
import { DiaryEntryRow } from '../components/diary-entry.js';
import { FilmPoster } from '../components/film-poster.js';
import { EmptyState } from '../components/states.js';
import {
  formatRuntime,
  readEntryFilm,
  readEntryMediaType,
  readMediaTypeLabel,
  sumRuntime,
  type DiaryMode
} from '../archive-model.js';
import { readEpisodeCode } from '../../shared/film-title.js';
import { parseFilmTitle } from '../../shared/film-title.js';
import { readLocalCalendarMonthKey } from '../../shared/local-calendar.js';
import type { EntryDetails, MovieLogState } from '../../shared/types.js';

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric'
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short'
});
const diaryModes: DiaryMode[] = ['timeline', 'ledger', 'grid'];

interface DiaryViewProps {
  diaryMode: DiaryMode;
  onDiaryModeChange(mode: DiaryMode): void;
  onOpenLogPanel(): void;
  onSelectPath(path: string): void;
  onUpdateEntry(entryId: string, details: EntryDetails): Promise<void>;
  state: MovieLogState;
}

export function DiaryView({
  diaryMode,
  onDiaryModeChange,
  onOpenLogPanel,
  onSelectPath,
  onUpdateEntry,
  state
}: DiaryViewProps) {
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
  const monthKey = readLocalCalendarMonthKey((history[0] as (typeof history)[0]).watchedAt);
  const monthEntries = history.filter((entry) => readLocalCalendarMonthKey(entry.watchedAt) === monthKey);
  const monthRatings = monthEntries.filter((entry) => typeof entry.rating === 'number');
  const highestRated = [...monthRatings].sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];
  const monthRuntime = sumRuntime(monthEntries, state.films);
  const averageRating =
    monthRatings.length === 0
      ? null
      : monthRatings.reduce((total, entry) => total + (entry.rating ?? 0), 0) / monthRatings.length;

  function handleTabKeyDown(mode: DiaryMode, event: KeyboardEvent<HTMLButtonElement>): void {
    const currentIndex = diaryModes.indexOf(mode);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % diaryModes.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + diaryModes.length) % diaryModes.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = diaryModes.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    onDiaryModeChange(diaryModes[nextIndex] as DiaryMode);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  return (
    <section className={`diary-view diary-${diaryMode}`}>
      <header className="month-summary">
        <div className="month-summary-title">
          <p className="eyebrow">Viewing register</p>
          <h2>{monthFormatter.format(latestDate)}</h2>
        </div>
        <dl className="month-metrics">
          <div>
            <dt>Viewings</dt>
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
        {diaryModes.map((mode) => (
          <button
            aria-controls={`diary-panel-${mode}`}
            aria-selected={diaryMode === mode}
            id={`diary-tab-${mode}`}
            key={mode}
            onClick={() => onDiaryModeChange(mode)}
            onKeyDown={(event) => handleTabKeyDown(mode, event)}
            role="tab"
            tabIndex={diaryMode === mode ? 0 : -1}
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`diary-tab-${diaryMode}`}
        className="diary-tab-panel"
        id={`diary-panel-${diaryMode}`}
        role="tabpanel"
        tabIndex={0}
      >
        {diaryMode === 'grid' ? (
          <div className="diary-list diary-poster-grid">
            {history.map((entry) => {
              const parsed = parseFilmTitle(entry.title);
              const film = readEntryFilm(entry, state.films);
              const mediaType = readEntryMediaType(entry, state.films);
              const mediaLabel = readMediaTypeLabel({ episodeCode: readEpisodeCode(entry.title), mediaType });

              return (
                <button
                  className="diary-grid-card"
                  data-path={entry.sourcePath}
                  key={entry.id}
                  onClick={() => onSelectPath(entry.sourcePath)}
                  type="button"
                >
                  <FilmPoster
                    displayTitle={film?.status === 'matched' ? film.title : parsed.title}
                    film={film}
                    size="card"
                    year={film?.year ?? parsed.year}
                  />
                  <span className="diary-grid-caption">
                    <span className="diary-grid-title">{film?.status === 'matched' ? film.title : parsed.title}</span>
                    <span className="media-type-label">{mediaLabel}</span>
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
              const mediaType = readEntryMediaType(entry, state.films);

              return (
                <li className="diary-entry diary-ledger-row" key={entry.id}>
                  <button data-path={entry.sourcePath} onClick={() => onSelectPath(entry.sourcePath)} type="button">
                    <span className="ledger-date">{shortDateFormatter.format(new Date(entry.watchedAt))}</span>
                    <span className="ledger-title">{film?.status === 'matched' ? film.title : parsed.title}</span>
                    <span className="visually-hidden">
                      {readMediaTypeLabel({ episodeCode: readEpisodeCode(entry.title), mediaType })}
                    </span>
                    <span className="ledger-year">{film?.year ?? parsed.year ?? '—'}</span>
                    <span className="ledger-rating">
                      {typeof entry.rating === 'number' ? entry.rating.toFixed(1) : 'NR'}
                    </span>
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
              const mediaType = readEntryMediaType(entry, state.films);

              return (
                <DiaryEntryRow
                  displayTitle={film?.status === 'matched' ? film.title : parsed.title}
                  entry={entry}
                  film={film}
                  key={entry.id}
                  mediaLabel={readMediaTypeLabel({ episodeCode: readEpisodeCode(entry.title), mediaType })}
                  onOpen={onSelectPath}
                  onUpdateEntry={onUpdateEntry}
                  sequence={history.length - index}
                  year={film?.year ?? parsed.year}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

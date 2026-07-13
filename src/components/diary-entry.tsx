// ABOUTME: Renders one chronological diary entry with markers, an excerpt, and an in-place expansion.
// ABOUTME: The expanded state keeps the entry geometry and exposes review, tags, cast, method, and editing.
import { EntryForm } from './entry-form.js';
import { FilmPoster } from './film-poster.js';
import { RatingMeter } from './rating.js';
import type { EntryDetails, FilmRecord, WatchEntry } from '../../shared/types.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

interface DiaryEntryRowProps {
  displayTitle: string;
  entry: WatchEntry;
  film: FilmRecord | null;
  onOpen(path: string): void;
  onUpdateEntry(entryId: string, details: EntryDetails): Promise<void>;
  sequence: number;
  year: number | null;
}

export function DiaryEntryRow({ displayTitle, entry, film, onOpen, onUpdateEntry, sequence, year }: DiaryEntryRowProps) {
  const watchedDate = new Date(entry.watchedAt);
  const review = entry.review?.trim() ?? '';
  const method = [entry.viewingFormat, entry.location].filter(Boolean).join(' · ');

  return (
    <article className={entry.favorite ? 'diary-entry diary-entry-favorite' : 'diary-entry'}>
      <button className="entry-date" onClick={() => onOpen(entry.sourcePath)} type="button">
        <span className="entry-date-day">{String(watchedDate.getDate()).padStart(2, '0')}</span>
        <small>{dateFormatter.format(watchedDate)}</small>
      </button>
      <div className="entry-body">
        <FilmPoster displayTitle={displayTitle} film={film} size="entry" year={year} />
        <div className="entry-copy">
          <p className="entry-sequence">ENTRY {String(sequence).padStart(3, '0')}</p>
          <h3>
            <button onClick={() => onOpen(entry.sourcePath)} type="button">
              {displayTitle}
              {year === null ? null : <span className="entry-year">{year}</span>}
            </button>
          </h3>
          <p className="entry-source">
            {entry.source === 'watch' ? 'Watched folder' : 'Logged'}
            {method ? ` · ${method}` : ''}
          </p>
          <div className="entry-marks">
            {typeof entry.rating === 'number' ? <RatingMeter compact rating={entry.rating} /> : null}
            {entry.favorite ? <span className="entry-mark entry-mark-favorite">Favorite</span> : null}
            {entry.rewatch ? <span className="entry-mark entry-mark-rewatch">Rewatch</span> : null}
          </div>
          {(entry.tags ?? []).length > 0 ? (
            <ul className="tag-list">
              {entry.tags?.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {review ? <p className="entry-excerpt">{review}</p> : null}
          <details className="entry-expand">
            <summary>{review ? 'Full entry' : 'Annotate'}</summary>
            <div className="entry-expanded">
              {review ? (
                <div className="entry-review-full">
                  <p className="eyebrow">Review</p>
                  <p className="diary-entry-review">{review}</p>
                </div>
              ) : null}
              {film && film.cast.length > 0 ? (
                <div className="entry-cast">
                  <p className="eyebrow">Cast</p>
                  <p className="entry-cast-names">{film.cast.join(', ')}</p>
                </div>
              ) : null}
              <div className="entry-annotation">
                <p className="eyebrow">Edit entry</p>
                <EntryForm
                  defaults={entry}
                  onSubmit={(details) => void onUpdateEntry(entry.id, details)}
                  submitLabel="Save entry"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

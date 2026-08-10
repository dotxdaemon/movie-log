// ABOUTME: Renders the film dossier as an editorial spread with credits, ledger, review, and annotations.
// ABOUTME: The poster anchors the asymmetric layout and the user's rating carries the strongest priority.
import type { FormEvent } from 'react';
import { EntryForm } from '../components/entry-form.js';
import { FilmPoster } from '../components/film-poster.js';
import { MetaList } from '../components/meta.js';
import { RatingMeter } from '../components/rating.js';
import { EmptyState } from '../components/states.js';
import { formatRuntime, readMediaTypeLabel, type ArchiveItem } from '../archive-model.js';
import { readCatalogResultKey } from '../catalog-result.js';
import type { CatalogSearchResult, LogEntryDetails, WatchEntry } from '../../shared/types.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

interface DossierViewProps {
  archiveItems: ArchiveItem[];
  matchError: string | null;
  matchPending: boolean;
  matchResults: CatalogSearchResult[];
  onBack(): void;
  onCopyPath(path: string): Promise<void>;
  onLogItem(item: ArchiveItem): void;
  onMatchFilm(item: ArchiveItem, selection: CatalogSearchResult | null): void;
  onOpenInFinder(path: string): Promise<void>;
  onOpenItem(path: string): Promise<void>;
  onRequestDeleteEntry(entry: WatchEntry): void;
  onSearchMatch(query: string): void;
  onUpdateEntry(entryId: string, details: LogEntryDetails): Promise<void>;
  originLabel: string;
  selectedPath: string | null;
}

export function DossierView({
  archiveItems,
  matchError,
  matchPending,
  matchResults,
  onBack,
  onCopyPath,
  onLogItem,
  onMatchFilm,
  onOpenInFinder,
  onOpenItem,
  onRequestDeleteEntry,
  onSearchMatch,
  onUpdateEntry,
  originLabel,
  selectedPath
}: DossierViewProps) {
  const item = archiveItems.find((candidate) =>
    selectedPath === null ? false : candidate.sourcePaths.includes(selectedPath)
  );

  if (!item) {
    return (
      <EmptyState
        actions={
          <button className="command-block" onClick={onBack} type="button">
            Back
          </button>
        }
        fragment="panel"
        hint="The underlying file or diary record may have been removed."
        title="This archive item is unavailable."
      />
    );
  }

  const film = item.film;
  const posterUrl = film?.posterUrl ?? null;
  const latestReview = item.viewings.find((entry) => entry.review?.trim())?.review?.trim() ?? '';
  const fileBacked = item.localSourcePaths.length > 0;

  function submitMatchSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('matchQuery') ?? '').trim();

    if (query) {
      onSearchMatch(query);
    }
  }

  return (
    <section
      className={`movie-dossier dossier-from-${originLabel.toLowerCase()}`}
      data-film-record-keys={JSON.stringify(item.filmRecordKeys)}
    >
      <button className="dossier-back-action" onClick={onBack} type="button">
        <span aria-hidden="true">←</span>
        {`Back to ${originLabel}`}
      </button>
      <div className="dossier-identity">
        {posterUrl ? (
          <span aria-hidden="true" className="dossier-backdrop" style={{ backgroundImage: `url(${posterUrl})` }} />
        ) : null}
        <div className="dossier-poster-col">
          <FilmPoster
            alt={`${item.displayTitle} poster`}
            displayTitle={item.displayTitle}
            film={film}
            size="dossier"
            year={item.year}
          />
        </div>
        <div className="dossier-copy">
          <p className="eyebrow">Archive dossier</p>
          <h2>{item.displayTitle}</h2>
          <p className="dossier-standfirst">
            {readMediaTypeLabel(item)} · {item.year ?? 'Year unknown'} ·{' '}
            {item.current ? 'Currently indexed' : 'Viewing record'}
            {film?.runtimeMinutes ? ` · ${formatRuntime(film.runtimeMinutes)}` : ''}
          </p>

          <div className="dossier-rating">
            <p className="eyebrow">Your rating</p>
            {item.rating === null ? (
              <p className="dossier-rating-empty">Not rated yet</p>
            ) : (
              <RatingMeter rating={item.rating} />
            )}
          </div>

          <MetaList
            className="dossier-meta"
            rows={[
              { label: 'Director', value: film?.director.join(', ') || null },
              { label: 'Runtime', value: film?.runtimeMinutes ? `${film.runtimeMinutes} min` : null },
              { label: 'Genre', value: film?.genres.join(' · ') || null },
              { label: 'Country', value: film?.country.join(', ') || null },
              { label: 'Language', value: film?.language.join(', ') || null },
              { label: 'Viewings', value: String(item.viewings.length) }
            ]}
          />

          <div className="dossier-actions">
            {fileBacked ? (
              item.localSourcePaths.map((sourcePath) => (
                <div className="dossier-source-actions" key={sourcePath}>
                  <span title={sourcePath}>{sourcePath.split('/').at(-1) ?? sourcePath}</span>
                  <button onClick={() => void onOpenItem(sourcePath)} type="button">
                    Open
                  </button>
                  <button onClick={() => void onOpenInFinder(sourcePath)} type="button">
                    Show in Finder
                  </button>
                  <button onClick={() => void onCopyPath(sourcePath)} type="button">
                    Copy path
                  </button>
                </div>
              ))
            ) : (
              <span className="dossier-source-note">Logged from the catalog</span>
            )}
          </div>

          <details className="match-study">
            <summary>Catalog match · {film?.status === 'matched' ? film.title : 'None'}</summary>
            <div className="match-study-body">
              <form className="match-search" onSubmit={submitMatchSearch}>
                <label className="visually-hidden" htmlFor="dossier-match-input">
                  Search the catalog
                </label>
                <input defaultValue={item.displayTitle} id="dossier-match-input" name="matchQuery" type="search" />
                <button className="command-block" type="submit">
                  Search catalog
                </button>
              </form>
              {matchPending ? <p className="match-pending">Searching…</p> : null}
              {matchError ? (
                <div className="catalog-error dossier-match-error" role="alert">
                  <strong>Catalog search failed</strong>
                  <span>{matchError}</span>
                </div>
              ) : null}
              {matchResults.length > 0 ? (
                <ol className="match-results">
                  {matchResults.map((result) => (
                    <li key={readCatalogResultKey(result)}>
                      <button onClick={() => onMatchFilm(item, result)} type="button">
                        <span className="match-result-title">{result.title}</span>
                        <span className="match-result-meta">
                          {result.year ?? '—'} · {result.description || 'Catalog page'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
              {film?.status === 'matched' ? (
                <button className="match-clear" onClick={() => onMatchFilm(item, null)} type="button">
                  Clear this match
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      {film && film.cast.length > 0 ? (
        <section className="dossier-cast">
          <header>
            <p className="eyebrow">Credits</p>
            <h3>Cast</h3>
          </header>
          <ul className="cast-list">
            {film.cast.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.viewings.length > 0 ? (
        <section className="viewing-history">
          <header>
            <p className="eyebrow">Chronology</p>
            <h3>Viewing history</h3>
          </header>
          <ol className="viewing-ledger">
            {item.viewings.map((entry) => (
              <li className="viewing-row" data-entry-id={entry.id} key={entry.id}>
                <time className="viewing-date" dateTime={entry.watchedAt}>
                  {dateFormatter.format(new Date(entry.watchedAt))}
                </time>
                <span className="viewing-rating">
                  {typeof entry.rating === 'number' ? entry.rating.toFixed(1) : 'NR'}
                </span>
                <span className="viewing-kind">{entry.rewatch ? 'Rewatch' : 'Viewing'}</span>
                <span className="viewing-format">{entry.viewingFormat || '—'}</span>
                <span className="viewing-location">{entry.location || '—'}</span>
                {entry.review?.trim() ? <p className="viewing-note">{entry.review}</p> : null}
                <details className="viewing-editor">
                  <summary>Edit viewing</summary>
                  <div className="viewing-editor-body">
                    <EntryForm
                      defaults={entry}
                      onSubmit={(details) => void onUpdateEntry(entry.id, details)}
                      showDate
                      submitLabel="Save viewing"
                    />
                    <div className="viewing-danger-zone">
                      <p>Remove this viewing, its rating, notes, and tags from your journal.</p>
                      <button
                        className="viewing-delete-action"
                        onClick={() => onRequestDeleteEntry(entry)}
                        type="button"
                      >
                        Delete viewing…
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="dossier-unlogged">
          <header>
            <p className="eyebrow">Viewing status</p>
            <h3>Not logged yet</h3>
          </header>
          <p>This title is indexed in Library but has no logged viewing.</p>
          <button className="command-block dossier-log-action" onClick={() => onLogItem(item)} type="button">
            Log a viewing
          </button>
        </section>
      )}

      {latestReview ? (
        <section className="dossier-review">
          <header>
            <p className="eyebrow">Reading copy</p>
            <h3>Review</h3>
          </header>
          <p className="dossier-review-body">{latestReview}</p>
        </section>
      ) : null}

      {item.tags.length > 0 ? (
        <section className="dossier-tags">
          <header>
            <p className="eyebrow">Register</p>
            <h3>Tags</h3>
          </header>
          <ul className="tag-list tag-list-large">
            {item.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

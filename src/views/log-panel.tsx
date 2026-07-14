// ABOUTME: Renders the Log a Film flow as a structured side panel with catalog search before media choice.
// ABOUTME: The selected film sits as a poster unit above the form and the save action stays visible.
import { EntryForm } from '../components/entry-form.js';
import { FilmPoster } from '../components/film-poster.js';
import { SheetDialog } from '../components/sheet-dialog.js';
import type { CatalogSearchResult, LogEntryDetails } from '../../shared/types.js';

const pathName = (path: string): string => path.split('/').filter(Boolean).at(-1) ?? path;

interface LogPanelProps {
  filmError: string | null;
  filmPending: boolean;
  filmQuery: string;
  filmResults: CatalogSearchResult[];
  onChooseLogPaths(): Promise<void>;
  onClearLogPaths(): void;
  onClose(): void;
  onCreateLog(details: LogEntryDetails): Promise<void>;
  onFilmQueryChange(value: string): void;
  onReviewChange(value: string): void;
  onSelectFilm(film: CatalogSearchResult | null): void;
  pendingLogPaths: string[];
  review: string;
  selectedFilm: CatalogSearchResult | null;
}

export function LogPanel({
  filmError,
  filmPending,
  filmQuery,
  filmResults,
  onChooseLogPaths,
  onClearLogPaths,
  onClose,
  onCreateLog,
  onFilmQueryChange,
  onReviewChange,
  onSelectFilm,
  pendingLogPaths,
  review,
  selectedFilm
}: LogPanelProps) {
  const canSubmit = selectedFilm !== null || pendingLogPaths.length > 0;

  return (
    <SheetDialog
      backdropClassName="log-backdrop"
      eyebrow="New diary entry"
      headClassName="log-sheet-head"
      label="Log a Film"
      onClose={onClose}
      sheetClassName="log-sheet"
      title="Log a Film"
    >
        <div className="log-sheet-body">
          <div className="log-source-column">
            {selectedFilm ? (
              <div className="selected-film">
                <FilmPoster
                  displayTitle={selectedFilm.title}
                  film={null}
                  posterUrl={selectedFilm.posterUrl}
                  size="entry"
                  year={selectedFilm.year}
                />
                <div className="selected-film-copy">
                  <p className="eyebrow">Selected film</p>
                  <strong>{selectedFilm.title}</strong>
                  <span className="selected-film-meta">
                    {selectedFilm.year ?? 'Year unknown'}
                    {selectedFilm.director?.length ? ` · ${selectedFilm.director.join(', ')}` : ''}
                    {selectedFilm.description ? ` · ${selectedFilm.description}` : ''}
                  </span>
                </div>
                <button aria-label="Clear selected film" className="selected-film-clear" onClick={() => onSelectFilm(null)} type="button">
                  ×
                </button>
              </div>
            ) : (
              <div className="film-search-block">
                <label className="field-block">
                  <span>Find the film</span>
                  <input
                    autoFocus
                    onChange={(event) => onFilmQueryChange(event.target.value)}
                    placeholder="Search the catalog by title"
                    type="search"
                    value={filmQuery}
                  />
                </label>
                {filmPending ? <p className="film-search-pending">Searching…</p> : null}
                {filmError ? (
                  <div className="catalog-error" role="alert">
                    <strong>Catalog search failed</strong>
                    <span>{filmError}</span>
                  </div>
                ) : null}
                {filmResults.length > 0 ? (
                  <ol className="film-search-results">
                    {filmResults.map((result) => (
                      <li key={result.pageId}>
                        <button onClick={() => onSelectFilm(result)} type="button">
                          <FilmPoster displayTitle={result.title} film={null} posterUrl={result.posterUrl} size="thumb" year={result.year} />
                          <span className="film-search-copy">
                            <strong>{result.title}</strong>
                            <small>
                              {result.year ?? '—'}
                              {result.director?.length ? ` · ${result.director.join(', ')}` : ''}
                              {result.description ? ` · ${result.description}` : ''}
                            </small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {filmQuery.trim() && !filmPending && !filmError && filmResults.length === 0 ? (
                  <p className="film-search-empty">No catalog match. Attach local media below instead.</p>
                ) : null}
              </div>
            )}

            <div className="media-attach">
              <p className="media-attach-label">{selectedFilm ? 'Optional local media' : 'Or attach local media'}</p>
              <button className="media-chooser" onClick={() => void onChooseLogPaths()} type="button">
                <span>Choose Media</span>
                <small>File or folder · multiple selection supported</small>
              </button>
              {pendingLogPaths.length > 0 ? (
                <div className="selected-media">
                  <header>
                    <span>Selected media</span>
                    <button onClick={onClearLogPaths} type="button">Clear</button>
                  </header>
                  {pendingLogPaths.map((path) => (
                    <p key={path} title={path}>
                      {pathName(path)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <EntryForm
            defaults={{}}
            footer
            onReviewChange={onReviewChange}
            onSubmit={(details) => void onCreateLog(details)}
            review={review}
            showDate
            submitDisabled={!canSubmit}
            submitLabel="Create diary entry"
          />
        </div>
    </SheetDialog>
  );
}

// ABOUTME: Renders the Log a Film flow as a structured side panel with catalog search before media choice.
// ABOUTME: The selected film sits as a poster unit above the form and the save action stays visible.
import type { KeyboardEvent } from 'react';
import { EntryForm } from '../components/entry-form.js';
import { FilmPoster } from '../components/film-poster.js';
import { SheetDialog } from '../components/sheet-dialog.js';
import { readCatalogResultKey } from '../catalog-result.js';
import type { CatalogSearchResult, LogEntryDetails } from '../../shared/types.js';

const pathName = (path: string): string => path.split('/').filter(Boolean).at(-1) ?? path;

interface LogPanelProps {
  filmActiveIndex: number;
  filmError: string | null;
  filmPending: boolean;
  filmQuery: string;
  filmResults: CatalogSearchResult[];
  onChooseLogPaths(): Promise<void>;
  onClearLogPaths(): void;
  onClose(): void;
  onCreateLog(details: LogEntryDetails): Promise<void>;
  onFilmActiveIndexChange(index: number): void;
  onFilmQueryChange(value: string): void;
  onReviewChange(value: string): void;
  onSelectFilm(film: CatalogSearchResult | null): void;
  pendingLogPaths: string[];
  review: string;
  saving: boolean;
  selectedFilm: CatalogSearchResult | null;
}

export function LogPanel({
  filmActiveIndex,
  filmError,
  filmPending,
  filmQuery,
  filmResults,
  onChooseLogPaths,
  onClearLogPaths,
  onClose,
  onCreateLog,
  onFilmActiveIndexChange,
  onFilmQueryChange,
  onReviewChange,
  onSelectFilm,
  pendingLogPaths,
  review,
  saving,
  selectedFilm
}: LogPanelProps) {
  const ambiguousSelection = selectedFilm !== null && pendingLogPaths.length > 1;
  const canSubmit = (selectedFilm !== null || pendingLogPaths.length > 0) && !ambiguousSelection;
  const activeIndex = Math.max(0, Math.min(filmActiveIndex, Math.max(0, filmResults.length - 1)));
  const activeResult = filmResults[activeIndex];

  function moveActive(nextIndex: number): void {
    if (filmResults.length === 0) {
      return;
    }

    onFilmActiveIndexChange(nextIndex);
    document.getElementById(`log-film-option-${nextIndex}`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleFilmKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(Math.min(activeIndex + 1, filmResults.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === 'Home' && filmResults.length > 0) {
      event.preventDefault();
      moveActive(0);
      return;
    }

    if (event.key === 'End' && filmResults.length > 0) {
      event.preventDefault();
      moveActive(filmResults.length - 1);
      return;
    }

    if (event.key === 'Enter' && activeResult) {
      event.preventDefault();
      onSelectFilm(activeResult);
    }
  }

  return (
    <SheetDialog
      backdropClassName="log-backdrop"
      eyebrow="New viewing"
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
              <button
                aria-label="Clear selected film"
                className="selected-film-clear"
                onClick={() => onSelectFilm(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="film-search-block">
              <label className="field-block">
                <span>Find the film</span>
                <input
                  aria-autocomplete="list"
                  aria-activedescendant={activeResult ? `log-film-option-${activeIndex}` : undefined}
                  aria-controls="log-film-results"
                  aria-expanded={filmResults.length > 0}
                  aria-keyshortcuts="ArrowDown ArrowUp Home End Enter"
                  autoFocus
                  onChange={(event) => onFilmQueryChange(event.target.value)}
                  onKeyDown={handleFilmKeyDown}
                  placeholder="Search the catalog by title"
                  role="combobox"
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
                <ol className="film-search-results" id="log-film-results" role="listbox">
                  {filmResults.map((result, index) => (
                    <li key={readCatalogResultKey(result)}>
                      <button
                        aria-selected={index === activeIndex}
                        className={index === activeIndex ? 'film-search-result-active' : undefined}
                        id={`log-film-option-${index}`}
                        onClick={() => onSelectFilm(result)}
                        onMouseEnter={() => onFilmActiveIndexChange(index)}
                        role="option"
                        tabIndex={-1}
                        type="button"
                      >
                        <FilmPoster
                          displayTitle={result.title}
                          film={null}
                          posterUrl={result.posterUrl}
                          size="thumb"
                          year={result.year}
                        />
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
                  <button onClick={onClearLogPaths} type="button">
                    Clear
                  </button>
                </header>
                {pendingLogPaths.map((path) => (
                  <p key={path} title={path}>
                    {pathName(path)}
                  </p>
                ))}
              </div>
            ) : null}
            {ambiguousSelection ? (
              <div className="log-ambiguity-error" role="alert">
                <strong>Choose one media item</strong>
                <span>
                  Attach one media item for this catalog film, or clear the selected film to log multiple items.
                </span>
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
          submitDisabled={!canSubmit || saving}
          submitLabel={saving ? 'Saving viewing…' : 'Log viewing'}
        />
      </div>
    </SheetDialog>
  );
}

// ABOUTME: Renders archive search with diary, library, and catalog lanes behind one pale framed field.
// ABOUTME: Arrow keys move an active result, Enter opens it, and Escape dismisses the search surface.
import type { KeyboardEvent } from 'react';
import { FilmPoster } from '../components/film-poster.js';
import { EmptyState } from '../components/states.js';
import type { SearchGroups, SearchResultItem } from '../archive-model.js';

interface SearchViewProps {
  activeIndex: number;
  catalogError: string | null;
  catalogPending: boolean;
  groups: SearchGroups;
  onActiveIndexChange(index: number): void;
  onDismiss(): void;
  onOpenResult(result: SearchResultItem): void;
  onSearchQueryChange(value: string): void;
  searchQuery: string;
}

function SearchLane({
  activeKey,
  emptyLabel,
  index,
  onOpenResult,
  results,
  startIndex,
  title
}: {
  activeKey: string | null;
  emptyLabel: string | null;
  index: string;
  onOpenResult(result: SearchResultItem): void;
  results: SearchResultItem[];
  startIndex: number;
  title: string;
}) {
  return (
    <section className="search-group">
      <header>
        <span className="study-index">{index}</span>
        <h2>{title}</h2>
        <span className="search-group-count">{results.length}</span>
      </header>
      {results.length === 0 && emptyLabel ? <p className="search-group-empty">{emptyLabel}</p> : null}
      {results.map((result, offset) => (
        <button
          aria-selected={activeKey === result.key}
          className={activeKey === result.key ? 'search-result search-result-active' : 'search-result'}
          data-path={result.sourcePath ?? undefined}
          id={`search-option-${startIndex + offset}`}
          key={result.key}
          onClick={() => onOpenResult(result)}
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
          <span className="search-result-copy">
            <span className="search-result-title">
              {result.title}
              <span className="search-result-year">{result.year ?? ''}</span>
            </span>
            <span className="search-result-meta">
              {result.director.length > 0 ? `${result.director.join(', ')} · ` : ''}
              {result.status}
            </span>
          </span>
          <span className="search-result-kind">{result.kind === 'catalog' ? 'Log' : 'Open'}</span>
        </button>
      ))}
    </section>
  );
}

export function SearchView({
  activeIndex,
  catalogError,
  catalogPending,
  groups,
  onActiveIndexChange,
  onDismiss,
  onOpenResult,
  onSearchQueryChange,
  searchQuery
}: SearchViewProps) {
  const query = searchQuery.trim();
  const flat = groups.flat;
  const activeKey = flat[activeIndex]?.key ?? null;

  function moveActive(nextIndex: number): void {
    if (flat.length === 0) {
      return;
    }

    onActiveIndexChange(nextIndex);
    document.getElementById(`search-option-${nextIndex}`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(Math.min(activeIndex + 1, flat.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const result = flat[activeIndex] ?? flat[0];

      if (result) {
        onOpenResult(result);
      }

      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onSearchQueryChange('');
      onDismiss();
    }
  }

  const noMatches = query && flat.length === 0 && !catalogPending && !catalogError;

  return (
    <section className="search-view">
      <label className="archive-search">
        <span>Search the complete archive</span>
        <input
          aria-autocomplete="list"
          aria-activedescendant={activeKey ? `search-option-${activeIndex}` : undefined}
          aria-controls="search-results"
          aria-expanded={flat.length > 0}
          autoFocus
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Title, tag, or catalog entry"
          role="combobox"
          type="search"
          value={searchQuery}
        />
      </label>
      {!query ? (
        <section className="search-initial">
          <span className="study-index">00</span>
          <div>
            <p className="eyebrow">Archive index</p>
            <h2>Search by title, tag, or catalog entry</h2>
            <p>
              Watched and current Library matches appear first. Catalog entries stay separate and never duplicate local
              results.
            </p>
          </div>
        </section>
      ) : noMatches ? (
        <EmptyState
          fragment="hand"
          hint="Try a title, a viewing tag, or a film not logged yet."
          index="00"
          title="No archive matches."
        />
      ) : (
        <div className="search-groups" id="search-results" role="listbox">
          <SearchLane
            activeKey={activeKey}
            emptyLabel={query ? 'No watched films match.' : null}
            index="A"
            onOpenResult={onOpenResult}
            results={groups.diary}
            startIndex={0}
            title="Watched"
          />
          <SearchLane
            activeKey={activeKey}
            emptyLabel={query ? 'Nothing currently indexed matches.' : null}
            index="B"
            onOpenResult={onOpenResult}
            results={groups.library}
            startIndex={groups.diary.length}
            title="Library"
          />
          <section className="search-group search-group-catalog">
            <header>
              <span className="study-index">C</span>
              <h2>Catalog</h2>
              <span className="search-group-count">{catalogPending ? '…' : groups.catalog.length}</span>
            </header>
            {catalogPending ? <p className="search-group-empty">Searching the catalog…</p> : null}
            {catalogError ? (
              <div className="catalog-error" role="alert">
                <strong>Catalog search failed</strong>
                <span>{catalogError}</span>
              </div>
            ) : null}
            {groups.catalog.map((result, offset) => (
              <button
                aria-selected={activeKey === result.key}
                className={activeKey === result.key ? 'search-result search-result-active' : 'search-result'}
                data-path={result.sourcePath ?? undefined}
                id={`search-option-${groups.diary.length + groups.library.length + offset}`}
                key={result.key}
                onClick={() => onOpenResult(result)}
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
                <span className="search-result-copy">
                  <span className="search-result-title">
                    {result.title}
                    <span className="search-result-year">{result.year ?? ''}</span>
                  </span>
                  <span className="search-result-meta">
                    {result.director.length > 0 ? `${result.director.join(', ')} · ` : ''}
                    {result.status}
                  </span>
                </span>
                <span className="search-result-kind">Log</span>
              </button>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}

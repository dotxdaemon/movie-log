// ABOUTME: Renders the filterable poster library with structural selection and marker-annotated cards.
// ABOUTME: Filters live in a compact desktop toolbar and a full-height sheet on narrow screens.
import { ActiveFilterChips } from '../components/filters.js';
import { FilmPoster } from '../components/film-poster.js';
import { MovieCard } from '../components/movie-card.js';
import { EmptyState } from '../components/states.js';
import {
  buildArchiveItems,
  defaultArchiveFilters,
  filterArchiveItems,
  formatRuntime,
  readMediaTypeLabel,
  type ArchiveFilters
} from '../archive-model.js';
import type { MovieLogState } from '../../shared/types.js';

interface LibraryViewProps {
  filters: ArchiveFilters;
  onFilterChange(filters: ArchiveFilters): void;
  onOpenPath(path: string): void;
  onSelectLibraryPath(path: string | null): void;
  selectedLibraryPath: string | null;
  state: MovieLogState;
}

export function LibraryView({
  filters,
  onFilterChange,
  onOpenPath,
  onSelectLibraryPath,
  selectedLibraryPath,
  state
}: LibraryViewProps) {
  const items = buildArchiveItems(state);
  const visibleItems = filterArchiveItems(items, filters);
  const selectedItem = visibleItems.find((item) => item.sourcePath === selectedLibraryPath) ?? null;
  if (items.length === 0) {
    return (
      <EmptyState
        fragment="boot"
        hint="Add a watched folder in Settings or log your first film."
        title="The library is empty."
      />
    );
  }

  return (
    <section className="library-view">
      <ActiveFilterChips filters={filters} onFilterChange={onFilterChange} />
      <div className={selectedItem ? 'library-workspace library-workspace-selected' : 'library-workspace'}>
        <div className="library-film-field">
          <div className="library-result-line">
            <span>{`${visibleItems.length} ${visibleItems.length === 1 ? 'title' : 'titles'}`}</span>
            <span className="library-result-rule" />
            <span>{`${state.libraryItems.length} currently indexed`}</span>
          </div>
          {visibleItems.length === 0 ? (
            <EmptyState
              actions={
                <button
                  className="command-block"
                  onClick={() =>
                    onFilterChange({
                      ...defaultArchiveFilters,
                      sort: filters.sort
                    })
                  }
                  type="button"
                >
                  Reset filters
                </button>
              }
              fragment="seam"
              hint="Adjust the archive controls to widen the selection."
              title="No titles match these filters."
            />
          ) : (
            <div className="movie-grid">
              {visibleItems.map((item) => (
                <MovieCard
                  item={item}
                  key={item.sourcePath}
                  onOpen={onOpenPath}
                  onSelect={onSelectLibraryPath}
                  selected={selectedLibraryPath === item.sourcePath}
                />
              ))}
            </div>
          )}
        </div>
        {selectedItem ? (
          <aside aria-label={`Selected title: ${selectedItem.displayTitle}`} className="library-inspector">
            <p className="eyebrow">Selected dossier</p>
            <div className="library-inspector-poster">
              <FilmPoster
                displayTitle={selectedItem.displayTitle}
                film={selectedItem.film}
                size="card"
                year={selectedItem.year}
              />
            </div>
            <h2>{selectedItem.displayTitle}</h2>
            <p className="media-type-label">{readMediaTypeLabel(selectedItem)}</p>
            <p className="library-inspector-line">
              {selectedItem.year ?? 'Year unknown'}
              {selectedItem.film?.runtimeMinutes ? ` · ${formatRuntime(selectedItem.film.runtimeMinutes)}` : ''}
            </p>
            <p className="library-inspector-line">
              {selectedItem.film?.director.join(', ') || 'Director not recorded'}
            </p>
            <p className="library-inspector-line">{selectedItem.film?.genres.join(' · ') || 'Genre not recorded'}</p>
            <p className="library-inspector-line">
              {selectedItem.rating === null ? 'Not rated' : `${selectedItem.rating.toFixed(1)} rating`} ·{' '}
              {selectedItem.current ? 'Currently indexed' : 'Diary only'}
            </p>
            <button
              className="command-block command-block-primary"
              onClick={() => onOpenPath(selectedItem.sourcePath)}
              type="button"
            >
              Open dossier
            </button>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

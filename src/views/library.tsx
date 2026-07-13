// ABOUTME: Renders the filterable poster library with structural selection and marker-annotated cards.
// ABOUTME: Filters live in a compact desktop toolbar and a full-height sheet on narrow screens.
import { ActiveFilterChips, FilterPanel } from '../components/filters.js';
import { MovieCard } from '../components/movie-card.js';
import { EmptyState } from '../components/states.js';
import { buildArchiveItems, defaultArchiveFilters, filterArchiveItems, type ArchiveFilters } from '../archive-model.js';
import type { MovieLogState } from '../../shared/types.js';

interface LibraryViewProps {
  filters: ArchiveFilters;
  filterSheetOpen: boolean;
  onFilterChange(filters: ArchiveFilters): void;
  onFilterSheetOpenChange(open: boolean): void;
  onOpenPath(path: string): void;
  onSelectLibraryPath(path: string | null): void;
  selectedLibraryPath: string | null;
  state: MovieLogState;
}

export function LibraryView({
  filters,
  filterSheetOpen,
  onFilterChange,
  onFilterSheetOpenChange,
  onOpenPath,
  onSelectLibraryPath,
  selectedLibraryPath,
  state
}: LibraryViewProps) {
  const items = buildArchiveItems(state);
  const visibleItems = filterArchiveItems(items, filters);
  const decades = [...new Set(items.map((item) => (item.year === null ? null : `${Math.floor(item.year / 10) * 10}s`)).filter(Boolean))].sort() as string[];
  const genres = [...new Set(items.flatMap((item) => item.film?.genres ?? []))].sort();
  const tags = [...new Set(items.flatMap((item) => item.tags))].sort();

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
      <FilterPanel
        filters={filters}
        onFilterChange={onFilterChange}
        onSheetOpenChange={onFilterSheetOpenChange}
        options={{ decades, genres, tags }}
        resultCount={visibleItems.length}
        sheetOpen={filterSheetOpen}
      />
      <ActiveFilterChips filters={filters} onFilterChange={onFilterChange} />
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
              onClick={() => onFilterChange({ ...defaultArchiveFilters, sort: filters.sort })}
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
    </section>
  );
}

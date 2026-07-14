// ABOUTME: Renders the library filter controls as a compact desktop toolbar and a full-height mobile sheet.
// ABOUTME: Keeps every active filter visible as a removable squared chip above the poster grid.
import { defaultArchiveFilters, ratingFilterOptions, type ArchiveFilters } from '../archive-model.js';
import { SheetDialog } from './sheet-dialog.js';

export interface FilterOptions {
  decades: string[];
  genres: string[];
  tags: string[];
}

interface FilterControlsProps {
  filters: ArchiveFilters;
  onFilterChange(filters: ArchiveFilters): void;
  options: FilterOptions;
}

const filterLabels: Record<keyof ArchiveFilters, string> = {
  decade: 'Decade',
  favorite: 'Favorite',
  genre: 'Genre',
  rating: 'Rating',
  rewatch: 'Rewatch',
  sort: 'Sort',
  status: 'Status',
  tag: 'Tag'
};

function FilterControls({ filters, onFilterChange, options }: FilterControlsProps) {
  const change = (key: keyof ArchiveFilters, value: string) => onFilterChange({ ...filters, [key]: value });

  return (
    <>
      <label className="filter-field">
        <span>{filterLabels.sort}</span>
        <select onChange={(event) => change('sort', event.target.value)} value={filters.sort}>
          <option value="recent">Recent</option>
          <option value="title">Title</option>
          <option value="rating">Rating</option>
          <option value="year">Release year</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.genre}</span>
        <select onChange={(event) => change('genre', event.target.value)} value={filters.genre}>
          <option value="all">All</option>
          {options.genres.map((genre) => (
            <option key={genre}>{genre}</option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.decade}</span>
        <select onChange={(event) => change('decade', event.target.value)} value={filters.decade}>
          <option value="all">All</option>
          {options.decades.map((decade) => (
            <option key={decade}>{decade}</option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.rating}</span>
        <select onChange={(event) => change('rating', event.target.value)} value={filters.rating}>
          {ratingFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.status}</span>
        <select onChange={(event) => change('status', event.target.value)} value={filters.status}>
          <option value="all">All</option>
          <option value="current">Currently indexed</option>
          <option value="archive">Diary only</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.favorite}</span>
        <select onChange={(event) => change('favorite', event.target.value)} value={filters.favorite}>
          <option value="all">All</option>
          <option value="favorite">Favorite</option>
          <option value="other">Not favorite</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.rewatch}</span>
        <select onChange={(event) => change('rewatch', event.target.value)} value={filters.rewatch}>
          <option value="all">All</option>
          <option value="rewatched">Rewatched</option>
          <option value="first">First viewings</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.tag}</span>
        <select onChange={(event) => change('tag', event.target.value)} value={filters.tag}>
          <option value="all">All</option>
          {options.tags.map((tag) => (
            <option key={tag}>{tag}</option>
          ))}
        </select>
      </label>
    </>
  );
}

interface FilterPanelProps extends FilterControlsProps {
  onSheetOpenChange(open: boolean): void;
  resultCount: number;
  sheetOpen: boolean;
}

function countActiveFilters(filters: ArchiveFilters): number {
  return (Object.entries(filters) as Array<[keyof ArchiveFilters, string]>).filter(
    ([key, value]) => key !== 'sort' && value !== 'all'
  ).length;
}

export function FilterPanel({ filters, onFilterChange, onSheetOpenChange, options, resultCount, sheetOpen }: FilterPanelProps) {
  const activeCount = countActiveFilters(filters);

  return (
    <div className="filter-panel">
      <div aria-label="Library filters" className="filter-toolbar">
        <FilterControls filters={filters} onFilterChange={onFilterChange} options={options} />
      </div>
      <button
        aria-expanded={sheetOpen}
        className="filter-sheet-trigger"
        onClick={() => onSheetOpenChange(true)}
        type="button"
      >
        Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
      </button>
      {sheetOpen ? (
        <SheetDialog
          backdropClassName="filter-sheet-backdrop"
          eyebrow="Library"
          headClassName="filter-sheet-head"
          label="Library filters"
          onClose={() => onSheetOpenChange(false)}
          sheetClassName="filter-sheet"
          title="Filters"
        >
          <div className="filter-sheet-body">
            <FilterControls filters={filters} onFilterChange={onFilterChange} options={options} />
          </div>
          <footer className="filter-sheet-actions">
            <button
              className="command-block"
              onClick={() => onFilterChange({ ...defaultArchiveFilters, sort: filters.sort })}
              type="button"
            >
              Reset
            </button>
            <button className="command-block command-block-primary" onClick={() => onSheetOpenChange(false)} type="button">
              {`Show ${resultCount} ${resultCount === 1 ? 'title' : 'titles'}`}
            </button>
          </footer>
        </SheetDialog>
      ) : null}
    </div>
  );
}


export function ActiveFilterChips({ filters, onFilterChange }: { filters: ArchiveFilters; onFilterChange(filters: ArchiveFilters): void }) {
  const active = (Object.entries(filters) as Array<[keyof ArchiveFilters, string]>).filter(
    ([key, value]) => key !== 'sort' && value !== 'all'
  );

  if (active.length === 0) {
    return null;
  }

  return (
    <div aria-label="Active filters" className="active-filters">
      {active.map(([key, value]) => (
        <button
          aria-label={`Remove ${filterLabels[key]} filter ${value}`}
          className="filter-chip"
          key={key}
          onClick={() => onFilterChange({ ...filters, [key]: 'all' })}
          type="button"
        >
          <span className="filter-chip-key">{filterLabels[key]}</span>
          <span>{value}</span>
          <span aria-hidden="true" className="filter-chip-x">×</span>
        </button>
      ))}
      <button
        className="filter-chip filter-chip-clear"
        onClick={() => onFilterChange({ ...defaultArchiveFilters, sort: filters.sort })}
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}

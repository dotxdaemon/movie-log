// ABOUTME: Renders the library filter controls as a compact desktop toolbar and a full-height mobile sheet.
// ABOUTME: Keeps every active filter visible as a removable squared chip above the poster grid.
import { defaultArchiveFilters, ratingFilterOptions, type ArchiveFilters } from '../archive-model.js';
import { SheetDialog } from './sheet-dialog.js';

export interface FilterOptions {
  decades: string[];
  directors: string[];
  genres: string[];
  tags: string[];
  watchedYears: number[];
  years: number[];
}

interface FilterControlsProps {
  filters: ArchiveFilters;
  onFilterChange(filters: ArchiveFilters): void;
  options: FilterOptions;
}

const filterLabels: Record<keyof ArchiveFilters, string> = {
  decade: 'Decade',
  director: 'Director',
  favorite: 'Favorite',
  genre: 'Genre',
  mediaType: 'Type',
  rating: 'Rating',
  rewatch: 'Rewatch',
  sort: 'Sort',
  status: 'Status',
  tag: 'Tag',
  watchDate: 'Watch date',
  year: 'Year'
};

function readFilterValueLabel(key: keyof ArchiveFilters, value: string): string {
  if (key === 'watchDate') {
    if (value === 'last-30-days') return 'Last 30 days';
    if (value === 'unwatched') return 'Not watched';
    if (value.startsWith('year:')) return value.slice('year:'.length);
  }

  return value;
}

function FilterControls({ filters, onFilterChange, options }: FilterControlsProps) {
  const change = (key: keyof ArchiveFilters, value: string) => onFilterChange({ ...filters, [key]: value });

  return (
    <>
      <label className="filter-field">
        <span>{filterLabels.sort}</span>
        <select name="sort" onChange={(event) => change('sort', event.target.value)} value={filters.sort}>
          <option value="recent">Recent viewing</option>
          <option value="added">Recently added</option>
          <option value="title">Title</option>
          <option value="rating">Rating</option>
          <option value="year">Release year</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.director}</span>
        <select name="director" onChange={(event) => change('director', event.target.value)} value={filters.director}>
          <option value="all">All</option>
          {options.directors.map((director) => (
            <option key={director}>{director}</option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.genre}</span>
        <select name="genre" onChange={(event) => change('genre', event.target.value)} value={filters.genre}>
          <option value="all">All</option>
          {options.genres.map((genre) => (
            <option key={genre}>{genre}</option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.year}</span>
        <select name="year" onChange={(event) => change('year', event.target.value)} value={filters.year}>
          <option value="all">All</option>
          {options.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.mediaType}</span>
        <select
          name="mediaType"
          onChange={(event) => change('mediaType', event.target.value)}
          value={filters.mediaType}
        >
          <option value="all">All</option>
          <option value="film">Films</option>
          <option value="series">Series</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.decade}</span>
        <select name="decade" onChange={(event) => change('decade', event.target.value)} value={filters.decade}>
          <option value="all">All</option>
          {options.decades.map((decade) => (
            <option key={decade}>{decade}</option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.rating}</span>
        <select name="rating" onChange={(event) => change('rating', event.target.value)} value={filters.rating}>
          {ratingFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.status}</span>
        <select name="status" onChange={(event) => change('status', event.target.value)} value={filters.status}>
          <option value="all">All</option>
          <option value="current">Currently indexed</option>
          <option value="archive">Watched only</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.favorite}</span>
        <select name="favorite" onChange={(event) => change('favorite', event.target.value)} value={filters.favorite}>
          <option value="all">All</option>
          <option value="favorite">Favorite</option>
          <option value="other">Not favorite</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.rewatch}</span>
        <select name="rewatch" onChange={(event) => change('rewatch', event.target.value)} value={filters.rewatch}>
          <option value="all">All</option>
          <option value="rewatched">Rewatched</option>
          <option value="first">First viewings</option>
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.watchDate}</span>
        <select
          name="watchDate"
          onChange={(event) => change('watchDate', event.target.value)}
          value={filters.watchDate}
        >
          <option value="all">Any date</option>
          <option value="last-30-days">Last 30 days</option>
          <option value="unwatched">Not watched</option>
          {options.watchedYears.map((year) => (
            <option key={year} value={`year:${year}`}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>{filterLabels.tag}</span>
        <select name="tag" onChange={(event) => change('tag', event.target.value)} value={filters.tag}>
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
  sheetOpen: boolean;
}

function countActiveFilters(filters: ArchiveFilters): number {
  return (Object.entries(filters) as Array<[keyof ArchiveFilters, string]>).filter(
    ([key, value]) => key !== 'sort' && value !== 'all'
  ).length;
}

export function FilterPanel({ filters, onFilterChange, onSheetOpenChange, options, sheetOpen }: FilterPanelProps) {
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
    </div>
  );
}

interface FilterSheetProps extends FilterControlsProps {
  onApply(filters: ArchiveFilters): void;
  onClose(): void;
  resultCount: number;
}

export function FilterSheet({ filters, onApply, onClose, onFilterChange, options, resultCount }: FilterSheetProps) {
  return (
    <SheetDialog
      backdropClassName="filter-sheet-backdrop"
      eyebrow="Library"
      headClassName="filter-sheet-head"
      label="Library filters"
      onClose={onClose}
      sheetClassName="filter-sheet"
      title="Filters"
    >
      <div className="filter-sheet-body">
        <FilterControls filters={filters} onFilterChange={onFilterChange} options={options} />
      </div>
      <footer className="filter-sheet-actions">
        <button className="command-block" onClick={() => onFilterChange(defaultArchiveFilters)} type="button">
          Reset
        </button>
        <button className="command-block command-block-primary" onClick={() => onApply(filters)} type="button">
          {`Show ${resultCount} ${resultCount === 1 ? 'title' : 'titles'}`}
        </button>
      </footer>
    </SheetDialog>
  );
}

export function ActiveFilterChips({
  filters,
  onFilterChange
}: {
  filters: ArchiveFilters;
  onFilterChange(filters: ArchiveFilters): void;
}) {
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
          <span>{readFilterValueLabel(key, value)}</span>
          <span aria-hidden="true" className="filter-chip-x">
            ×
          </span>
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

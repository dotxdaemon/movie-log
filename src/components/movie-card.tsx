// ABOUTME: Renders one library poster card with status markers, an annotation layer, and selection framing.
// ABOUTME: First activation selects the card structurally; the second opens the film dossier.
import { FilmPoster } from './film-poster.js';
import { readMediaTypeLabel, type ArchiveItem } from '../archive-model.js';

const watchedFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

interface MovieCardProps {
  item: ArchiveItem;
  onOpen(path: string): void;
  onSelect(path: string | null): void;
  selected: boolean;
}

export function MovieCard({ item, onOpen, onSelect, selected }: MovieCardProps) {
  const hasDiary = item.viewings.length > 0;
  const needsReview = hasDiary && !item.reviewed;
  const markers = [
    item.favorite ? 'favorite' : null,
    item.rewatched ? 'rewatched' : null,
    needsReview ? 'review pending' : null
  ].filter(Boolean);
  const cardLabel = [item.displayTitle, item.year === null ? null : String(item.year), ...markers]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={selected ? 'movie-card movie-card-selected' : 'movie-card'} data-path={item.sourcePath}>
      <button
        aria-label={selected ? `Open dossier for ${cardLabel}` : `Select ${cardLabel}`}
        aria-pressed={selected}
        className="movie-card-face"
        onClick={() => (selected ? onOpen(item.sourcePath) : onSelect(item.sourcePath))}
        type="button"
      >
        <span className="movie-card-poster">
          <FilmPoster displayTitle={item.displayTitle} film={item.film} size="card" year={item.year} />
          {item.favorite ? <i aria-hidden="true" className="card-mark-favorite" /> : null}
          {item.rewatched ? <i aria-hidden="true" className="card-mark-rewatch" /> : null}
          <span className="card-annotation">
            <span className="card-full-title">{item.displayTitle}</span>
            <span className="card-annotation-line card-annotation-mono">{readMediaTypeLabel(item)}</span>
            <span className="card-annotation-line">{item.film?.director[0] ?? 'Director —'}</span>
            <span className="card-annotation-line">{item.film?.genres.slice(0, 2).join(' · ') || 'Genre —'}</span>
            {hasDiary ? (
              <span className="card-annotation-line card-annotation-mono">
                {watchedFormatter.format(new Date(item.latestViewing.watchedAt))}
              </span>
            ) : null}
            <span className="card-annotation-open">{selected ? 'Open dossier' : 'Select'}</span>
          </span>
        </span>
        <span className="movie-card-copy">
          <span className="movie-card-title">
            {item.displayTitle}
            {needsReview ? <i aria-hidden="true" className="card-mark-unreviewed" title="Review pending" /> : null}
          </span>
          <span className="media-type-label">{readMediaTypeLabel(item)}</span>
          <span className="movie-card-meta">
            <span className="movie-card-year">{item.year ?? '—'}</span>
            <span className="movie-card-rating">{item.rating === null ? 'NR' : item.rating.toFixed(1)}</span>
            <span className="movie-card-status">
              {hasDiary
                ? watchedFormatter.format(new Date(item.latestViewing.watchedAt))
                : item.current
                  ? 'Indexed'
                  : 'Archived'}
            </span>
          </span>
        </span>
        {selected ? <span className="movie-card-open-action">Open dossier</span> : null}
      </button>
      {markers.length > 0 ? <span className="visually-hidden">{markers.join(', ')}</span> : null}
    </div>
  );
}

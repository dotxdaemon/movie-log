// ABOUTME: Renders real film poster art with a designed geometric plate when artwork is missing.
// ABOUTME: Keeps every poster surface at the original 2:3 ratio across cards, entries, and dossiers.
import type { FilmRecord } from '../../shared/types.js';

interface FilmPosterProps {
  alt?: string;
  displayTitle: string;
  film: FilmRecord | null;
  posterUrl?: string | null;
  size: 'thumb' | 'entry' | 'card' | 'dossier';
  year: number | null;
}

export function FilmPoster({ alt = '', displayTitle, film, posterUrl: posterUrlOverride, size, year }: FilmPosterProps) {
  const posterUrl = posterUrlOverride !== undefined ? posterUrlOverride : film?.posterUrl ?? null;

  return (
    <span className={`film-poster film-poster-${size}`} data-poster={posterUrl ? 'art' : 'plate'}>
      <span aria-hidden="true" className="poster-plate">
        <span className="poster-plate-year">{year ?? '—'}</span>
        <span className="poster-plate-mark">{displayTitle.slice(0, 2).toUpperCase()}</span>
        <span className="poster-plate-seam" />
      </span>
      {posterUrl ? (
        <img
          alt={alt}
          aria-hidden={alt === '' ? true : undefined}
          className="poster-art"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          src={posterUrl}
        />
      ) : null}
    </span>
  );
}

// ABOUTME: Renders real film poster art with a designed geometric plate when artwork is missing.
// ABOUTME: Keeps every poster surface at the original 2:3 ratio across cards, entries, and dossiers.
import type { FilmRecord } from '../../shared/types.js';
import {
  buildPosterSourceSet,
  hasSufficientPosterResolution,
  readPosterSizes,
  type PosterSize
} from '../poster-image.js';

interface FilmPosterProps {
  alt?: string;
  displayTitle: string;
  film: FilmRecord | null;
  posterUrl?: string | null;
  size: PosterSize;
  year: number | null;
}

export function FilmPoster({
  alt = '',
  displayTitle,
  film,
  posterUrl: posterUrlOverride,
  size,
  year
}: FilmPosterProps) {
  const posterUrl = posterUrlOverride !== undefined ? posterUrlOverride : (film?.posterUrl ?? null);
  const posterSourceSet = posterUrl ? buildPosterSourceSet(posterUrl, size) : undefined;

  const revealPosterPlate = (image: HTMLImageElement, reason: 'load-error' | 'low-resolution') => {
    image.style.display = 'none';
    const poster = image.closest<HTMLElement>('.film-poster');
    poster?.setAttribute('data-poster', 'plate');
    poster?.setAttribute('data-poster-quality', reason);
  };

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
          decoding="async"
          fetchPriority={size === 'dossier' ? 'high' : 'auto'}
          loading={size === 'dossier' ? 'eager' : 'lazy'}
          onError={(event) => {
            revealPosterPlate(event.currentTarget, 'load-error');
          }}
          onLoad={(event) => {
            const image = event.currentTarget;

            if (
              !hasSufficientPosterResolution({
                devicePixelRatio: window.devicePixelRatio,
                naturalWidth: image.naturalWidth,
                renderedWidth: image.clientWidth,
                responsive: Boolean(posterSourceSet)
              })
            ) {
              revealPosterPlate(image, 'low-resolution');
            }
          }}
          sizes={readPosterSizes(size)}
          src={posterUrl}
          srcSet={posterSourceSet}
        />
      ) : null}
    </span>
  );
}

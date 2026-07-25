// ABOUTME: Builds responsive poster sources for the catalog image hosts Movie Log already trusts.
// ABOUTME: Rejects undersized artwork before it can replace the dimension-stable poster plate.

export type PosterSize = 'thumb' | 'entry' | 'card' | 'dossier';

const posterWidths: Record<PosterSize, number[]> = {
  thumb: [120, 250],
  entry: [120, 250],
  card: [250, 500, 960],
  dossier: [330, 500, 960]
};

const posterSizes: Record<PosterSize, string> = {
  thumb: '46px',
  entry: '68px',
  card: '(max-width: 520px) 31vw, (max-width: 1179px) 150px, 190px',
  dossier: '(max-width: 700px) 130px, 400px'
};

function buildImdbVariant(source: URL, width: number): string | null {
  if (source.hostname !== 'm.media-amazon.com' || !/\._V1_[^.]*\.(?:jpe?g|png)$/i.test(source.pathname)) {
    return null;
  }

  source.pathname = source.pathname.replace(/(\._V1_)[^.]*(\.(?:jpe?g|png))$/i, `$1SX${width}$2`);
  return source.toString();
}

export function buildPosterSourceSet(posterUrl: string, size: PosterSize): string | undefined {
  let source: URL;

  try {
    source = new URL(posterUrl);
  } catch {
    return undefined;
  }

  const variants = posterWidths[size]
    .map((width) => {
      const variant = buildImdbVariant(new URL(source), width);
      return variant ? `${variant} ${width}w` : null;
    })
    .filter(Boolean);

  return variants.length === posterWidths[size].length ? (variants as string[]).join(', ') : undefined;
}

export function readPosterSizes(size: PosterSize): string {
  return posterSizes[size];
}

export function hasSufficientPosterResolution({
  devicePixelRatio,
  naturalWidth,
  renderedWidth,
  responsive
}: {
  devicePixelRatio: number;
  naturalWidth: number;
  renderedWidth: number;
  responsive: boolean;
}): boolean {
  const density = Math.min(Math.max(devicePixelRatio, 1), 2);
  const availablePixels = responsive ? naturalWidth * density : naturalWidth;
  return availablePixels + 1 >= renderedWidth * density;
}

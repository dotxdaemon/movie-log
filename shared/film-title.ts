// ABOUTME: Parses clean film titles and release years out of media filename stems and folder names.
// ABOUTME: Keeps display titles, film identity keys, and catalog source paths deterministic across the app.

export interface ParsedFilmTitle {
  title: string;
  year: number | null;
}

const FILM_SOURCE_PREFIX = 'film://';

const junkTokens = new Set([
  '4k',
  'uhd',
  'hd',
  'sd',
  'bluray',
  'blu',
  'ray',
  'bdrip',
  'brrip',
  'webrip',
  'webdl',
  'web',
  'dl',
  'hdrip',
  'dvdrip',
  'dvdscr',
  'hdtv',
  'amzn',
  'nf',
  'hulu',
  'atvp',
  'dsnp',
  'max',
  'hmax',
  'itunes',
  'remux',
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'avc',
  'av1',
  'xvid',
  'divx',
  'hdr',
  'hdr10',
  'dovi',
  'dolby',
  'vision',
  'atmos',
  'ddp',
  'dd',
  'dts',
  'truehd',
  'aac',
  'ac3',
  'eac3',
  'flac',
  'opus',
  'mp3',
  'proper',
  'repack',
  'internal',
  'limited',
  'remastered',
  'criterion',
  'extended',
  'unrated',
  'theatrical',
  'imax',
  'multi',
  'dual',
  'subbed',
  'dubbed',
  'vostfr'
]);

function isJunkToken(token: string): boolean {
  const bare =
    token
      .split(/[^a-z0-9]+/i)
      .filter(Boolean)[0]
      ?.toLowerCase() ?? '';

  if (!bare) {
    return true;
  }

  return junkTokens.has(bare) || /^\d{3,4}p$/.test(bare) || /^\d{1,2}bit$/.test(bare) || /^[hx]26[45]$/.test(bare);
}

function isYearToken(token: string): boolean {
  return /^(?:19|20)\d{2}$/.test(token);
}

function cleanEnds(value: string): string {
  return value.replace(/^[\s\-–—:]+|[\s\-–—:.]+$/g, '').replace(/\s+/g, ' ');
}

function decodeReleaseName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanTitle(value: string): string {
  const withoutReleaseGroup = cleanEnds(value).replace(/^(?:\[[^\]]+\]\s*)+/g, '');
  const withoutAlternateTitle = withoutReleaseGroup.replace(/\s+AKA\s+.+$/i, '');
  const withoutEditionTail = withoutAlternateTitle.replace(/\s+(?:DC|Director'?s Cut)$/i, '');
  const articleAtEnd = withoutEditionTail.match(/^(.*),\s*(The|A|An)$/i);

  if (articleAtEnd) {
    return cleanEnds(`${articleAtEnd[2]} ${articleAtEnd[1]}`);
  }

  return cleanEnds(withoutEditionTail);
}

export function readCatalogMediaType(stem: string): 'film' | 'series' {
  return /\bS\d{1,2}\s?E\d{1,3}\b/i.test(decodeReleaseName(stem)) ? 'series' : 'film';
}

export function parseFilmTitle(stem: string): ParsedFilmTitle {
  const decodedStem = decodeReleaseName(stem);
  const spaced = decodedStem.replace(/[._]+/g, ' ');
  const normalized = spaced.replace(/\s+/g, ' ').trim();
  const parenYear = [...normalized.matchAll(/\(((?:19|20)\d{2})\)/g)].at(-1);

  if (parenYear && typeof parenYear.index === 'number') {
    const title = cleanTitle(normalized.slice(0, parenYear.index));
    return { title: title || parenYear[1], year: Number(parenYear[1]) };
  }

  const episodeMark = normalized.match(/\bS\d{1,2}\s?E\d{1,3}\b/i);
  const scope =
    episodeMark && typeof episodeMark.index === 'number' ? normalized.slice(0, episodeMark.index) : normalized;
  const tokens = cleanEnds(scope).split(' ').filter(Boolean);
  let yearIndex = -1;

  for (let index = tokens.length - 1; index > 0; index -= 1) {
    if (isYearToken(tokens[index] as string)) {
      yearIndex = index;
      break;
    }
  }

  if (yearIndex > 0) {
    return { title: cleanTitle(tokens.slice(0, yearIndex).join(' ')), year: Number(tokens[yearIndex]) };
  }

  const junkIndex = tokens.findIndex((token, index) => index > 0 && isJunkToken(token));
  const title = cleanTitle((junkIndex > 0 ? tokens.slice(0, junkIndex) : tokens).join(' '));
  return { title: title || normalized, year: null };
}

export function formatFilmTitle(parsed: ParsedFilmTitle): string {
  return parsed.year === null ? parsed.title : `${parsed.title} (${parsed.year})`;
}

export function readFilmKey(parsed: ParsedFilmTitle): string {
  const normalizedTitle = parsed.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `${normalizedTitle}::${parsed.year ?? ''}`;
}

export function buildFilmSourcePath(
  parsed: ParsedFilmTitle,
  pageId: number,
  source: 'imdb' | 'wikipedia' = 'wikipedia',
  catalogId?: string
): string {
  const identity = source === 'imdb' ? (catalogId ?? `tt${Math.abs(pageId)}`) : String(pageId);
  return `${FILM_SOURCE_PREFIX}${source}-${identity}/${formatFilmTitle(parsed)}`;
}

export function isFilmSourcePath(sourcePath: string): boolean {
  return sourcePath.startsWith(FILM_SOURCE_PREFIX);
}

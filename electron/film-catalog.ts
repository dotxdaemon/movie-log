// ABOUTME: Looks up film posters, credits, and technical metadata from Wikipedia and Wikidata.
// ABOUTME: Keeps request shaping and response mapping injectable so catalog logic tests run offline.
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import { dossierPosterMinimumWidth } from '../shared/poster-policy.js';
import type { CatalogSearchResult, FilmDetails } from '../shared/types.js';

export interface FilmCatalog {
  fetchFilmDetails(pageId: number, options?: CatalogRequestOptions): Promise<FilmDetails | null>;
  searchFilms(query: string, options?: CatalogRequestOptions): Promise<CatalogSearchResult[]>;
  searchPosterFallback?(query: string, options?: CatalogRequestOptions): Promise<CatalogSearchResult[]>;
}

export interface CatalogRequestOptions {
  includeCredits?: boolean;
  signal?: AbortSignal;
}

export async function searchCatalogProviders(
  catalog: Pick<FilmCatalog, 'searchFilms' | 'searchPosterFallback'>,
  query: string,
  options: CatalogRequestOptions = {}
): Promise<CatalogSearchResult[]> {
  let primaryFailure: unknown;

  try {
    const results = await catalog.searchFilms(query, options);

    if (results.length > 0) {
      return results;
    }
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    primaryFailure = error;
  }

  try {
    const fallbackResults = (await catalog.searchPosterFallback?.(query, options)) ?? [];

    if (fallbackResults.length > 0) {
      return fallbackResults;
    }
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    primaryFailure ??= error;
  }

  if (primaryFailure) {
    throw primaryFailure;
  }

  return [];
}

interface SearchPage {
  description?: string;
  index?: number;
  pageid: number;
  pageprops?: { wikibase_item?: string };
  thumbnail?: { height?: number; source?: string; width?: number };
  title: string;
}

interface DetailPage extends SearchPage {
  fullurl?: string;
}

interface WikidataSnak {
  mainsnak?: { datavalue?: { value?: { amount?: string; id?: string; time?: string } } };
}

interface ClaimsPayload {
  entities?: Record<string, { claims?: Record<string, WikidataSnak[]> }>;
}

interface LabelsPayload {
  entities?: Record<string, { labels?: { en?: { value?: string } } }>;
}

interface ImdbImage {
  countries?: ImdbImageTag[];
  height?: number;
  id?: string;
  languages?: ImdbImageTag[];
  type?: string;
  url?: string;
  width?: number;
}

interface ImdbImageTag {
  id?: string;
  text?: string;
}

interface ImdbTitlePayload {
  data?: Record<
    string,
    {
      credits?: { edges?: Array<{ node?: { name?: { nameText?: { text?: string } } } }> };
      images?: { edges?: Array<{ node?: ImdbImage }> };
      primaryImage?: ImdbImage;
    }
  >;
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const IMDB_SUGGESTION_API = 'https://v2.sg.media-imdb.com/suggestion/x';
const IMDB_GRAPHQL_API = 'https://api.graphql.imdb.com/';

async function fetchJsonFromNetwork(url: string, options: CatalogRequestOptions = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MovieLog/0.1 (personal desktop film diary)' },
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Catalog request failed with status ${response.status}.`);
  }

  return response.json();
}

async function fetchImdbTitleJsonFromNetwork(
  catalogIds: string[],
  options: CatalogRequestOptions = {}
): Promise<unknown> {
  const variableDefinitions = catalogIds.map((_catalogId, index) => `$id${index}: ID!`).join(', ');
  const titleSelections = catalogIds
    .map(
      (_catalogId, index) => `title${index}: title(id: $id${index}) {
        credits(first: 8, filter: { categories: ["director"] }) {
          edges { node { name { nameText { text } } } }
        }
        primaryImage {
          countries { id text }
          height
          id
          languages { id text }
          url
          width
        }
        images(first: 20, filter: { types: ["poster"] }) {
          edges {
            node {
              countries { id text }
              height
              id
              languages { id text }
              type
              url
              width
            }
          }
        }
      }`
    )
    .join('\n');
  const response = await fetch(IMDB_GRAPHQL_API, {
    body: JSON.stringify({
      query: `query MovieLogTitles(${variableDefinitions}) { ${titleSelections} }`,
      variables: Object.fromEntries(catalogIds.map((catalogId, index) => [`id${index}`, catalogId]))
    }),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://www.imdb.com',
      Referer: 'https://www.imdb.com/',
      'x-imdb-user-country': 'US',
      'x-imdb-user-language': 'en-US',
      'User-Agent': 'MovieLog/0.1 (personal desktop film diary)'
    },
    method: 'POST',
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`IMDb title request failed with status ${response.status}.`);
  }

  return response.json();
}

function readPages(payload: unknown): SearchPage[] {
  const pages = (payload as { query?: { pages?: Record<string, SearchPage> } }).query?.pages ?? {};
  return Object.values(pages);
}

function readPosterUrl(page: SearchPage): string | null {
  const source = page.thumbnail?.source;
  const width = page.thumbnail?.width;
  const height = page.thumbnail?.height;

  if (!source) {
    return null;
  }

  if (typeof width === 'number' && typeof height === 'number' && height < width * 1.1) {
    return null;
  }

  return source;
}

function readTitleYear(page: SearchPage): { title: string; year: number | null } {
  const disambiguation = page.title.match(
    /^(.*?)\s*\(([^)]*(?:film|miniseries|television series|TV series|anime)[^)]*)\)$/i
  );
  const baseTitle = disambiguation ? (disambiguation[1] as string) : page.title;
  const disambiguationYearText = disambiguation?.[2]?.match(/\b((?:19|20)\d{2})\b/)?.[1];
  const disambiguationYear = disambiguationYearText ? Number(disambiguationYearText) : null;
  const descriptionYear = page.description?.match(/\b((?:19|20)\d{2})\b/)?.[1];

  return {
    title: baseTitle,
    year: disambiguationYear ?? (descriptionYear ? Number(descriptionYear) : null)
  };
}

function readCatalogMediaType(value: string): 'film' | 'series' | undefined {
  const normalized = value.toLowerCase();

  if (/\b(?:anime|television|tv|web) (?:series|sitcom|drama|program)\b|\bminiseries\b/.test(normalized)) {
    return 'series';
  }

  return /\b(?:film|movie)\b/.test(normalized) ? 'film' : undefined;
}

export function readSearchResults(payload: unknown): CatalogSearchResult[] {
  return readPages(payload)
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((page) => {
      const { title, year } = readTitleYear(page);
      const mediaType = readCatalogMediaType(`${page.title} ${page.description ?? ''}`);

      return {
        catalogId: String(page.pageid),
        catalogSource: 'wikipedia',
        description: page.description ?? '',
        ...(mediaType ? { mediaType } : {}),
        pageId: page.pageid,
        posterUrl: readPosterUrl(page),
        title,
        year
      };
    });
}

interface ImdbSuggestion {
  i?: { height?: number; imageUrl?: string; width?: number };
  id?: string;
  l?: string;
  q?: string;
  y?: number;
}

export function readImdbPosterResults(payload: unknown): CatalogSearchResult[] {
  const suggestions = (payload as { d?: ImdbSuggestion[] }).d ?? [];

  return suggestions.flatMap((suggestion, catalogRank) => {
    const source = suggestion.i?.imageUrl;
    const width = suggestion.i?.width;
    const height = suggestion.i?.height;
    const identifier = suggestion.id;
    const title = suggestion.l;
    const category = (suggestion.q?.toLowerCase() ?? '').replace(/[^a-z0-9]+/g, ' ').trim();
    const isSeries = category.includes('tv series') || category.includes('tv mini series');
    const isFilm = category === 'feature' || category.includes('movie');

    if (
      !identifier?.startsWith('tt') ||
      !title ||
      !source ||
      (!isFilm && !isSeries) ||
      (typeof width === 'number' && typeof height === 'number' && height < width * 1.1)
    ) {
      return [];
    }

    const numericId = Number(identifier.slice(2));

    return [
      {
        catalogId: identifier,
        catalogRank,
        catalogSource: 'imdb' as const,
        description: isSeries ? 'Television series' : 'Feature film',
        mediaType: isSeries ? ('series' as const) : ('film' as const),
        pageId: Number.isSafeInteger(numericId) ? -numericId : -1,
        posterUrl: source,
        posterWidth: width,
        title,
        year: typeof suggestion.y === 'number' ? suggestion.y : null
      }
    ];
  });
}

function enrichImdbResults(payload: unknown, results: CatalogSearchResult[]): CatalogSearchResult[] {
  if (((payload as { errors?: unknown[] }).errors?.length ?? 0) > 0) {
    throw new Error('IMDb title details returned an incomplete response.');
  }

  const titles = (payload as ImdbTitlePayload).data ?? {};

  return results.map((result, index) => {
    const title = titles[`title${index}`];
    const directors = [
      ...new Set(
        (title?.credits?.edges ?? []).map((edge) => edge.node?.name?.nameText?.text?.trim() ?? '').filter(Boolean)
      )
    ];
    const readPortraitImage = (
      image: ImdbImage | undefined
    ): image is Required<Pick<ImdbImage, 'height' | 'url' | 'width'>> & ImdbImage =>
      typeof image?.url === 'string' &&
      typeof image.width === 'number' &&
      typeof image.height === 'number' &&
      image.height >= image.width * 1.1;
    const galleryPosters = (title?.images?.edges ?? []).map((edge) => edge.node).filter(readPortraitImage);
    const primaryPoster = readPortraitImage(title?.primaryImage) ? title.primaryImage : undefined;
    const candidates = [primaryPoster, ...galleryPosters]
      .filter((image): image is Required<Pick<ImdbImage, 'height' | 'url' | 'width'>> & ImdbImage => Boolean(image))
      .filter(
        (image, candidateIndex, images) =>
          images.findIndex((candidate) => candidate.id === image.id && candidate.url === image.url) === candidateIndex
      );
    const readLocaleRank = (image: ImdbImage): number => {
      const isEnglish = image.languages?.some((language) => language.id === 'en') ?? false;
      const isUnitedStates = image.countries?.some((country) => country.id === 'US') ?? false;
      const hasLocaleTags = (image.languages?.length ?? 0) > 0 || (image.countries?.length ?? 0) > 0;

      if (isEnglish && isUnitedStates) {
        return 4;
      }

      if (isEnglish) {
        return 3;
      }

      if (isUnitedStates) {
        return 2;
      }

      return hasLocaleTags ? 0 : 1;
    };
    const poster = candidates
      .filter((image) => readLocaleRank(image) >= 2)
      .sort((left, right) => {
        const localeDifference = readLocaleRank(right) - readLocaleRank(left);

        if (localeDifference !== 0) {
          return localeDifference;
        }

        const primaryDifference = Number(right === primaryPoster) - Number(left === primaryPoster);
        return primaryDifference !== 0 ? primaryDifference : right.width - left.width;
      })[0];
    const titleLookupComplete = Boolean(title);
    const posterWidth = titleLookupComplete ? poster?.width : result.posterWidth;

    return {
      ...result,
      director: directors,
      posterLookupComplete:
        titleLookupComplete &&
        (poster === undefined || (typeof posterWidth === 'number' && posterWidth >= dossierPosterMinimumWidth)),
      posterUrl: titleLookupComplete ? (poster?.url ?? null) : result.posterUrl,
      posterWidth
    };
  });
}

export function chooseFilmMatch(
  results: CatalogSearchResult[],
  film: { mediaType?: 'film' | 'series'; title: string; year: number | null }
): CatalogSearchResult | null {
  const wantedKey = readFilmKey({ title: film.title, year: null }).split('::')[0];
  const readResultKey = (result: CatalogSearchResult) =>
    readFilmKey({ title: result.title.replace(/(?::|\s)\s*The Movie$/i, ''), year: null }).split('::')[0] as string;
  const readDistance = (left: string, right: string): number => {
    const rows = Array.from({ length: left.length + 1 }, (_value, index) => index);

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      let diagonal = rows[0] as number;
      rows[0] = rightIndex;

      for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const above = rows[leftIndex] as number;
        rows[leftIndex] = Math.min(
          above + 1,
          (rows[leftIndex - 1] as number) + 1,
          diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
        );
        diagonal = above;
      }
    }

    return rows[left.length] as number;
  };
  const wantedMediaType = film.mediaType ?? 'film';
  const matchesMediaType = (result: CatalogSearchResult) => {
    if (result.mediaType) {
      return result.mediaType === wantedMediaType;
    }

    const description = result.description.toLowerCase();
    const series = /\b(?:anime|television|tv|web) (?:series|sitcom|drama|program)\b|\bminiseries\b/.test(description);
    const movie = /\bfilm\b/.test(description);

    if (wantedMediaType === 'series') {
      return series && !movie;
    }

    return movie && !series;
  };
  const mediaResults = results.filter(matchesMediaType);
  let titleMatches = mediaResults.filter((result) => readResultKey(result) === wantedKey);

  if (titleMatches.length === 0 && film.year !== null) {
    titleMatches = mediaResults.filter(
      (result) => result.year === film.year && readDistance(readResultKey(result), wantedKey) <= 1
    );
  }

  if (titleMatches.length === 0 && wantedMediaType === 'series') {
    titleMatches = mediaResults.filter((result) => {
      const resultKey = readResultKey(result);
      return resultKey.length >= 5 && (wantedKey.startsWith(`${resultKey} `) || resultKey.startsWith(`${wantedKey} `));
    });
  }

  if (titleMatches.length === 0 && film.year !== null) {
    titleMatches = mediaResults.filter(
      (result) => result.catalogSource === 'imdb' && result.catalogRank === 0 && result.year === film.year
    );
  }

  if (titleMatches.length === 0) {
    return null;
  }

  if (film.year === null) {
    return titleMatches[0] ?? null;
  }

  return (
    titleMatches.find((result) => result.year === film.year) ??
    titleMatches.find((result) => result.year === null) ??
    null
  );
}

function readClaimIds(
  claims: Record<string, WikidataSnak[]>,
  property: string,
  limit = Number.POSITIVE_INFINITY
): string[] {
  const ids: string[] = [];

  for (const snak of claims[property] ?? []) {
    const id = snak.mainsnak?.datavalue?.value?.id;

    if (id && !ids.includes(id)) {
      ids.push(id);
    }

    if (ids.length >= limit) {
      break;
    }
  }

  return ids;
}

function readGenreLabel(label: string): string {
  const trimmed = label.replace(/\s+film$/i, '').trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : label;
}

export function createFilmCatalog(
  options: {
    fetchJson?: (url: string, options?: CatalogRequestOptions) => Promise<unknown>;
    fetchImdbTitleJson?: (catalogIds: string[], options?: CatalogRequestOptions) => Promise<unknown>;
    fetchPosterJson?: (url: string, options?: CatalogRequestOptions) => Promise<unknown>;
    requestTimeoutMs?: number;
  } = {}
): FilmCatalog {
  const fetchJson = options.fetchJson ?? fetchJsonFromNetwork;
  const fetchImdbTitleJson = options.fetchImdbTitleJson ?? fetchImdbTitleJsonFromNetwork;
  const fetchPosterJson = options.fetchPosterJson ?? fetchJsonFromNetwork;
  const requestTimeoutMs = options.requestTimeoutMs ?? 8000;

  async function requestJson(url: string, requestOptions: CatalogRequestOptions = {}): Promise<unknown> {
    if (requestOptions.signal?.aborted) {
      throw new Error('Catalog request was cancelled.');
    }

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let rejectCancellation: ((error: Error) => void) | undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancellation = reject;
    });
    const cancel = () => {
      rejectCancellation?.(new Error('Catalog request was cancelled.'));
      controller.abort();
    };
    requestOptions.signal?.addEventListener('abort', cancel, { once: true });

    try {
      const timedOut = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Catalog request timed out.'));
          controller.abort();
        }, requestTimeoutMs);
      });
      return await Promise.race([fetchJson(url, { signal: controller.signal }), timedOut, cancellation]);
    } finally {
      clearTimeout(timeout);
      requestOptions.signal?.removeEventListener('abort', cancel);
    }
  }

  async function searchFilms(
    query: string,
    requestOptions: CatalogRequestOptions = {}
  ): Promise<CatalogSearchResult[]> {
    const parameters = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrlimit: '8',
      gsrsearch: query,
      pilicense: 'any',
      piprop: 'thumbnail',
      pithumbsize: '400',
      ppprop: 'wikibase_item',
      prop: 'pageimages|pageprops|description'
    });

    const payload = await requestJson(`${WIKIPEDIA_API}?${parameters}`, requestOptions);
    const pages = readPages(payload);
    const entityIds =
      requestOptions.includeCredits === false
        ? []
        : (pages.map((page) => page.pageprops?.wikibase_item).filter(Boolean) as string[]);
    const directorsByEntity = new Map<string, string[]>();

    if (entityIds.length > 0) {
      const claimsPayload = (await requestJson(
        `${WIKIDATA_API}?${new URLSearchParams({
          action: 'wbgetentities',
          format: 'json',
          ids: entityIds.join('|'),
          props: 'claims'
        })}`,
        requestOptions
      )) as ClaimsPayload;
      const directorIdsByEntity = new Map(
        entityIds.map((entityId) => [entityId, readClaimIds(claimsPayload.entities?.[entityId]?.claims ?? {}, 'P57')])
      );
      const directorIds = [...new Set([...directorIdsByEntity.values()].flat())];
      let directorLabels: Record<string, string> = {};

      if (directorIds.length > 0) {
        const labelsPayload = (await requestJson(
          `${WIKIDATA_API}?${new URLSearchParams({
            action: 'wbgetentities',
            format: 'json',
            ids: directorIds.join('|'),
            languages: 'en',
            props: 'labels'
          })}`,
          requestOptions
        )) as LabelsPayload;
        directorLabels = Object.fromEntries(
          Object.entries(labelsPayload.entities ?? {}).map(([id, entity]) => [id, entity.labels?.en?.value ?? ''])
        );
      }

      for (const [entityId, directorIdsForEntity] of directorIdsByEntity) {
        directorsByEntity.set(entityId, directorIdsForEntity.map((id) => directorLabels[id] ?? '').filter(Boolean));
      }
    }

    const entityByPageId = new Map(pages.map((page) => [page.pageid, page.pageprops?.wikibase_item]));
    return readSearchResults(payload).map((result) => ({
      ...result,
      director: directorsByEntity.get(entityByPageId.get(result.pageId) ?? '') ?? []
    }));
  }

  async function searchPosterFallback(
    query: string,
    requestOptions: CatalogRequestOptions = {}
  ): Promise<CatalogSearchResult[]> {
    const normalizedQuery = query.replace(/\s+(?:film|TV series)\s*$/i, '').trim();
    const slug = encodeURIComponent(normalizedQuery.replace(/\s+/g, '_'));
    const payload = await fetchPosterJson(`${IMDB_SUGGESTION_API}/${slug}.json`, requestOptions);
    let results = readImdbPosterResults(payload);

    if (results.length === 0) {
      return results;
    }

    try {
      results = enrichImdbResults(
        await fetchImdbTitleJson(
          results.map((result) => result.catalogId).filter((catalogId): catalogId is string => Boolean(catalogId)),
          requestOptions
        ),
        results
      );
    } catch (error) {
      if (requestOptions.signal?.aborted) {
        throw error;
      }

      results = results.map((result) => ({
        ...result,
        posterLookupComplete: false,
        posterUrl: null,
        posterWidth: undefined
      }));
    }

    if (requestOptions.includeCredits === false || results.every((result) => (result.director?.length ?? 0) > 0)) {
      return results;
    }

    try {
      const wikipediaResults = await searchFilms(normalizedQuery, requestOptions);

      return results.map((result) => {
        const wikipediaMatch = chooseFilmMatch(wikipediaResults, {
          mediaType: result.mediaType,
          title: result.title,
          year: result.year
        });

        return {
          ...result,
          director:
            (result.director?.length ?? 0) > 0 ? [...(result.director ?? [])] : [...(wikipediaMatch?.director ?? [])]
        };
      });
    } catch (error) {
      if (requestOptions.signal?.aborted) {
        throw error;
      }

      return results.map((result) => ({ ...result, director: [...(result.director ?? [])] }));
    }
  }

  async function fetchFilmDetails(
    pageId: number,
    requestOptions: CatalogRequestOptions = {}
  ): Promise<FilmDetails | null> {
    const pageParameters = new URLSearchParams({
      action: 'query',
      format: 'json',
      inprop: 'url',
      pageids: String(pageId),
      pilicense: 'any',
      piprop: 'thumbnail',
      pithumbsize: '640',
      ppprop: 'wikibase_item',
      prop: 'pageimages|pageprops|info'
    });
    const page = readPages(await requestJson(`${WIKIPEDIA_API}?${pageParameters}`, requestOptions))[0] as
      DetailPage | undefined;

    if (!page) {
      return null;
    }

    const entityId = page.pageprops?.wikibase_item;
    let claims: Record<string, WikidataSnak[]> = {};

    if (entityId) {
      const claimsPayload = (await requestJson(
        `${WIKIDATA_API}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', ids: entityId, props: 'claims' })}`,
        requestOptions
      )) as ClaimsPayload;
      claims = claimsPayload.entities?.[entityId]?.claims ?? {};
    }

    const directorIds = readClaimIds(claims, 'P57');
    const castIds = readClaimIds(claims, 'P161', 8);
    const countryIds = readClaimIds(claims, 'P495');
    const languageIds = readClaimIds(claims, 'P364', 3);
    const genreIds = readClaimIds(claims, 'P136', 4);
    const referencedIds = [...new Set([...directorIds, ...castIds, ...countryIds, ...languageIds, ...genreIds])];
    let labels: Record<string, string> = {};

    if (referencedIds.length > 0) {
      const labelsPayload = (await requestJson(
        `${WIKIDATA_API}?${new URLSearchParams({
          action: 'wbgetentities',
          format: 'json',
          ids: referencedIds.join('|'),
          languages: 'en',
          props: 'labels'
        })}`,
        requestOptions
      )) as LabelsPayload;
      labels = Object.fromEntries(
        Object.entries(labelsPayload.entities ?? {}).map(([id, entity]) => [id, entity.labels?.en?.value ?? ''])
      );
    }

    const readLabels = (ids: string[]): string[] => ids.map((id) => labels[id] ?? '').filter(Boolean);
    const runtimeAmount = claims.P2047?.[0]?.mainsnak?.datavalue?.value?.amount;
    const publishedTime = claims.P577?.[0]?.mainsnak?.datavalue?.value?.time;
    const yearFromTitle = parseFilmTitle(page.title).year;

    return {
      cast: readLabels(castIds),
      country: readLabels(countryIds),
      director: readLabels(directorIds),
      genres: readLabels(genreIds).map(readGenreLabel),
      language: readLabels(languageIds),
      pageId,
      posterUrl: readPosterUrl(page),
      runtimeMinutes: runtimeAmount ? Math.round(Number(runtimeAmount.replace('+', ''))) : null,
      wikipediaUrl: page.fullurl ?? null,
      year: publishedTime ? Number(publishedTime.slice(1, 5)) : yearFromTitle
    };
  }

  return { fetchFilmDetails, searchFilms, searchPosterFallback };
}

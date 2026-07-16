// ABOUTME: Looks up film posters, credits, and technical metadata from Wikipedia and Wikidata.
// ABOUTME: Keeps request shaping and response mapping injectable so catalog logic tests run offline.
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import type { CatalogSearchResult, FilmDetails } from '../shared/types.js';

export interface FilmCatalog {
  fetchFilmDetails(pageId: number, options?: CatalogRequestOptions): Promise<FilmDetails | null>;
  searchFilms(query: string, options?: CatalogRequestOptions): Promise<CatalogSearchResult[]>;
}

export interface CatalogRequestOptions {
  signal?: AbortSignal;
}

interface SearchPage {
  description?: string;
  index?: number;
  pageid: number;
  pageprops?: { wikibase_item?: string };
  thumbnail?: { source?: string };
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

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

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

function readPages(payload: unknown): SearchPage[] {
  const pages = (payload as { query?: { pages?: Record<string, SearchPage> } }).query?.pages ?? {};
  return Object.values(pages);
}

function readTitleYear(page: SearchPage): { title: string; year: number | null } {
  const disambiguation = page.title.match(/^(.*?)\s*\(((?:19|20)\d{2})?\s?(?:film|miniseries|TV series)\)$/i);
  const baseTitle = disambiguation ? (disambiguation[1] as string) : page.title;
  const disambiguationYear = disambiguation?.[2] ? Number(disambiguation[2]) : null;
  const descriptionYear = page.description?.match(/\b((?:19|20)\d{2})\b/)?.[1];

  return {
    title: baseTitle,
    year: disambiguationYear ?? (descriptionYear ? Number(descriptionYear) : null)
  };
}

export function readSearchResults(payload: unknown): CatalogSearchResult[] {
  return readPages(payload)
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((page) => {
      const { title, year } = readTitleYear(page);

      return {
        description: page.description ?? '',
        pageId: page.pageid,
        posterUrl: page.thumbnail?.source ?? null,
        title,
        year
      };
    });
}

export function chooseFilmMatch(
  results: CatalogSearchResult[],
  film: { title: string; year: number | null }
): CatalogSearchResult | null {
  const wantedKey = readFilmKey({ title: film.title, year: null }).split('::')[0];
  const titleMatches = results.filter(
    (result) => readFilmKey({ title: result.title, year: null }).split('::')[0] === wantedKey
  );

  if (titleMatches.length === 0) {
    return null;
  }

  if (film.year === null) {
    return titleMatches[0] ?? null;
  }

  return (
    titleMatches.find((result) => result.year !== null && Math.abs(result.year - (film.year as number)) <= 1) ??
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
    requestTimeoutMs?: number;
  } = {}
): FilmCatalog {
  const fetchJson = options.fetchJson ?? fetchJsonFromNetwork;
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
    const entityIds = pages.map((page) => page.pageprops?.wikibase_item).filter(Boolean) as string[];
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
      posterUrl: page.thumbnail?.source ?? null,
      runtimeMinutes: runtimeAmount ? Math.round(Number(runtimeAmount.replace('+', ''))) : null,
      wikipediaUrl: page.fullurl ?? null,
      year: publishedTime ? Number(publishedTime.slice(1, 5)) : yearFromTitle
    };
  }

  return { fetchFilmDetails, searchFilms };
}

// ABOUTME: Looks up film posters, credits, and technical metadata from Wikipedia and Wikidata.
// ABOUTME: Keeps request shaping and response mapping injectable so catalog logic tests run offline.
import { parseFilmTitle, readFilmKey } from '../shared/film-title.js';
import type { CatalogSearchResult, FilmDetails } from '../shared/types.js';

export interface FilmCatalog {
  fetchFilmDetails(pageId: number): Promise<FilmDetails | null>;
  searchFilms(query: string): Promise<CatalogSearchResult[]>;
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

async function fetchJsonFromNetwork(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { 'User-Agent': 'MovieLog/0.1 (personal desktop film diary)' } });

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

function readClaimIds(claims: Record<string, WikidataSnak[]>, property: string, limit = Number.POSITIVE_INFINITY): string[] {
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

export function createFilmCatalog(options: { fetchJson?: (url: string) => Promise<unknown> } = {}): FilmCatalog {
  const fetchJson = options.fetchJson ?? fetchJsonFromNetwork;

  async function searchFilms(query: string): Promise<CatalogSearchResult[]> {
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

    return readSearchResults(await fetchJson(`${WIKIPEDIA_API}?${parameters}`));
  }

  async function fetchFilmDetails(pageId: number): Promise<FilmDetails | null> {
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
    const page = readPages(await fetchJson(`${WIKIPEDIA_API}?${pageParameters}`))[0] as DetailPage | undefined;

    if (!page) {
      return null;
    }

    const entityId = page.pageprops?.wikibase_item;
    let claims: Record<string, WikidataSnak[]> = {};

    if (entityId) {
      const claimsPayload = (await fetchJson(
        `${WIKIDATA_API}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', ids: entityId, props: 'claims' })}`
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
      const labelsPayload = (await fetchJson(
        `${WIKIDATA_API}?${new URLSearchParams({
          action: 'wbgetentities',
          format: 'json',
          ids: referencedIds.join('|'),
          languages: 'en',
          props: 'labels'
        })}`
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

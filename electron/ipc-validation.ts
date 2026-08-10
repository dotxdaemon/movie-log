// ABOUTME: Validates values crossing from the renderer into privileged Electron IPC handlers.
// ABOUTME: Returns narrow copies so forged object fields cannot alter persisted history or catalog identity.
import { isAbsolute } from 'node:path';
import type { CatalogSearchResult, LogEntryDetails, LogFilmRequest } from '../shared/types.js';

const identifierLimit = 16_384;
const pathLimit = 32_768;
const searchLimit = 500;
const titleLimit = 500;
const annotationLimit = 2_000;
const shortAnnotationLimit = 240;
const tagLimit = 100;
const tagCountLimit = 50;

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string, limit: number, allowEmpty = false): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be text.`);
  }

  if (value.includes('\0')) {
    throw new TypeError(`${label} cannot contain a null byte.`);
  }

  if ((!allowEmpty && value.trim().length === 0) || value.length > limit) {
    throw new TypeError(`${label} must contain ${allowEmpty ? `at most ${limit}` : `1 to ${limit}`} characters.`);
  }

  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  label: string,
  limit: number
): string | undefined {
  const value = record[key];
  return value === undefined ? undefined : readString(value, label, limit, true);
}

function readOptionalBoolean(record: Record<string, unknown>, key: string, label: string): boolean | undefined {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be true or false.`);
  }

  return value;
}

function readOptionalYear(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  const latestSupportedYear = new Date().getUTCFullYear() + 10;
  if (!Number.isSafeInteger(value) || (value as number) < 1800 || (value as number) > latestSupportedYear) {
    throw new TypeError(`Film year must be null or an integer from 1800 to ${latestSupportedYear}.`);
  }

  return value as number;
}

function readOptionalUrl(value: unknown, label: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const url = readString(value, label, 4_096);

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new TypeError();
    }
  } catch {
    throw new TypeError(`${label} must be an HTTP or HTTPS URL.`);
  }

  return url;
}

function readOptionalDirectors(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length > 100) {
    throw new TypeError('Film directors must be an array with at most 100 names.');
  }

  return value.map((director) => readString(director, 'Film director', titleLimit));
}

function readCatalogSource(value: unknown): 'imdb' | 'wikipedia' | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'imdb' && value !== 'wikipedia') {
    throw new TypeError('Catalog source must be IMDb or Wikipedia.');
  }

  return value;
}

function readMediaType(value: unknown): 'film' | 'series' | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'film' && value !== 'series') {
    throw new TypeError('Media type must be film or series.');
  }

  return value;
}

function readPageId(value: unknown): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('Catalog page id must be a safe integer.');
  }

  return value as number;
}

export function readIdentifier(value: unknown, label: string): string {
  return readString(value, label, identifierLimit);
}

export function readFilesystemPath(value: unknown, label: string): string {
  const filePath = readString(value, label, pathLimit);

  if (!isAbsolute(filePath)) {
    throw new TypeError(`${label} must be an absolute local path.`);
  }

  return filePath;
}

export function readFilesystemPaths(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 1_000) {
    throw new TypeError(`${label} must be an array with at most 1000 paths.`);
  }

  return value.map((filePath) => readFilesystemPath(filePath, label));
}

export function readSearchQuery(value: unknown): string {
  return readString(value, 'Catalog search query', searchLimit).trim();
}

export function readLogEntryDetails(value: unknown): LogEntryDetails {
  if (value === undefined) {
    return {};
  }

  const record = readRecord(value, 'Entry details');
  const rating = record.rating;
  let safeRating: number | null | undefined;

  if (rating === null || rating === undefined) {
    safeRating = rating;
  } else if (typeof rating !== 'number' || rating < 0.5 || rating > 5 || rating * 2 !== Math.round(rating * 2)) {
    throw new TypeError('Rating must be null or a half-step from 0.5 through 5.');
  } else {
    safeRating = rating;
  }

  const tags = record.tags;
  let safeTags: string[] | undefined;

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > tagCountLimit) {
      throw new TypeError(`Tags must be an array with at most ${tagCountLimit} values.`);
    }

    safeTags = tags.map((tag) => readString(tag, 'Tags', tagLimit));
  }

  const watchedAt = record.watchedAt;
  let safeWatchedAt: string | undefined;

  if (watchedAt !== undefined) {
    const dateText = readString(watchedAt, 'Viewing date', 100);
    const date = new Date(dateText);

    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Viewing date must be a valid date and time.');
    }

    safeWatchedAt = date.toISOString();
  }

  const details: LogEntryDetails = {};
  const castNotes = readOptionalString(record, 'castNotes', 'Cast notes', annotationLimit);
  const favorite = readOptionalBoolean(record, 'favorite', 'Favorite');
  const location = readOptionalString(record, 'location', 'Location', shortAnnotationLimit);
  const review = readOptionalString(record, 'review', 'Review', annotationLimit);
  const rewatch = readOptionalBoolean(record, 'rewatch', 'Rewatch');
  const viewingFormat = readOptionalString(record, 'viewingFormat', 'Viewing format', shortAnnotationLimit);

  if (castNotes !== undefined) details.castNotes = castNotes;
  if (favorite !== undefined) details.favorite = favorite;
  if (location !== undefined) details.location = location;
  if (safeRating !== undefined) details.rating = safeRating;
  if (review !== undefined) details.review = review;
  if (rewatch !== undefined) details.rewatch = rewatch;
  if (safeTags !== undefined) details.tags = safeTags;
  if (viewingFormat !== undefined) details.viewingFormat = viewingFormat;
  if (safeWatchedAt !== undefined) details.watchedAt = safeWatchedAt;

  return details;
}

export function readLogFilmRequest(value: unknown): LogFilmRequest {
  const record = readRecord(value, 'Film selection');
  const request: LogFilmRequest = {
    pageId: readPageId(record.pageId),
    title: readString(record.title, 'Film title', titleLimit),
    year: readOptionalYear(record.year)
  };
  const catalogId = readOptionalString(record, 'catalogId', 'Catalog id', shortAnnotationLimit);
  const catalogSource = readCatalogSource(record.catalogSource);
  const director = readOptionalDirectors(record.director);
  const mediaType = readMediaType(record.mediaType);
  const posterLookupComplete = readOptionalBoolean(record, 'posterLookupComplete', 'Poster lookup state');
  const posterUrl = readOptionalUrl(record.posterUrl, 'Poster URL');
  const posterWidth = record.posterWidth;

  if (catalogId !== undefined) request.catalogId = catalogId;
  if (catalogSource !== undefined) request.catalogSource = catalogSource;
  if (director !== undefined) request.director = director;
  if (mediaType !== undefined) request.mediaType = mediaType;
  if (posterLookupComplete !== undefined) request.posterLookupComplete = posterLookupComplete;
  if (posterUrl !== undefined) request.posterUrl = posterUrl;
  if (posterWidth !== undefined) {
    if (typeof posterWidth !== 'number' || !Number.isFinite(posterWidth) || posterWidth <= 0) {
      throw new TypeError('Poster width must be a positive number.');
    }
    request.posterWidth = posterWidth;
  }

  return request;
}

export function readFilmIdentity(value: unknown): { title: string; year: number | null } {
  const record = readRecord(value, 'Film identity');
  return {
    title: readString(record.title, 'Film title', titleLimit),
    year: readOptionalYear(record.year)
  };
}

export function readCatalogSelection(value: unknown): CatalogSearchResult | null {
  if (value === null) {
    return null;
  }

  const record = readRecord(value, 'Catalog selection');
  const selection: CatalogSearchResult = {
    description: readString(record.description, 'Catalog description', 4_000, true),
    pageId: readPageId(record.pageId),
    posterUrl: readOptionalUrl(record.posterUrl, 'Poster URL') ?? null,
    title: readString(record.title, 'Film title', titleLimit),
    year: readOptionalYear(record.year)
  };
  const catalogId = readOptionalString(record, 'catalogId', 'Catalog id', shortAnnotationLimit);
  const catalogSource = readCatalogSource(record.catalogSource);
  const director = readOptionalDirectors(record.director);
  const mediaType = readMediaType(record.mediaType);
  const posterLookupComplete = readOptionalBoolean(record, 'posterLookupComplete', 'Poster lookup state');
  const catalogRank = record.catalogRank;
  const posterWidth = record.posterWidth;

  if (catalogId !== undefined) selection.catalogId = catalogId;
  if (catalogSource !== undefined) selection.catalogSource = catalogSource;
  if (director !== undefined) selection.director = director;
  if (mediaType !== undefined) selection.mediaType = mediaType;
  if (posterLookupComplete !== undefined) selection.posterLookupComplete = posterLookupComplete;
  if (catalogRank !== undefined) {
    if (typeof catalogRank !== 'number' || !Number.isFinite(catalogRank)) {
      throw new TypeError('Catalog rank must be a finite number.');
    }
    selection.catalogRank = catalogRank;
  }
  if (posterWidth !== undefined) {
    if (typeof posterWidth !== 'number' || !Number.isFinite(posterWidth) || posterWidth <= 0) {
      throw new TypeError('Poster width must be a positive number.');
    }
    selection.posterWidth = posterWidth;
  }

  return selection;
}

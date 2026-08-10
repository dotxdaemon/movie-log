// ABOUTME: Verifies that global catalog search keeps metadata when opening the logging sheet.
// ABOUTME: Prevents catalog-only viewing entries from losing media type, co-directors, or poster quality.
import { describe, expect, it } from 'vitest';
import { buildSearchResults, type SearchResultItem } from '../src/archive-model.js';
import { createArchiveLogSelection, createCatalogLogSelection } from '../src/catalog-log-selection.js';

const catalogResult: SearchResultItem = {
  catalogId: 'tt0298130',
  catalogSource: 'imdb',
  director: ['Gore Verbinski', 'Jane Campion'],
  key: 'catalog:imdb:tt0298130',
  kind: 'catalog',
  mediaType: 'film',
  pageId: -298130,
  posterLookupComplete: false,
  posterUrl: 'https://m.media-amazon.com/images/M/example.jpg',
  posterWidth: 500,
  sourcePath: null,
  status: 'IMDb',
  title: 'The Ring',
  year: 2002
};

describe('createCatalogLogSelection', () => {
  it('preserves every director from a global catalog result', () => {
    expect(createCatalogLogSelection(catalogResult)).toMatchObject({
      catalogId: 'tt0298130',
      catalogSource: 'imdb',
      director: ['Gore Verbinski', 'Jane Campion'],
      mediaType: 'film',
      posterLookupComplete: false,
      posterWidth: 500,
      title: 'The Ring',
      year: 2002
    });
  });

  it('leaves the director absent when the provider did not return one', () => {
    expect(createCatalogLogSelection({ ...catalogResult, director: [] }).director).toBeUndefined();
  });

  it('prefills the logging sheet from a matched Library title', () => {
    const selection = createArchiveLogSelection({
      current: true,
      film: {
        cast: [],
        catalogId: catalogResult.catalogId,
        catalogSource: catalogResult.catalogSource,
        country: [],
        director: [...catalogResult.director],
        fetchedAt: '2026-07-25T12:00:00.000Z',
        genres: [],
        key: 'the ring::2002',
        language: [],
        mediaType: 'film',
        pageId: catalogResult.pageId,
        posterUrl: catalogResult.posterUrl,
        posterWidth: catalogResult.posterWidth,
        runtimeMinutes: 115,
        status: 'matched',
        title: catalogResult.title,
        wikipediaUrl: null,
        year: catalogResult.year
      },
      mediaType: 'film'
    });

    expect(selection).toMatchObject({
      catalogId: 'tt0298130',
      catalogSource: 'imdb',
      description: 'From your Library',
      director: ['Gore Verbinski', 'Jane Campion'],
      mediaType: 'film',
      pageId: -298130,
      title: 'The Ring',
      year: 2002
    });
  });

  it('keeps series identity, co-directors, and poster quality through global Search into logging', () => {
    const result = buildSearchResults({ history: [], libraryItems: [], watchedFolders: [] }, 'ring', [
      {
        catalogId: catalogResult.catalogId,
        catalogSource: catalogResult.catalogSource,
        description: 'IMDb title',
        director: ['Gore Verbinski', 'Jane Campion'],
        mediaType: 'series',
        pageId: catalogResult.pageId ?? -1,
        posterLookupComplete: false,
        posterUrl: catalogResult.posterUrl,
        posterWidth: 500,
        title: catalogResult.title,
        year: catalogResult.year
      }
    ]).catalog[0];

    expect(result && createCatalogLogSelection(result)).toMatchObject({
      director: ['Gore Verbinski', 'Jane Campion'],
      mediaType: 'series',
      posterLookupComplete: false,
      posterWidth: 500
    });
  });
});

// ABOUTME: Pins catalog row identity across providers and legacy numeric page identifiers.
// ABOUTME: Prevents React row collisions when different catalogs reuse the same numeric value.
import { describe, expect, it } from 'vitest';
import { readCatalogResultKey } from '../src/catalog-result.js';

describe('catalog result identity', () => {
  it('keeps provider identities distinct even when page identifiers match', () => {
    const wikipedia = readCatalogResultKey({
      catalogId: '71441742',
      catalogSource: 'wikipedia',
      pageId: 71441742,
      title: 'Flow',
      year: 2024
    });
    const imdb = readCatalogResultKey({
      catalogId: 'tt4772188',
      catalogSource: 'imdb',
      pageId: 71441742,
      title: 'Flow',
      year: 2024
    });

    expect(wikipedia).not.toBe(imdb);
  });

  it('uses title and year to disambiguate legacy rows', () => {
    const first = readCatalogResultKey({ pageId: 42, title: 'Heat', year: 1995 });
    const second = readCatalogResultKey({ pageId: 42, title: 'Flow', year: 2024 });

    expect(first).not.toBe(second);
  });
});

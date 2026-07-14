// ABOUTME: Verifies catalog failures become restrained user-facing copy instead of IPC implementation details.
// ABOUTME: Keeps the designed error state useful whether the rejection is an Error or an unknown value.
import { describe, expect, it } from 'vitest';
import { readCatalogFailureMessage } from '../src/catalog-search.js';

describe('catalog search failure copy', () => {
  it('hides remote-method details from catalog errors', () => {
    expect(readCatalogFailureMessage(new Error("Error invoking remote method 'movie-log:search-catalog'"))).toBe(
      'The film catalog could not be reached. Check your connection and try again.'
    );
  });

  it('uses the same actionable copy for unknown rejections', () => {
    expect(readCatalogFailureMessage(null)).toBe(
      'The film catalog could not be reached. Check your connection and try again.'
    );
  });
});

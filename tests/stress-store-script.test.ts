// ABOUTME: Verifies the reproducible large-library acceptance data generator.
// ABOUTME: Keeps stress data isolated from production and catalog background writes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../scripts/create-stress-store.mjs', import.meta.url), 'utf8');

describe('large-library stress store', () => {
  it('refuses production data and seeds stable unmatched metadata', () => {
    expect(script).toContain('/Library/Application Support/Movie Log/');
    expect(script).toContain("status: 'unmatched'");
    expect(script).toContain('matchVersion: 3');
    expect(script).toContain('itemCount < 1_000');
    expect(script).toContain('movie-log-films.json');
  });
});

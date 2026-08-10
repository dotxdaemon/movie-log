// ABOUTME: Verifies that the installed retry acceptance fixture is reproducible and isolated from production.
// ABOUTME: Runs the actual generator against a minimal complete store and checks the scheduled record on disk.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('metadata retry store', () => {
  it('copies a complete store and schedules The Ring without changing the source', () => {
    const root = mkdtempSync(join(tmpdir(), 'movie-log-retry-test-'));
    const source = join(root, 'source');
    const output = join(root, 'output');
    mkdirSync(source);
    const films = {
      films: {
        'the ring::2002': {
          attempts: 16,
          cast: [],
          country: ['United States'],
          detailsComplete: true,
          director: [],
          fetchedAt: '2026-08-01T00:00:00.000Z',
          genres: [],
          key: 'the ring::2002',
          language: ['English'],
          pageId: 62668,
          posterUrl: 'https://m.media-amazon.com/poster.jpg',
          runtimeMinutes: 116,
          status: 'matched',
          title: 'The Ring',
          wikipediaUrl: 'https://en.wikipedia.org/wiki/The_Ring_(2002_film)',
          year: 2002
        }
      }
    };
    const originalFilms = `${JSON.stringify(films, null, 2)}\n`;
    writeFileSync(join(source, 'movie-log-films.json'), originalFilms);
    writeFileSync(join(source, 'movie-log.json'), '{"history":[],"libraryItems":[],"watchedFolders":[]}\n');
    writeFileSync(join(source, 'movie-log-note.md'), '# Movie Log\n');

    execFileSync(process.execPath, [
      fileURLToPath(new URL('../scripts/create-retry-store.mjs', import.meta.url)),
      source,
      output
    ]);

    const scheduled = JSON.parse(readFileSync(join(output, 'movie-log-films.json'), 'utf8')).films['the ring::2002'];
    expect(scheduled).toMatchObject({
      attempts: 2,
      detailsComplete: false,
      failureCount: 1,
      failureReason: 'temporary',
      nextRetryAt: '2030-08-09T12:00:00.000Z',
      status: 'retry-scheduled'
    });
    expect(readFileSync(join(source, 'movie-log-films.json'), 'utf8')).toBe(originalFilms);
  });
});

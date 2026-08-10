// ABOUTME: Verifies that the Electron IPC boundary rejects malformed renderer values.
// ABOUTME: Locks mutation details to the fields and limits supported by Movie Log forms.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readFilesystemPath,
  readIdentifier,
  readLogEntryDetails,
  readSearchQuery
} from '../electron/ipc-validation.js';

describe('IPC validation', () => {
  it('guards every renderer-supplied privileged handler family', () => {
    const handlers = readFileSync(new URL('../electron/ipc-handlers.ts', import.meta.url), 'utf8');

    expect(handlers).toContain("readFilesystemPath(itemPath, 'Media path')");
    expect(handlers).toContain("readFilesystemPaths(paths, 'Media path')");
    expect(handlers).toContain("readIdentifier(entryId, 'Entry id')");
    expect(handlers).toContain('readLogEntryDetails(details)');
    expect(handlers).toContain('readLogFilmRequest(film)');
    expect(handlers).toContain('readCatalogSelection(selection)');
    expect(handlers).toContain('readSearchQuery(query)');
  });

  it('accepts valid identifiers and absolute local paths', () => {
    expect(readIdentifier('entry-123', 'Entry id')).toBe('entry-123');
    expect(readFilesystemPath('/Users/seankim/Movies/Flow.mkv', 'Media path')).toBe('/Users/seankim/Movies/Flow.mkv');
  });

  it('rejects blank identifiers, relative paths, null bytes, and oversized searches', () => {
    expect(() => readIdentifier('  ', 'Entry id')).toThrow(/Entry id/);
    expect(() => readFilesystemPath('../Movies/Flow.mkv', 'Media path')).toThrow(/absolute/);
    expect(() => readFilesystemPath('/tmp/Flow\0.mkv', 'Media path')).toThrow(/null byte/);
    expect(() => readSearchQuery('x'.repeat(501))).toThrow(/500 characters/);
  });

  it('copies only supported entry detail fields and enforces form constraints', () => {
    expect(
      readLogEntryDetails({
        favorite: true,
        id: 'forged-id',
        rating: 4.5,
        review: 'Precise and moving.',
        sourcePath: '/tmp/forged.mkv',
        tags: ['Drama', 'Animation'],
        watchedAt: '2026-03-12T18:00:00.000Z'
      })
    ).toEqual({
      favorite: true,
      rating: 4.5,
      review: 'Precise and moving.',
      tags: ['Drama', 'Animation'],
      watchedAt: '2026-03-12T18:00:00.000Z'
    });

    expect(() => readLogEntryDetails({ rating: 4.2 })).toThrow(/half-step/);
    expect(() => readLogEntryDetails({ review: 'x'.repeat(2001) })).toThrow(/2000 characters/);
    expect(() => readLogEntryDetails({ tags: ['Drama', 42] })).toThrow(/Tags/);
    expect(() => readLogEntryDetails({ watchedAt: 'not-a-date' })).toThrow(/Viewing date/);
  });
});

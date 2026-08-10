// ABOUTME: Verifies that viewing form defaults and submitted details preserve the user's local calendar date.
// ABOUTME: Prevents UTC conversion from moving late-evening entries into the following day.
import { describe, expect, it } from 'vitest';
import { readEntryValidationError, readLocalDateValue } from '../src/components/entry-details.js';

describe('entry details', () => {
  it('formats the viewing-date default from local calendar parts', () => {
    const lateLocalEvening = new Date(2026, 6, 13, 23, 30);

    expect(readLocalDateValue(lateLocalEvening)).toBe('2026-07-13');
  });

  it('rejects a future viewing date with actionable copy', () => {
    expect(
      readEntryValidationError({ watchedAt: '2026-07-14T18:00:00.000Z' }, new Date('2026-07-13T12:00:00.000Z'))
    ).toBe('Choose today or an earlier viewing date.');
    expect(
      readEntryValidationError({ watchedAt: '2026-07-13T18:00:00.000Z' }, new Date('2026-07-13T12:00:00.000Z'))
    ).toBeNull();
  });
});

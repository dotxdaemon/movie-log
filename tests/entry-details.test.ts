// ABOUTME: Verifies that diary form defaults and submitted details preserve the user's local calendar date.
// ABOUTME: Prevents UTC conversion from moving late-evening entries into the following day.
import { describe, expect, it } from 'vitest';
import { readLocalDateValue } from '../src/components/entry-details.js';

describe('entry details', () => {
  it('formats the viewing-date default from local calendar parts', () => {
    const lateLocalEvening = new Date(2026, 6, 13, 23, 30);

    expect(readLocalDateValue(lateLocalEvening)).toBe('2026-07-13');
  });
});

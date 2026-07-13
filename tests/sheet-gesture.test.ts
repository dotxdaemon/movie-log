// ABOUTME: Verifies the deliberate downward motion that dismisses mobile archive sheets.
// ABOUTME: Keeps ordinary taps and small scroll adjustments from closing a form unexpectedly.
import { describe, expect, it } from 'vitest';
import { shouldDismissSheet } from '../src/sheet-gesture.js';

describe('shouldDismissSheet', () => {
  it('accepts a deliberate downward swipe and rejects short or upward movement', () => {
    expect(shouldDismissSheet(40, 112)).toBe(true);
    expect(shouldDismissSheet(40, 111)).toBe(false);
    expect(shouldDismissSheet(112, 40)).toBe(false);
  });
});

// ABOUTME: Verifies sheet dialogs keep forward and backward Tab movement inside the open surface.
// ABOUTME: Pins focus wrap decisions independently from browser-specific focus delivery.
import { describe, expect, it } from 'vitest';
import { readDialogFocusTarget } from '../src/dialog-focus.js';

describe('dialog focus wrapping', () => {
  it('wraps backward from the first control to the last', () => {
    const first = {} as HTMLElement;
    const middle = {} as HTMLElement;
    const last = {} as HTMLElement;

    expect(readDialogFocusTarget([first, middle, last], first, true)).toBe(last);
  });

  it('wraps forward from the last control to the first and leaves interior focus alone', () => {
    const first = {} as HTMLElement;
    const middle = {} as HTMLElement;
    const last = {} as HTMLElement;

    expect(readDialogFocusTarget([first, middle, last], last, false)).toBe(first);
    expect(readDialogFocusTarget([first, middle, last], middle, false)).toBeNull();
  });
});

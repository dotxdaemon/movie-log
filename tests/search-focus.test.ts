// ABOUTME: Verifies Search dismissal restores focus to the control that opened the surface.
// ABOUTME: Covers both a remounted header input and a persistent navigation control.
import { describe, expect, it, vi } from 'vitest';
import { focusSearchReturnTarget } from '../src/search-focus.js';

describe('Search focus restoration', () => {
  it('focuses the remounted header search input when the original input was replaced', () => {
    const focus = vi.fn();
    const replacement = { focus } as unknown as HTMLElement;
    const opener = { matches: () => true } as unknown as HTMLElement;
    const querySelector = vi.fn(() => replacement);

    focusSearchReturnTarget(opener, { querySelector } as unknown as Document);

    expect(querySelector).toHaveBeenCalledWith('.header-search input');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('focuses a persistent non-header opener directly', () => {
    const focus = vi.fn();
    const opener = { focus, matches: () => false } as unknown as HTMLElement;
    const querySelector = vi.fn();

    focusSearchReturnTarget(opener, { querySelector } as unknown as Document);

    expect(querySelector).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledOnce();
  });
});

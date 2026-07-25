// ABOUTME: Verifies the global keyboard commands for opening Search and the logging sheet.
// ABOUTME: Keeps shortcut resolution pure so renderer wiring can be tested without a DOM.
import { describe, expect, it } from 'vitest';
import { readAppShortcut } from '../src/app-shortcuts.js';

describe('app shortcuts', () => {
  it('opens Search with Command or Control K', () => {
    expect(readAppShortcut({ key: 'k', metaKey: true }, false, 'mac')).toBe('search');
    expect(readAppShortcut({ ctrlKey: true, key: 'K' }, false, 'other')).toBe('search');
  });

  it('opens the logging sheet with Command or Control N', () => {
    expect(readAppShortcut({ key: 'n', metaKey: true }, false, 'mac')).toBe('log');
    expect(readAppShortcut({ ctrlKey: true, key: 'N' }, false, 'other')).toBe('log');
  });

  it('does not override modal, modified, prevented, or unrelated key events', () => {
    expect(readAppShortcut({ key: 'k', metaKey: true }, true, 'mac')).toBeNull();
    expect(readAppShortcut({ altKey: true, key: 'k', metaKey: true }, false, 'mac')).toBeNull();
    expect(readAppShortcut({ defaultPrevented: true, key: 'n', metaKey: true }, false, 'mac')).toBeNull();
    expect(readAppShortcut({ key: 'p', metaKey: true }, false, 'mac')).toBeNull();
    expect(readAppShortcut({ key: 'k' }, false, 'mac')).toBeNull();
    expect(readAppShortcut({ ctrlKey: true, key: 'k' }, false, 'mac')).toBeNull();
    expect(readAppShortcut({ key: 'k', metaKey: true }, false, 'other')).toBeNull();
  });
});

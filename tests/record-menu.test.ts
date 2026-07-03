// ABOUTME: Verifies that record action menus close after actions and outside pointer presses.
// ABOUTME: Uses plain object stand-ins for DOM handles so menu rules stay testable in Node.
import { describe, expect, it, vi } from 'vitest';
import { closeRecordMenuFromAction, closeRecordMenusOutside } from '../src/record-menu.js';

describe('closeRecordMenuFromAction', () => {
  it('closes the menu that contains the action element', () => {
    const removeAttribute = vi.fn();
    const closest = vi.fn(() => ({ removeAttribute }));

    closeRecordMenuFromAction({ closest });

    expect(closest).toHaveBeenCalledWith('details.record-menu');
    expect(removeAttribute).toHaveBeenCalledWith('open');
  });

  it('does nothing when the action element is outside a record menu', () => {
    expect(() => {
      closeRecordMenuFromAction({ closest: () => null });
    }).not.toThrow();
  });
});

describe('closeRecordMenusOutside', () => {
  it('closes only the open menus that do not contain the pressed target', () => {
    const target = {};
    const insideMenu = { contains: () => true, removeAttribute: vi.fn() };
    const outsideMenu = { contains: () => false, removeAttribute: vi.fn() };
    const root = {
      querySelectorAll: vi.fn(() => [insideMenu, outsideMenu])
    };

    closeRecordMenusOutside(root, target);

    expect(root.querySelectorAll).toHaveBeenCalledWith('details.record-menu[open]');
    expect(insideMenu.removeAttribute).not.toHaveBeenCalled();
    expect(outsideMenu.removeAttribute).toHaveBeenCalledWith('open');
  });
});

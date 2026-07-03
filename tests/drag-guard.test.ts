// ABOUTME: Verifies that window-level drags cannot navigate the desktop renderer away from the app.
// ABOUTME: Uses a fake event target so drop-guard behavior stays deterministic without a browser.
import { describe, expect, it, vi } from 'vitest';
import { guardDragNavigation } from '../src/drag-guard.js';

type DragListener = (event: { preventDefault(): void }) => void;

function createFakeWindow() {
  const listenersByType = new Map<string, DragListener[]>();

  return {
    addEventListener(type: 'dragover' | 'drop', listener: DragListener): void {
      listenersByType.set(type, [...(listenersByType.get(type) ?? []), listener]);
    },
    removeEventListener(type: 'dragover' | 'drop', listener: DragListener): void {
      listenersByType.set(
        type,
        (listenersByType.get(type) ?? []).filter((item) => item !== listener)
      );
    },
    dispatch(type: string, event: { preventDefault(): void }): void {
      for (const listener of listenersByType.get(type) ?? []) {
        listener(event);
      }
    },
    countListeners(type: string): number {
      return (listenersByType.get(type) ?? []).length;
    }
  };
}

describe('guardDragNavigation', () => {
  it('cancels default handling for window drags and drops', () => {
    const fakeWindow = createFakeWindow();
    guardDragNavigation(fakeWindow);

    const dragOverEvent = { preventDefault: vi.fn() };
    const dropEvent = { preventDefault: vi.fn() };
    fakeWindow.dispatch('dragover', dragOverEvent);
    fakeWindow.dispatch('drop', dropEvent);

    expect(dragOverEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(dropEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('stops guarding once released', () => {
    const fakeWindow = createFakeWindow();
    const release = guardDragNavigation(fakeWindow);

    release();

    expect(fakeWindow.countListeners('dragover')).toBe(0);
    expect(fakeWindow.countListeners('drop')).toBe(0);
  });
});

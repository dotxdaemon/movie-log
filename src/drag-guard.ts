// ABOUTME: Stops file drags outside the drop zone from navigating the desktop window away.
// ABOUTME: Cancels window-level drag defaults so only Movie Log surfaces handle dropped paths.
interface DragNavigationTarget {
  addEventListener(type: 'dragover' | 'drop', listener: (event: { preventDefault(): void }) => void): void;
  removeEventListener(type: 'dragover' | 'drop', listener: (event: { preventDefault(): void }) => void): void;
}

export function guardDragNavigation(target: DragNavigationTarget): () => void {
  const cancelDragDefault = (event: { preventDefault(): void }): void => {
    event.preventDefault();
  };

  target.addEventListener('dragover', cancelDragDefault);
  target.addEventListener('drop', cancelDragDefault);

  return () => {
    target.removeEventListener('dragover', cancelDragDefault);
    target.removeEventListener('drop', cancelDragDefault);
  };
}

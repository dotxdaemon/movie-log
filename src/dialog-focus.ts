// ABOUTME: Chooses the focus target that keeps Tab movement inside an open sheet dialog.
// ABOUTME: Supports forward and backward wrapping without changing interior focus movement.
export function readDialogFocusTarget(
  focusable: HTMLElement[],
  activeElement: Element | null,
  backward: boolean
): HTMLElement | null {
  const first = focusable[0];
  const last = focusable.at(-1);

  if (!first || !last) {
    return null;
  }

  if (backward && activeElement === first) {
    return last;
  }

  if (!backward && activeElement === last) {
    return first;
  }

  return null;
}

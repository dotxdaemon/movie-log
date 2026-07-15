// ABOUTME: Restores focus after Search closes, including when its header input remounts with the prior view.
// ABOUTME: Keeps keyboard users anchored to the control that opened Search.
export function focusSearchReturnTarget(opener: HTMLElement | null, documentRef: Document = document): void {
  const target = opener?.matches('.header-search input')
    ? documentRef.querySelector<HTMLElement>('.header-search input')
    : opener;

  target?.focus();
}

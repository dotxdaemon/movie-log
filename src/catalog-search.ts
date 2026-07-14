// ABOUTME: Translates catalog lookup failures into concise archive-facing guidance.
// ABOUTME: Keeps transport and IPC implementation details out of the visible error state.
export function readCatalogFailureMessage(error: unknown): string {
  void error;
  return 'The film catalog could not be reached. Check your connection and try again.';
}

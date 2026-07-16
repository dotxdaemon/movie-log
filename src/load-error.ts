// ABOUTME: Converts startup data failures into stable, nontechnical archive copy.
// ABOUTME: Prevents Electron, IPC, paths, and filesystem internals from leaking into the designed error state.
export function readArchiveLoadFailureMessage(error: unknown): string {
  void error;
  return 'Movie Log could not read the local archive. Your files were not changed.';
}

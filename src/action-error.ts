// ABOUTME: Converts action failures at the IPC-to-renderer boundary into stable, nontechnical guidance.
// ABOUTME: Keeps detailed Electron, filesystem, path, and catalog errors in development logs only.

export type ActionFailureContext =
  | 'add-folder'
  | 'copy-path'
  | 'delete-entry'
  | 'log'
  | 'metadata'
  | 'open-item'
  | 'persistence'
  | 'remove-folder'
  | 'scan'
  | 'show-in-finder'
  | 'update-entry';

const fallbackByContext: Record<ActionFailureContext, string> = {
  'add-folder': 'Movie Log could not add that watched folder.',
  'copy-path': 'Movie Log could not copy that path.',
  'delete-entry': 'Movie Log could not delete that viewing. Your journal was not changed.',
  log: 'Movie Log could not save this viewing.',
  metadata: 'The film catalog is temporarily unavailable. Try again when you are connected.',
  'open-item': 'Movie Log could not open that item.',
  persistence: 'Movie Log could not save this change. Your existing viewing history was not changed.',
  'remove-folder': 'Movie Log could not remove that watched folder. Nothing was deleted.',
  scan: 'Movie Log could not scan that folder. Check that it is available and try again.',
  'show-in-finder': 'Movie Log could not reveal that item in Finder.',
  'update-entry': 'Movie Log could not save that viewing update.'
};

function readFailureText(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return `${code} ${message}`.toLowerCase();
}

export function readActionFailureMessage(error: unknown, context: ActionFailureContext): string {
  const failure = readFailureText(error);

  if (/\b(?:eacces|eperm)\b|permission denied|not permitted/.test(failure)) {
    return 'Movie Log does not have permission to use that file or folder. Check its access and try again.';
  }

  if (/\b(?:enodev|enxio|enotconn)\b|volume.+unavailable|disk.+ejected/.test(failure)) {
    return 'That volume is unavailable. Reconnect it and try again.';
  }

  if (/\benoent\b|no such file|not found/.test(failure)) {
    return 'That file or folder is no longer available.';
  }

  if (context === 'log' && /unsupported|invalid media|not loggable|likely media/.test(failure)) {
    return 'Choose a supported movie file or folder.';
  }

  if (context === 'metadata' || /catalog|network|offline|timed? out|rate limit|\b429\b/.test(failure)) {
    return fallbackByContext.metadata;
  }

  if (context === 'persistence' || /disk write|write failed|could not save/.test(failure)) {
    return fallbackByContext.persistence;
  }

  return fallbackByContext[context];
}

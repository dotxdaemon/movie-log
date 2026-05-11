// ABOUTME: Formats compact status messages for Movie Log drop and scan actions.
// ABOUTME: Keeps user-facing action feedback testable outside the React component file.
import { readPathName } from '../shared/history.js';
import type { LogPathsResult } from '../shared/types.js';

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatSkippedPaths(paths: string[]): string {
  const visiblePaths = paths.slice(0, 3).map(readPathName);
  const hiddenPathCount = paths.length - visiblePaths.length;

  if (hiddenPathCount === 0) {
    return visiblePaths.join(', ');
  }

  return `${visiblePaths.join(', ')}, and ${formatCount(hiddenPathCount, 'more', 'more')}`;
}

export function createDropFeedbackMessage(result: LogPathsResult): string {
  const loggedMessage = result.addedCount > 0 ? `Logged ${formatCount(result.addedCount, 'item')}. ` : '';
  const skippedPaths = formatSkippedPaths(result.skippedPaths);

  return `${loggedMessage}Skipped ${formatCount(result.skippedPaths.length, 'path')} that could not be logged: ${skippedPaths}.`;
}

export function createScanFeedbackMessage(addedCount: number): string {
  if (addedCount === 0) {
    return 'Scan finished. No new items found.';
  }

  return `Scan finished. Added ${formatCount(addedCount, 'item')}.`;
}

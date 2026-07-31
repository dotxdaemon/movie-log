// ABOUTME: Keeps the human-readable metadata summary independent from React rendering.
// ABOUTME: Lets desktop and mobile status affordances share honest catalog language without Fast Refresh violations.
import type { ArchiveCoverage } from '../archive-model.js';

export function readMetadataSummary(coverage: ArchiveCoverage): string {
  if (coverage.total === 0) {
    return 'no metadata yet';
  }

  const retryable = coverage.failed + coverage.retryScheduled;

  return coverage.pending > 0
    ? 'matching metadata…'
    : retryable > 0
      ? `${retryable} metadata ${retryable === 1 ? 'retry' : 'retries'} available`
      : coverage.unmatched > 0
        ? `${coverage.matched} of ${coverage.total} metadata matched`
        : 'metadata complete';
}

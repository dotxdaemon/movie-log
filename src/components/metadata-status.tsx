// ABOUTME: Summarizes honest catalog enrichment and personal-annotation coverage in one compact study.
// ABOUTME: Exposes a real retry action only when temporary catalog failures need another pass.
import type { ArchiveCoverage } from '../archive-model.js';

export function MetadataStatus({ coverage, onRetry }: { coverage: ArchiveCoverage; onRetry(): Promise<void> }) {
  if (coverage.total === 0) {
    return null;
  }

  const retryable = coverage.failed + coverage.retryScheduled;
  const summary =
    coverage.pending > 0
      ? 'matching metadata…'
      : retryable > 0
        ? `${retryable} metadata ${retryable === 1 ? 'retry' : 'retries'} available`
        : coverage.unmatched > 0
          ? `${coverage.matched} of ${coverage.total} metadata matched`
          : 'metadata complete';

  return (
    <details className="metadata-status">
      <summary aria-live="polite" className="metadata-status-primary">
        {summary}
      </summary>
      <div className="metadata-status-details" role="status">
        <span>{`${coverage.matched} of ${coverage.total} enriched`}</span>
        {coverage.unmatched > 0 ? <span>{`${coverage.unmatched} not found in catalog`}</span> : null}
        <span>{`${coverage.annotated} annotated`}</span>
        {coverage.retryScheduled > 0 ? <span>{`${coverage.retryScheduled} retry scheduled`}</span> : null}
        {coverage.failed > 0 || coverage.retryScheduled > 0 ? (
          <span className="metadata-failure">
            {coverage.failed > 0 ? `${coverage.failed} temporarily failed` : 'Catalog retry available'}
            <button className="metadata-retry" onClick={() => void onRetry()} type="button">
              Retry
            </button>
          </span>
        ) : null}
      </div>
    </details>
  );
}

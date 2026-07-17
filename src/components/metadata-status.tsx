// ABOUTME: Summarizes honest catalog enrichment and personal-annotation coverage in one compact study.
// ABOUTME: Exposes a real retry action only when temporary catalog failures need another pass.
import type { ArchiveCoverage } from '../archive-model.js';

export function MetadataStatus({
  coverage,
  diaryCount,
  onRetry,
  titleCount
}: {
  coverage: ArchiveCoverage;
  diaryCount: number;
  onRetry(): Promise<void>;
  titleCount: number;
}) {
  if (coverage.total === 0) {
    return null;
  }

  return (
    <details className="metadata-status">
      <summary aria-live="polite" className="metadata-status-primary">
        {`${diaryCount} entries · ${titleCount} titles · `}
        {coverage.pending > 0 ? 'matching metadata… ' : 'metadata '}
        {`${coverage.matched} of ${coverage.total} enriched`}
      </summary>
      <div className="metadata-status-details" role="status">
        {coverage.unmatched > 0 ? <span>{`${coverage.unmatched} need review`}</span> : null}
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

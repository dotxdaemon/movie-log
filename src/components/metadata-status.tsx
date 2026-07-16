// ABOUTME: Summarizes honest catalog enrichment and personal-annotation coverage in one compact study.
// ABOUTME: Exposes a real retry action only when temporary catalog failures need another pass.
import type { ArchiveCoverage } from '../archive-model.js';

export function MetadataStatus({ coverage, onRetry }: { coverage: ArchiveCoverage; onRetry(): Promise<void> }) {
  if (coverage.total === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="metadata-status" role="status">
      <span className="metadata-status-primary">
        {coverage.pending > 0 ? 'Matching metadata… ' : 'Metadata '}
        {`${coverage.matched} of ${coverage.total} enriched`}
      </span>
      {coverage.unmatched > 0 ? <span>{`${coverage.unmatched} need review`}</span> : null}
      <span>{`${coverage.annotated} annotated`}</span>
      {coverage.failed > 0 ? (
        <span className="metadata-failure">
          Catalog unavailable
          <button className="metadata-retry" onClick={() => void onRetry()} type="button">
            Retry
          </button>
        </span>
      ) : null}
    </div>
  );
}

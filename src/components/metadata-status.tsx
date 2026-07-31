// ABOUTME: Summarizes honest catalog enrichment and personal-annotation coverage in one compact study.
// ABOUTME: Exposes a real retry action only when temporary catalog failures need another pass.
import type { ArchiveCoverage } from '../archive-model.js';
import { readMetadataSummary } from './metadata-status-copy.js';

function MetadataStatusDetails({ coverage, onRetry }: { coverage: ArchiveCoverage; onRetry(): Promise<void> }) {
  const retryable = coverage.failed + coverage.retryScheduled;

  return (
    <div className="metadata-status-details" role="status">
      <span>{`${coverage.matched} of ${coverage.total} enriched`}</span>
      {coverage.unmatched > 0 ? <span>{`${coverage.unmatched} not found in catalog`}</span> : null}
      <span>{`${coverage.annotated} annotated`}</span>
      {coverage.retryScheduled > 0 ? <span>{`${coverage.retryScheduled} retry scheduled`}</span> : null}
      {retryable > 0 ? (
        <span className="metadata-failure">
          {coverage.failed > 0 ? `${coverage.failed} temporarily failed` : 'Catalog retry available'}
          <button className="metadata-retry" onClick={() => void onRetry()} type="button">
            Retry
          </button>
        </span>
      ) : null}
    </div>
  );
}

export function MetadataStatus({ coverage, onRetry }: { coverage: ArchiveCoverage; onRetry(): Promise<void> }) {
  if (coverage.total === 0) {
    return null;
  }

  const summary = readMetadataSummary(coverage);

  return (
    <details className="metadata-status">
      <summary aria-live="polite" className="metadata-status-primary">
        {summary}
      </summary>
      <MetadataStatusDetails coverage={coverage} onRetry={onRetry} />
    </details>
  );
}

export function MobileArchiveStatus({
  archiveCount,
  coverage,
  loading,
  onRetry,
  viewingCount
}: {
  archiveCount: number;
  coverage: ArchiveCoverage;
  loading: boolean;
  onRetry(): Promise<void>;
  viewingCount: number;
}) {
  if (loading) {
    return (
      <span
        aria-label="Loading archive status"
        className="mobile-archive-status mobile-archive-status-loading"
        role="status"
      >
        Loading status…
      </span>
    );
  }

  const summary = `${viewingCount} viewings · ${archiveCount} titles · ${readMetadataSummary(coverage)}`;

  return (
    <details className="mobile-archive-status">
      <summary aria-label={summary} aria-live="polite" title={summary}>
        {summary}
      </summary>
      <MetadataStatusDetails coverage={coverage} onRetry={onRetry} />
    </details>
  );
}

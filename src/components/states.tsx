// ABOUTME: Renders designed empty, error, and loading states built from abstract garment-study fragments.
// ABOUTME: Keeps every waiting surface dimension-stable and every blank surface intentional.
import type { ReactNode } from 'react';

type FragmentName = 'panel' | 'seam' | 'sleeve' | 'boot' | 'hand';

const fragmentDrawings: Record<FragmentName, ReactNode> = {
  hand: (
    <>
      <path d="M18 46V22" />
      <path d="M26 46V14" strokeDasharray="2 3" />
      <path d="M34 46V18" />
      <path d="M42 46V26" strokeDasharray="2 3" />
      <path d="M14 46h34" />
    </>
  ),
  boot: (
    <>
      <path d="M22 6v26l10 8h18" />
      <path d="M22 18h9" strokeDasharray="2 3" />
      <path d="M50 40v4H20" />
    </>
  ),
  panel: (
    <>
      <path d="M10 8h32v20" />
      <path d="M42 36v8H18" />
      <path d="M10 8v14" strokeDasharray="2 3" />
      <path d="M24 20h20" strokeDasharray="2 3" />
    </>
  ),
  seam: (
    <>
      <path d="M14 44 44 10" />
      <path d="M20 44 50 10" strokeDasharray="2 3" />
      <path d="M14 24h12" />
    </>
  ),
  sleeve: (
    <>
      <path d="M18 6c-6 10-6 24 0 40" />
      <path d="M32 6c-6 10-6 24 0 40" strokeDasharray="2 3" />
      <path d="M18 26h14" />
    </>
  )
};

function FragmentDrawing({ name }: { name: FragmentName }) {
  return (
    <svg aria-hidden="true" className="state-fragment" fill="none" height="52" viewBox="0 0 60 52" width="60">
      <g stroke="currentColor" strokeLinecap="square" strokeWidth="1.2">
        {fragmentDrawings[name]}
      </g>
      <rect fill="var(--active-red)" height="4" stroke="none" width="4" x="52" y="44" />
    </svg>
  );
}

interface EmptyStateProps {
  actions?: ReactNode;
  fragment?: FragmentName;
  hint?: string;
  index?: string;
  title: string;
}

export function EmptyState({ actions, fragment = 'panel', hint, index = '00', title }: EmptyStateProps) {
  return (
    <section className="blank-slate">
      <FragmentDrawing name={fragment} />
      <p className="eyebrow">{`No. ${index}`}</p>
      <h2>{title}</h2>
      {hint ? <p className="blank-hint">{hint}</p> : null}
      {actions ? <div className="blank-actions">{actions}</div> : null}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="error-state" role="alert">
      <FragmentDrawing name="seam" />
      <p className="eyebrow">Fault / 01</p>
      <h2>The archive did not load.</h2>
      <p className="error-detail">{message}</p>
      {onRetry ? (
        <button className="command-block" onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </section>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />;
}

function repeatBlocks(count: number, render: (index: number) => ReactNode): ReactNode[] {
  return Array.from({ length: count }, (_item, index) => render(index));
}

const statisticPanelClasses = [
  'monthly-chart',
  'rating-chart',
  'genre-chart',
  'director-chart',
  'decade-chart',
  'year-chart'
];

export function ViewSkeleton({
  view
}: {
  view: 'diary' | 'library' | 'search' | 'statistics' | 'settings' | 'detail';
}) {
  if (view === 'library') {
    return (
      <div aria-label="Loading library" className="screen-loading library-loading" role="status">
        <div aria-hidden="true" className="library-result-line skeleton-library-result-line">
          <SkeletonBlock className="skeleton-line skeleton-library-count" />
          <span className="library-result-rule" />
          <SkeletonBlock className="skeleton-line skeleton-library-indexed" />
        </div>
        <div className="movie-grid">
          {repeatBlocks(8, (index) => (
            <span className="skeleton-card" key={index}>
              <SkeletonBlock className="skeleton-poster" />
              <SkeletonBlock className="skeleton-line skeleton-card-title" />
              <SkeletonBlock className="skeleton-line skeleton-card-media" />
              <SkeletonBlock className="skeleton-line skeleton-card-meta" />
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'search') {
    return (
      <div aria-label="Loading search" className="screen-loading search-loading" role="status">
        <SkeletonBlock className="skeleton-search" />
        {repeatBlocks(4, (index) => (
          <span className="skeleton-result" key={index}>
            <SkeletonBlock className="skeleton-thumb" />
            <SkeletonBlock className="skeleton-line" />
          </span>
        ))}
      </div>
    );
  }

  if (view === 'statistics') {
    return (
      <div aria-label="Loading statistics" className="screen-loading statistics-loading" role="status">
        <dl className="metric-strip skeleton-statistics-metrics">
          {repeatBlocks(8, (index) => (
            <div className="skeleton-statistics-metric" key={index}>
              <dt>
                <SkeletonBlock className="skeleton-line skeleton-line-short" />
              </dt>
              <dd>
                <SkeletonBlock className="skeleton-metric-value" />
              </dd>
            </div>
          ))}
        </dl>
        <section className="statistics-coverage skeleton-statistics-coverage">
          {repeatBlocks(2, (index) => (
            <div key={index}>
              <SkeletonBlock className="skeleton-line skeleton-line-short" />
              <SkeletonBlock className="skeleton-line" />
              <SkeletonBlock className="skeleton-line skeleton-coverage-detail" />
            </div>
          ))}
        </section>
        <div className="statistics-panels skeleton-statistics-panels">
          {statisticPanelClasses.map((panelClass) => (
            <section className={`chart-panel ${panelClass} skeleton-chart-panel`} key={panelClass}>
              <header>
                <span>
                  <SkeletonBlock className="skeleton-line skeleton-line-short" />
                  <SkeletonBlock className="skeleton-chart-title" />
                </span>
              </header>
              <SkeletonBlock className="skeleton-chart-plot" />
            </section>
          ))}
        </div>
        <section className="activity-panel skeleton-activity-panel">
          <header>
            <span>
              <SkeletonBlock className="skeleton-line skeleton-line-short" />
              <SkeletonBlock className="skeleton-chart-title" />
            </span>
          </header>
          <SkeletonBlock className="skeleton-activity-calendar" />
        </section>
      </div>
    );
  }

  if (view === 'diary') {
    return (
      <div aria-label="Loading diary" className="screen-loading diary-loading" role="status">
        <header className="month-summary skeleton-month-summary">
          <div className="month-summary-title">
            <SkeletonBlock className="skeleton-line skeleton-line-short" />
            <SkeletonBlock className="skeleton-month-title" />
          </div>
          <dl className="month-metrics skeleton-month-metrics">
            {repeatBlocks(5, (index) => (
              <div className={index === 4 ? 'skeleton-month-metric summary-wide' : 'skeleton-month-metric'} key={index}>
                <dt>
                  <SkeletonBlock className="skeleton-line skeleton-line-short" />
                </dt>
                <dd>
                  <SkeletonBlock className="skeleton-month-value" />
                </dd>
              </div>
            ))}
          </dl>
        </header>
        <div aria-hidden="true" className="view-switcher skeleton-view-switcher">
          {repeatBlocks(3, (index) => (
            <SkeletonBlock className="skeleton-tab" key={index} />
          ))}
        </div>
        <div className="diary-list skeleton-diary-list">
          {repeatBlocks(3, (index) => (
            <article className="diary-entry skeleton-diary-entry" key={index}>
              <span className="entry-date skeleton-entry-date">
                <SkeletonBlock className="skeleton-date-day" />
                <small>
                  <SkeletonBlock className="skeleton-line" />
                </small>
              </span>
              <div className="entry-body skeleton-entry-body">
                <SkeletonBlock className="film-poster film-poster-entry skeleton-entry-poster" />
                <div className="entry-copy skeleton-entry-copy">
                  <SkeletonBlock className="skeleton-line skeleton-line-short" />
                  <SkeletonBlock className="skeleton-entry-title" />
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-entry-marks" />
                  <SkeletonBlock className="skeleton-entry-action" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div aria-label="Loading settings" className="screen-loading settings-loading" role="status">
        {repeatBlocks(3, (index) => (
          <SkeletonBlock className="skeleton-panel" key={index} />
        ))}
      </div>
    );
  }

  if (view === 'detail') {
    return (
      <div aria-label="Loading film dossier" className="screen-loading detail-loading" role="status">
        <div className="skeleton-dossier">
          <SkeletonBlock className="skeleton-poster skeleton-poster-large" />
          <div className="skeleton-dossier-copy">
            <SkeletonBlock className="skeleton-title" />
            {repeatBlocks(5, (index) => (
              <SkeletonBlock className="skeleton-line" key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

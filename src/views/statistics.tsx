// ABOUTME: Renders viewing statistics as editorial strips, thin bars, compact tables, and a yearly grid.
// ABOUTME: Every figure derives from persisted viewing entries joined with cached film metadata.
import { EmptyState } from '../components/states.js';
import { formatRuntime, readArchiveCoverage, readArchiveStats, type ArchiveCoverage } from '../archive-model.js';
import { createLocalCalendarDate } from '../../shared/local-calendar.js';
import type { MovieLogState } from '../../shared/types.js';

interface StatisticsViewProps {
  coverage?: ArchiveCoverage;
  now?: Date;
  state: MovieLogState;
}

const activityMonthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  year: 'numeric'
});
const activityMonthShortFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
const lineChartWidth = 720;
const lineChartTop = 14;
const lineChartBottom = 154;

interface MonthlyTrendPoint {
  count: number;
  key: string;
  label: string;
  x: number;
  y: number;
}

function readMonthlyTrendPoints(
  months: Array<{ count: number; key: string; label: string }>,
  max: number
): MonthlyTrendPoint[] {
  return months.map((month, index) => ({
    ...month,
    x: months.length === 1 ? lineChartWidth / 2 : (index / (months.length - 1)) * lineChartWidth,
    y: lineChartBottom - (month.count / max) * (lineChartBottom - lineChartTop)
  }));
}

function shouldShowMonthLabel(index: number, count: number): boolean {
  if (count <= 6) {
    return true;
  }

  const step = Math.ceil((count - 1) / 5);
  return index === 0 || index === count - 1 || (index % step === 0 && index <= count - 1 - step);
}

function BarList({ maxRows = 8, rows }: { maxRows?: number; rows: Array<{ count: number; name: string }> }) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(1, ...visible.map((row) => row.count));

  return (
    <div className="bar-list">
      {visible.map((row) => (
        <div className="bar-list-row" key={row.name}>
          <span className="bar-list-label">{row.name}</span>
          <span className="bar-list-track">
            <i style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="bar-list-count">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export function StatisticsView({ coverage, now, state }: StatisticsViewProps) {
  const stats = readArchiveStats(state, now);
  const resolvedCoverage = coverage ?? readArchiveCoverage(state);

  if (stats.totalViewings === 0) {
    return (
      <EmptyState
        fragment="seam"
        hint="Statistics assemble themselves from your journal as you log viewings."
        title="Nothing to measure yet."
      />
    );
  }

  const visibleMonths = stats.months.slice(-14);
  const maxMonth = Math.max(1, ...visibleMonths.map((month) => month.count));
  const monthlyTrendPoints = readMonthlyTrendPoints(visibleMonths, maxMonth);
  const monthlyTrendPath = monthlyTrendPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const maxRating = Math.max(1, ...stats.ratings.map((rating) => rating.count));
  const maxYear = Math.max(1, ...stats.years.map((year) => year.count));
  const maxDecade = Math.max(1, ...stats.decades.map((decade) => decade.count));
  const activityMonths = stats.activity.filter(
    (day, index, activity) => index === 0 || day.date.slice(0, 7) !== activity[index - 1]?.date.slice(0, 7)
  );
  const visibleActivityMonths = activityMonths.filter((day, index, months) => {
    const firstMonth = months[0];
    const lastMonth = months.at(-1);

    if (index === 1 && firstMonth && day.week - firstMonth.week < 5) {
      return false;
    }

    if (index === months.length - 2 && lastMonth && lastMonth.week - day.week < 5) {
      return false;
    }

    return true;
  });

  return (
    <section className="statistics-view">
      <dl className="metric-strip">
        <div>
          <dt>Viewings</dt>
          <dd>{stats.totalViewings}</dd>
        </div>
        <div>
          <dt>Films</dt>
          <dd>{stats.filmViewings}</dd>
        </div>
        <div>
          <dt>Series episodes</dt>
          <dd>{stats.seriesEpisodes}</dd>
        </div>
        {stats.unknownViewings > 0 ? (
          <div>
            <dt>Unknown media</dt>
            <dd>{stats.unknownViewings}</dd>
          </div>
        ) : null}
        <div>
          <dt>Average rating</dt>
          <dd>{stats.averageRating?.toFixed(2) ?? '—'}</dd>
        </div>
        <div>
          <dt>Total runtime</dt>
          <dd>
            {stats.runtimeKnownCount === 0 ? '—' : formatRuntime(stats.totalRuntimeMinutes)}
            {stats.runtimeKnownCount > 0 && stats.runtimeKnownCount < stats.totalViewings ? (
              <small className="metric-note">{` / ${stats.runtimeKnownCount} known`}</small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Favorites</dt>
          <dd>{stats.favorites}</dd>
        </div>
        <div>
          <dt>Rewatches</dt>
          <dd>{stats.rewatches}</dd>
        </div>
      </dl>

      <section aria-label="Archive coverage" className="statistics-coverage">
        <div>
          <span>Catalog metadata</span>
          <strong>{`${resolvedCoverage.matched} of ${resolvedCoverage.total} enriched`}</strong>
          <small>
            {resolvedCoverage.unmatched > 0
              ? `${resolvedCoverage.unmatched} need review`
              : 'Matched details power posters and credits.'}
          </small>
        </div>
        <div>
          <span>Personal annotations</span>
          <strong>{`${resolvedCoverage.annotated} of ${resolvedCoverage.total} annotated`}</strong>
          <small>
            {resolvedCoverage.annotated === 0
              ? 'Ratings and favorites will appear after you annotate viewings.'
              : 'Ratings, reviews, favorites, tags, and viewing notes come only from logged viewings.'}
          </small>
        </div>
      </section>

      <div className="statistics-panels">
        <section className="chart-panel monthly-chart">
          <header>
            <p className="eyebrow">Frequency</p>
            <h2 id="monthly-viewings-title">Monthly viewings</h2>
          </header>
          {stats.months.length === 0 ? (
            <p className="chart-empty">No monthly activity yet.</p>
          ) : (
            <figure aria-labelledby="monthly-viewings-title" className="monthly-line-chart">
              <div aria-hidden="true" className="monthly-line-plot">
                <svg preserveAspectRatio="none" viewBox={`0 0 ${lineChartWidth} 170`}>
                  <line
                    className="monthly-line-baseline"
                    vectorEffect="non-scaling-stroke"
                    x1="0"
                    x2={lineChartWidth}
                    y1={lineChartBottom}
                    y2={lineChartBottom}
                  />
                  <path className="monthly-line-path" d={monthlyTrendPath} vectorEffect="non-scaling-stroke" />
                  {monthlyTrendPoints.map((point, index) => (
                    <circle
                      className={
                        index === monthlyTrendPoints.length - 1
                          ? 'monthly-line-point monthly-line-point-latest'
                          : 'monthly-line-point'
                      }
                      cx={point.x}
                      cy={point.y}
                      key={point.key}
                      r="3"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{`${point.label}: ${point.count}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>
              <div
                aria-hidden="true"
                className="monthly-line-labels"
                style={{ gridTemplateColumns: `repeat(${visibleMonths.length}, minmax(0, 1fr))` }}
              >
                {visibleMonths.map((month, index) => (
                  <span key={month.key}>{shouldShowMonthLabel(index, visibleMonths.length) ? month.label : null}</span>
                ))}
              </div>
              <figcaption className="visually-hidden">
                Monthly viewing trend for the latest {visibleMonths.length} recorded{' '}
                {visibleMonths.length === 1 ? 'month' : 'months'}.
                <ol className="monthly-line-values">
                  {visibleMonths.map((month) => (
                    <li key={month.key}>
                      {`${month.label}: ${month.count} ${month.count === 1 ? 'viewing' : 'viewings'}`}
                    </li>
                  ))}
                </ol>
              </figcaption>
            </figure>
          )}
        </section>

        <section className="chart-panel rating-chart">
          <header>
            <p className="eyebrow">Distribution</p>
            <h2>Ratings</h2>
          </header>
          {stats.ratings.length === 0 ? (
            <p className="chart-empty">No rated entries yet.</p>
          ) : (
            <div className="rating-bars">
              {stats.ratings.map((rating) => (
                <div className="rating-bar-row" key={rating.value}>
                  <span>{rating.value.toFixed(1)}</span>
                  <i style={{ width: `${(rating.count / maxRating) * 100}%` }} />
                  <small>{rating.count}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="chart-panel genre-chart">
          <header>
            <p className="eyebrow">Catalog</p>
            <h2>Genres</h2>
          </header>
          {stats.genres.length === 0 ? (
            <p className="chart-empty">No genre metadata yet.</p>
          ) : (
            <BarList rows={stats.genres} />
          )}
        </section>

        <section className="chart-panel director-chart">
          <header>
            <p className="eyebrow">Credits</p>
            <h2>Directors</h2>
          </header>
          {stats.directors.length === 0 ? (
            <p className="chart-empty">No director metadata yet.</p>
          ) : (
            <BarList rows={stats.directors} />
          )}
        </section>

        <section className="chart-panel decade-chart">
          <header>
            <p className="eyebrow">Eras</p>
            <h2>Favorite decades</h2>
          </header>
          {stats.decades.length === 0 ? (
            <p className="chart-empty">Mark favorite films to reveal preferred decades.</p>
          ) : (
            <div className="decade-rows">
              {stats.decades.map((decade) => (
                <div className="decade-row" key={decade.label}>
                  <span className="decade-label">{decade.label}</span>
                  <span className="bar-list-track">
                    <i style={{ width: `${(decade.count / maxDecade) * 100}%` }} />
                  </span>
                  <span className="decade-count">{decade.count}</span>
                  <span className="decade-rating">
                    {decade.averageRating === null ? '—' : `avg ${decade.averageRating.toFixed(1)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="chart-panel year-chart">
          <header>
            <p className="eyebrow">Year over year</p>
            <h2>Activity</h2>
          </header>
          <div className="year-columns">
            {stats.years.map((year) => (
              <div className="bar-column" key={year.year}>
                <div className="bar-column-plot">
                  <span className="bar-column-value">{year.count}</span>
                  <span
                    className="bar-column-bar"
                    style={{
                      height: `${Math.max(6, (year.count / maxYear) * 100)}%`
                    }}
                  />
                </div>
                <small>{year.year}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="activity-panel">
        <header>
          <p className="eyebrow">Production ledger</p>
          <h2>Yearly viewing activity</h2>
        </header>
        <div className="activity-calendar">
          <div aria-hidden="true" className="activity-months">
            {visibleActivityMonths.map((day, index) => (
              <span
                className="activity-month-label"
                key={day.date}
                style={{
                  gridColumn:
                    index === visibleActivityMonths.length - 1
                      ? `${Math.max(1, day.week - 2)} / -1`
                      : `${day.week + 1} / span 4`,
                  gridRow: 1,
                  justifySelf: index === visibleActivityMonths.length - 1 ? 'end' : undefined
                }}
              >
                {index === 0 || index === visibleActivityMonths.length - 1 || day.date.slice(5, 7) === '01'
                  ? activityMonthFormatter.format(createLocalCalendarDate(day.date))
                  : activityMonthShortFormatter.format(createLocalCalendarDate(day.date))}
              </span>
            ))}
          </div>
          <div aria-hidden="true" className="activity-weekdays">
            <span className="activity-weekday" style={{ gridRow: 2 }}>
              Mon
            </span>
            <span className="activity-weekday" style={{ gridRow: 4 }}>
              Wed
            </span>
            <span className="activity-weekday" style={{ gridRow: 6 }}>
              Fri
            </span>
          </div>
          <div aria-hidden="true" className="activity-grid">
            {stats.activity.map((day) => (
              <span
                className={`activity-cell activity-level-${Math.min(3, day.count)}`}
                key={day.date}
                style={{ gridColumn: day.week + 1, gridRow: day.weekday + 1 }}
              />
            ))}
          </div>
          <ul className="visually-hidden activity-accessible-summary">
            {stats.activity.some((day) => day.count > 0) ? (
              stats.activity
                .filter((day) => day.count > 0)
                .map((day) => (
                  <li key={day.date}>{`${day.date}: ${day.count} ${day.count === 1 ? 'viewing' : 'viewings'}`}</li>
                ))
            ) : (
              <li>No viewings in the last 365 days.</li>
            )}
          </ul>
        </div>
      </section>

      {stats.tags.length > 0 ? (
        <section className="tag-frequency">
          <p className="eyebrow">Tag register</p>
          <div className="tag-frequency-list">
            {stats.tags.map((tag) => (
              <span key={tag.name}>
                {tag.name} <strong>{tag.count}</strong>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

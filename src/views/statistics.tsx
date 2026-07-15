// ABOUTME: Renders viewing statistics as editorial strips, thin bars, compact tables, and a yearly grid.
// ABOUTME: Every figure derives from persisted diary entries joined with cached film metadata.
import { EmptyState } from '../components/states.js';
import { formatRuntime, readArchiveStats } from '../archive-model.js';
import type { MovieLogState } from '../../shared/types.js';

interface StatisticsViewProps {
  now?: Date;
  state: MovieLogState;
}

const activityMonthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric'
});

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

export function StatisticsView({ now, state }: StatisticsViewProps) {
  const stats = readArchiveStats(state, now);

  if (stats.totalViewings === 0) {
    return (
      <EmptyState
        fragment="seam"
        hint="Statistics assemble themselves from your diary as you log films."
        title="Nothing to measure yet."
      />
    );
  }

  const maxMonth = Math.max(1, ...stats.months.map((month) => month.count));
  const maxRating = Math.max(1, ...stats.ratings.map((rating) => rating.count));
  const maxYear = Math.max(1, ...stats.years.map((year) => year.count));
  const maxDecade = Math.max(1, ...stats.decades.map((decade) => decade.count));
  const activityMonths = stats.activity.filter(
    (day, index, activity) => index === 0 || day.date.slice(0, 7) !== activity[index - 1]?.date.slice(0, 7)
  );

  return (
    <section className="statistics-view">
      <dl className="metric-strip">
        <div>
          <dt>Viewings</dt>
          <dd>{stats.totalViewings}</dd>
        </div>
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

      <div className="statistics-panels">
        <section className="chart-panel monthly-chart">
          <header>
            <p className="eyebrow">Frequency</p>
            <h2>Monthly viewings</h2>
          </header>
          {stats.months.length === 0 ? (
            <p className="chart-empty">No monthly activity yet.</p>
          ) : (
            <div className="bar-chart">
              {stats.months.slice(-14).map((month) => (
                <div className="bar-column" key={month.key}>
                  <div className="bar-column-plot">
                    <span className="bar-column-value">{month.count}</span>
                    <span
                      className="bar-column-bar"
                      style={{
                        height: `${Math.max(6, (month.count / maxMonth) * 100)}%`
                      }}
                    />
                  </div>
                  <small>{month.label}</small>
                </div>
              ))}
            </div>
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
            {activityMonths.map((day) => (
              <span className="activity-month-label" key={day.date} style={{ gridColumn: day.week + 1 }}>
                {activityMonthFormatter.format(new Date(`${day.date}T00:00:00.000Z`))}
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
          <div aria-label="Daily viewing counts for the last 365 days" className="activity-grid" role="group">
            {stats.activity.map((day) => (
              <span
                aria-label={`${day.date}: ${day.count} ${day.count === 1 ? 'viewing' : 'viewings'}`}
                className={`activity-cell activity-level-${Math.min(3, day.count)}`}
                key={day.date}
                role="img"
                style={{ gridColumn: day.week + 1, gridRow: day.weekday + 1 }}
                title={`${day.date} · ${day.count}`}
              />
            ))}
          </div>
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

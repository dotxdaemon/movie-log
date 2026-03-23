// ABOUTME: Computes weekly entry trend points for matchup pages.
// ABOUTME: Produces deterministic grouped counts to render a lightweight sparkline.
import type { MatchEntry } from '../types'
import { getLocalWeekStart } from './local-date'

export interface TrendPoint {
  weekStart: string
  count: number
}

export function buildWeeklyTrend(
  entries: MatchEntry[],
  timeZone?: string,
): TrendPoint[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const weekStart = getLocalWeekStart(entry.date, timeZone)
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

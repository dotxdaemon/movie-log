// ABOUTME: Verifies weekly trend grouping follows the same local calendar users see in the UI.
// ABOUTME: Prevents UTC week bucketing from disagreeing with displayed matchup dates.
import { describe, expect, it } from 'vitest'
import type { MatchEntry } from '../types'
import { buildWeeklyTrend } from './trends'

describe('buildWeeklyTrend', () => {
  it('groups entries by local week start instead of UTC week start', () => {
    const entries: MatchEntry[] = [
      {
        id: 'sunday-local',
        date: '2026-03-23T01:30:00.000Z',
        opponentCharacter: 'Mario',
        situationTags: ['corner'],
      },
      {
        id: 'monday-local',
        date: '2026-03-23T18:00:00.000Z',
        opponentCharacter: 'Mario',
        situationTags: ['corner'],
      },
    ]

    expect(buildWeeklyTrend(entries, 'America/Denver')).toEqual([
      { count: 1, weekStart: '2026-03-16' },
      { count: 1, weekStart: '2026-03-23' },
    ])
  })
})

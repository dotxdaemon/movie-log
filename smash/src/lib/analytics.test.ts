// ABOUTME: Verifies matchup aggregation, drill selection, and focus rule generation.
// ABOUTME: Uses deterministic fixtures to lock behavior for recurring pattern summaries.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchEntry } from '../types'
import {
  computeWorstMatchups,
  getTodayFocus,
  summarizeMatchup,
} from './analytics'

const entries: MatchEntry[] = [
  {
    id: '1',
    date: '2026-02-01T10:00:00.000Z',
    yourCharacter: 'Wolf',
    opponentCharacter: 'ZSS',
    stage: 'PS2',
    stockContext: '100-150',
    situationTags: ['ledge', 'disadvantage'],
    deathCauseText: 'Jumped from ledge into fair',
    deathCauseCategory: 'ledge option',
    whatWorked: 'Held center',
    oneRuleNextTime: 'No jump from ledge unless they commit',
    confidence: 2,
  },
  {
    id: '2',
    date: '2026-02-03T10:00:00.000Z',
    opponentCharacter: 'ZSS',
    stage: 'Kalos',
    situationTags: ['ledge', 'scramble'],
    deathCauseText: 'Rolled from ledge into up smash',
    deathCauseCategory: 'ledge option',
    oneRuleNextTime: 'no jump from ledge unless they commit!',
    confidence: 3,
  },
  {
    id: '3',
    date: '2026-02-05T10:00:00.000Z',
    opponentCharacter: 'ZSS',
    stage: 'PS2',
    situationTags: ['disadvantage', 'juggle'],
    deathCauseText: 'Airdodged to stage every time',
    deathCauseCategory: 'panic option in disadvantage',
    oneRuleNextTime: 'If cornered, dash shield first, do not swing',
    confidence: 1,
  },
  {
    id: '4',
    date: '2026-02-02T10:00:00.000Z',
    opponentCharacter: 'Cloud',
    stage: 'Town',
    situationTags: ['neutral'],
    deathCauseText: 'Got anti aired',
    deathCauseCategory: 'getting anti-aired',
    oneRuleNextTime: 'Grounded neutral only',
    confidence: 2,
  },
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('summarizeMatchup', () => {
  it('returns top recurrence values and deterministic drill for one opponent', () => {
    const summary = summarizeMatchup(entries, 'ZSS')

    expect(summary.totalEntries).toBe(3)
    expect(summary.topDeathCauseCategory).toBe('ledge option')
    expect(summary.topTags).toEqual(['ledge', 'disadvantage', 'juggle'])
    expect(summary.mostCommonRule).toBe('No jump from ledge unless they commit')
    expect(summary.nextDrill.title).toContain('10 reps per ledge option')
    expect(summary.focusRule).toBe('No jump from ledge unless you saw them commit')
  })
})

describe('computeWorstMatchups', () => {
  it('sorts by negative entry count in range', () => {
    const worst = computeWorstMatchups(entries, {
      startDate: '2026-01-30T00:00:00.000Z',
      endDate: '2026-02-28T00:00:00.000Z',
      limit: 2,
    })

    expect(worst).toEqual([
      { opponentCharacter: 'ZSS', negativeCount: 3 },
      { opponentCharacter: 'Cloud', negativeCount: 1 },
    ])
  })
})

describe('getTodayFocus', () => {
  it('uses recent entries to return a single global focus', () => {
    const todayFocus = getTodayFocus(entries)

    expect(todayFocus?.opponentCharacter).toBe('ZSS')
    expect(todayFocus?.rule).toBe('No jump from ledge unless you saw them commit')
  })

  it('keeps the issue, rule, and drill on the same recent matchup summary', () => {
    const todayFocus = getTodayFocus([
      {
        id: 'old-1',
        date: '2026-01-02T10:00:00.000Z',
        opponentCharacter: 'ZSS',
        situationTags: ['ledge'],
        deathCauseText: 'jumped from ledge',
        deathCauseCategory: 'ledge option',
      },
      {
        id: 'recent-1',
        date: '2026-02-19T10:00:00.000Z',
        opponentCharacter: 'ZSS',
        situationTags: ['platform'],
        deathCauseText: 'airdodged into platform trap',
        deathCauseCategory: 'landing habit',
      },
      {
        id: 'recent-2',
        date: '2026-02-20T09:00:00.000Z',
        opponentCharacter: 'ZSS',
        situationTags: ['landing'],
        deathCauseText: 'same landing timing',
        deathCauseCategory: 'landing habit',
      },
    ])

    expect(todayFocus?.summary.topDeathCauseCategory).toBe('landing habit')
    expect(todayFocus?.summary.focusRule).toBe(todayFocus?.rule)
    expect(todayFocus?.summary.nextDrill.categories).toContain('landing habit')
  })
})

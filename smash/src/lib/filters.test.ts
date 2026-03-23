// ABOUTME: Verifies entry filtering and text search behavior for the entry log.
// ABOUTME: Ensures combined filters remain deterministic and composable.
import { describe, expect, it } from 'vitest'
import type { MatchEntry } from '../types'
import { filterEntries } from './filters'

const entries: MatchEntry[] = [
  {
    id: '1',
    date: '2026-02-01T10:00:00.000Z',
    opponentCharacter: 'ZSS',
    stage: 'PS2',
    situationTags: ['ledge', 'disadvantage'],
    deathCauseText: 'jumped from ledge into fair',
    deathCauseCategory: 'ledge option',
    oneRuleNextTime: 'No jump from ledge until they commit',
  },
  {
    id: '2',
    date: '2026-02-02T10:00:00.000Z',
    opponentCharacter: 'Cloud',
    stage: 'Town',
    situationTags: ['neutral'],
    deathCauseText: 'unsafe nair on shield',
    deathCauseCategory: 'unsafe aerial on shield',
    notes: 'Panic jump after corner shield was the real issue.',
  },
  {
    id: '3',
    date: '2026-02-03T10:00:00.000Z',
    opponentCharacter: 'ZSS',
    stage: 'Hollow Bastion',
    situationTags: ['platform'],
    deathCauseText: 'got hit trying to land',
    deathCauseCategory: 'landing habit',
    whatWorked: 'Held center and reset before landing.',
  },
]

describe('filterEntries', () => {
  it('applies opponent, tag, stage, date, and death cause search filters', () => {
    const filtered = filterEntries(entries, {
      opponentCharacter: 'ZSS',
      tag: 'ledge',
      stage: 'PS2',
      startDate: '2026-02-01',
      endDate: '2026-02-01',
      deathCauseSearch: 'fair',
    })

    expect(filtered.map((entry) => entry.id)).toEqual(['1'])
  })

  it('returns all entries when filters are empty', () => {
    const filtered = filterEntries(entries, {})

    expect(filtered).toHaveLength(3)
  })

  it('searches note text, what worked, and next-set rules in addition to death cause', () => {
    const noteMatch = filterEntries(entries, {
      deathCauseSearch: 'panic jump',
    })
    const whatWorkedMatch = filterEntries(entries, {
      deathCauseSearch: 'held center',
    })
    const ruleMatch = filterEntries(entries, {
      deathCauseSearch: 'no jump from ledge',
    })

    expect(noteMatch.map((entry) => entry.id)).toEqual(['2'])
    expect(whatWorkedMatch.map((entry) => entry.id)).toEqual(['3'])
    expect(ruleMatch.map((entry) => entry.id)).toEqual(['1'])
  })

  it('matches the displayed local calendar day around UTC midnight', () => {
    const filtered = filterEntries(
      [
        {
          id: 'late-night',
          date: '2026-03-23T01:30:00.000Z',
          opponentCharacter: 'Mario',
          situationTags: ['corner'],
        },
      ],
      {
        startDate: '2026-03-22',
        endDate: '2026-03-22',
      },
      'America/Denver',
    )

    expect(filtered.map((entry) => entry.id)).toEqual(['late-night'])
  })
})

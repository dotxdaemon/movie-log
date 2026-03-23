// ABOUTME: Applies composable filters for opponent, tags, stage, date, and death-cause text.
// ABOUTME: Powers the entry log search flow without introducing remote dependencies.
import type { MatchEntry, SituationTag } from '../types'
import { toLocalDateKey } from './local-date'

export interface EntryFilters {
  opponentCharacter?: string
  tag?: SituationTag
  stage?: string
  startDate?: string
  endDate?: string
  deathCauseSearch?: string
}

export function filterEntries(
  entries: MatchEntry[],
  filters: EntryFilters,
  timeZone?: string,
): MatchEntry[] {
  const searchValue = filters.deathCauseSearch?.trim().toLowerCase()

  return entries.filter((entry) => {
    if (
      filters.opponentCharacter &&
      entry.opponentCharacter !== filters.opponentCharacter
    ) {
      return false
    }

    if (filters.tag && !entry.situationTags.includes(filters.tag)) {
      return false
    }

    if (filters.stage && entry.stage !== filters.stage) {
      return false
    }

    const entryDateKey = toLocalDateKey(entry.date, timeZone)

    if (filters.startDate && entryDateKey < filters.startDate) {
      return false
    }

    if (filters.endDate && entryDateKey > filters.endDate) {
      return false
    }

    if (searchValue && !matchesSearch(entry, searchValue)) {
      return false
    }

    return true
  })
}

function matchesSearch(entry: MatchEntry, searchValue: string): boolean {
  return [
    entry.deathCauseText,
    entry.notes,
    entry.whatWorked,
    entry.oneRuleNextTime,
  ].some((value) => value?.toLowerCase().includes(searchValue))
}

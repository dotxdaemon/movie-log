// ABOUTME: Computes matchup recurrence summaries and global focus recommendations.
// ABOUTME: Converts logged entry patterns into deterministic drills and concise rules.
import {
  SITUATION_TAGS,
  type DeathCauseCategory,
  type MatchEntry,
  type MatchupSummary,
  type SituationTag,
} from '../types'
import { getDrillByCategory } from './drills'

interface WorstMatchupsOptions {
  startDate?: string
  endDate?: string
  limit?: number
}

interface TodayFocus {
  opponentCharacter: string
  rule: string
  summary: MatchupSummary
}

const TAG_ORDER = new Map(SITUATION_TAGS.map((tag, index) => [tag, index]))

const FOCUS_RULES: Record<DeathCauseCategory, string> = {
  'ledge option': 'No jump from ledge unless you saw them commit',
  'panic option in disadvantage':
    'When juggled, drift first and delay panic buttons',
  'landing habit': 'Vary landings and avoid repeated airdodge timings',
  'shield habit': 'In pressure, choose one shield timing and stick to it',
  'unsafe aerial on shield': 'On shield, single safe aerial then disengage',
  'whiff punish failure': 'Hold center and punish only after clear whiff',
  'approach pattern': 'Reset approach rhythm with dash shield first',
  'getting boxed out': 'Respect range and step in only after shield stop',
  'bad DI / no SDI': 'At high percent, commit to DI before hit confirms',
  'missed kill confirm': 'At kill percent, fish only for one confirm route',
  'missed OOS': 'Shield first, then choose one OOS response on reaction',
  'getting anti-aired': 'In neutral, stay grounded until they commit upward',
}

export function summarizeMatchup(
  entries: MatchEntry[],
  opponentCharacter: string,
): MatchupSummary {
  const matchupEntries = entries.filter(
    (entry) => entry.opponentCharacter === opponentCharacter,
  )

  const topDeathCauseCategory = countTopValue(
    matchupEntries
      .map((entry) => entry.deathCauseCategory)
      .filter((value): value is DeathCauseCategory => Boolean(value)),
  ) as DeathCauseCategory | undefined

  const topTags = countTopTags(
    matchupEntries
      .filter((entry) => Boolean(entry.deathCauseText || entry.deathCauseCategory))
      .flatMap((entry) => entry.situationTags),
    3,
  )

  const mostCommonRule = pickMostCommonRule(
    matchupEntries
      .map((entry) => entry.oneRuleNextTime)
      .filter((rule): rule is string => Boolean(rule)),
  )

  const nextDrill = getDrillByCategory(topDeathCauseCategory)
  const focusRule =
    (topDeathCauseCategory && FOCUS_RULES[topDeathCauseCategory]) ||
    mostCommonRule ||
    'Play patient neutral and avoid autopilot options'

  return {
    opponentCharacter,
    totalEntries: matchupEntries.length,
    topDeathCauseCategory,
    topTags,
    mostCommonRule,
    nextDrill,
    focusRule,
  }
}

export function computeWorstMatchups(
  entries: MatchEntry[],
  options: WorstMatchupsOptions,
): { opponentCharacter: string; negativeCount: number }[] {
  const filteredEntries = entries.filter((entry) => {
    if (!entry.deathCauseText && !entry.deathCauseCategory) {
      return false
    }

    if (options.startDate && entry.date < options.startDate) {
      return false
    }

    if (options.endDate && entry.date > options.endDate) {
      return false
    }

    return true
  })

  const counts = new Map<string, number>()
  for (const entry of filteredEntries) {
    counts.set(
      entry.opponentCharacter,
      (counts.get(entry.opponentCharacter) ?? 0) + 1,
    )
  }

  return Array.from(counts.entries())
    .map(([opponentCharacter, negativeCount]) => ({
      opponentCharacter,
      negativeCount,
    }))
    .sort((a, b) => {
      if (b.negativeCount !== a.negativeCount) {
        return b.negativeCount - a.negativeCount
      }

      return a.opponentCharacter.localeCompare(b.opponentCharacter)
    })
    .slice(0, options.limit ?? 3)
}

export function getTodayFocus(entries: MatchEntry[]): TodayFocus | undefined {
  const now = Date.now()
  const lastThirtyDays = entries.filter((entry) => {
    const entryTime = Date.parse(entry.date)
    return now - entryTime <= 30 * 24 * 60 * 60 * 1000
  })

  const worst = computeWorstMatchups(lastThirtyDays, { limit: 1 })[0]
  if (!worst) {
    return undefined
  }

  const summary = summarizeMatchup(lastThirtyDays, worst.opponentCharacter)
  return {
    opponentCharacter: worst.opponentCharacter,
    rule: summary.focusRule,
    summary,
  }
}

function countTopValue(values: string[]): string | undefined {
  return countTopValues(values, 1)[0]
}

function countTopTags(values: SituationTag[], limit: number): SituationTag[] {
  const counts = new Map<SituationTag, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }

      return (TAG_ORDER.get(a.value) ?? 1000) - (TAG_ORDER.get(b.value) ?? 1000)
    })
    .slice(0, limit)
    .map((item) => item.value)
}

function countTopValues(values: string[], limit: number): string[] {
  const counts = new Map<string, { count: number; firstSeenIndex: number }>()
  for (const [index, value] of values.entries()) {
    const existing = counts.get(value)
    if (existing) {
      existing.count += 1
      continue
    }

    counts.set(value, { count: 1, firstSeenIndex: index })
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, ...count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }

      return a.firstSeenIndex - b.firstSeenIndex
    })
    .slice(0, limit)
    .map((item) => item.value)
}

function pickMostCommonRule(rules: string[]): string | undefined {
  const normalizedRuleMap = new Map<
    string,
    { count: number; representative: string }
  >()

  for (const rule of rules) {
    const normalized = normalizeRule(rule)
    if (!normalized) {
      continue
    }

    const current = normalizedRuleMap.get(normalized)
    if (current) {
      current.count += 1
      continue
    }

    normalizedRuleMap.set(normalized, {
      count: 1,
      representative: sanitizeRule(rule),
    })
  }

  const rankedRules = Array.from(normalizedRuleMap.entries())
    .map(([normalized, value]) => ({ normalized, ...value }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }

      return a.normalized.localeCompare(b.normalized)
    })

  return rankedRules[0]?.representative
}

function normalizeRule(rule: string): string {
  return sanitizeRule(rule)
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\bdo not\b/g, 'dont')
    .replace(/\bdon't\b/g, 'dont')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeRule(rule: string): string {
  return rule.trim().replace(/[\s]+/g, ' ').replace(/[!?.]+$/g, '')
}

// ABOUTME: Persists entries and pinned drills in localStorage using a versioned payload.
// ABOUTME: Keeps the MVP local-only while supporting safe schema evolution.
import {
  DEATH_CAUSE_CATEGORIES,
  SITUATION_TAGS,
  STOCK_CONTEXTS,
  type MatchEntry,
} from '../types'

const STORAGE_KEY = 'smash-matchup-lab.v1'
const STORAGE_VERSION = 1
const EMPTY_STATE: SavedState = { entries: [], pinnedDrills: [] }
const STOCK_CONTEXT_SET = new Set<string>(STOCK_CONTEXTS)
const SITUATION_TAG_SET = new Set<string>(SITUATION_TAGS)
const DEATH_CAUSE_CATEGORY_SET = new Set<string>(DEATH_CAUSE_CATEGORIES)

export interface SavedState {
  entries: MatchEntry[]
  pinnedDrills: string[]
}

export type LoadStateStatus =
  | 'empty'
  | 'ready'
  | 'invalid'
  | 'future-version'
  | 'parse-error'

export type SaveStateStatus = 'saved' | 'write-error'

export type LoadStateResult =
  | { state: SavedState; status: 'empty' | 'ready' }
  | { state: SavedState; status: 'invalid' | 'future-version' | 'parse-error' }

export type SaveStateResult =
  | { ok: true; status: 'saved' }
  | { error: Error; ok: false; status: 'write-error' }

export type CommitStateResult =
  | { ok: true; state: SavedState; status: 'saved' }
  | { error: Error; ok: false; state: SavedState; status: 'write-error' }

interface StoredStateV1 extends SavedState {
  version: number
}

export function loadState(storageLike: Storage | undefined = getStorage()): LoadStateResult {
  const rawValue = storageLike?.getItem(STORAGE_KEY)
  if (!rawValue) {
    return { state: EMPTY_STATE, status: 'empty' }
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown
    if (!isStoredState(parsedValue)) {
      return { state: EMPTY_STATE, status: 'invalid' }
    }

    if (parsedValue.version !== STORAGE_VERSION) {
      return { state: EMPTY_STATE, status: 'future-version' }
    }

    if (
      !parsedValue.entries.every(isMatchEntry) ||
      !parsedValue.pinnedDrills.every((item) => typeof item === 'string')
    ) {
      return { state: EMPTY_STATE, status: 'invalid' }
    }

    return {
      state: {
        entries: parsedValue.entries,
        pinnedDrills: parsedValue.pinnedDrills,
      },
      status: 'ready',
    }
  } catch {
    return { state: EMPTY_STATE, status: 'parse-error' }
  }
}

export function saveState(
  state: SavedState,
  storageLike: Storage | undefined = getStorage(),
): SaveStateResult {
  const value: StoredStateV1 = {
    version: STORAGE_VERSION,
    entries: state.entries,
    pinnedDrills: state.pinnedDrills,
  }

  if (!storageLike) {
    return {
      error: new Error('local storage unavailable'),
      ok: false,
      status: 'write-error',
    }
  }

  try {
    storageLike.setItem(STORAGE_KEY, JSON.stringify(value))
    return { ok: true, status: 'saved' }
  } catch (error) {
    return {
      error: asError(error),
      ok: false,
      status: 'write-error',
    }
  }
}

export function commitState(
  currentState: SavedState,
  update: (currentState: SavedState) => SavedState,
  storageLike: Storage | undefined = getStorage(),
): CommitStateResult {
  const nextState = update(currentState)
  const result = saveState(nextState, storageLike)

  if (!result.ok) {
    return {
      ...result,
      state: currentState,
    }
  }

  return {
    ok: true,
    state: nextState,
    status: 'saved',
  }
}

function getStorage(): Storage | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined
  }

  return localStorage
}

function isStoredState(value: unknown): value is StoredStateV1 {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.version === 'number' &&
    Array.isArray(value.entries) &&
    Array.isArray(value.pinnedDrills)
  )
}

function isMatchEntry(value: unknown): value is MatchEntry {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.id !== 'string' ||
    !isFiniteDateString(value.date) ||
    typeof value.opponentCharacter !== 'string' ||
    !Array.isArray(value.situationTags)
  ) {
    return false
  }

  if (
    value.yourCharacter !== undefined &&
    typeof value.yourCharacter !== 'string'
  ) {
    return false
  }

  if (value.stage !== undefined && typeof value.stage !== 'string') {
    return false
  }

  if (
    value.stockContext !== undefined &&
    (typeof value.stockContext !== 'string' ||
      !STOCK_CONTEXT_SET.has(value.stockContext))
  ) {
    return false
  }

  if (
    !value.situationTags.every(
      (tag) => typeof tag === 'string' && SITUATION_TAG_SET.has(tag),
    )
  ) {
    return false
  }

  if (
    value.deathCauseText !== undefined &&
    typeof value.deathCauseText !== 'string'
  ) {
    return false
  }

  if (
    value.deathCauseCategory !== undefined &&
    (typeof value.deathCauseCategory !== 'string' ||
      !DEATH_CAUSE_CATEGORY_SET.has(value.deathCauseCategory))
  ) {
    return false
  }

  if (
    value.whatWorked !== undefined &&
    typeof value.whatWorked !== 'string'
  ) {
    return false
  }

  if (
    value.oneRuleNextTime !== undefined &&
    typeof value.oneRuleNextTime !== 'string'
  ) {
    return false
  }

  if (value.clipLink !== undefined && typeof value.clipLink !== 'string') {
    return false
  }

  if (
    value.confidence !== undefined &&
    value.confidence !== 1 &&
    value.confidence !== 2 &&
    value.confidence !== 3
  ) {
    return false
  }

  if (value.notes !== undefined && typeof value.notes !== 'string') {
    return false
  }

  return true
}

function isFiniteDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(String(error))
}

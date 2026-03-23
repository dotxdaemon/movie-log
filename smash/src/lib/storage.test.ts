// ABOUTME: Verifies notebook hydration and persistence behavior around local storage.
// ABOUTME: Prevents malformed payloads, write failures, and stale updates from corrupting saved data.
import { describe, expect, it } from 'vitest'
import type { MatchEntry } from '../types'
import {
  commitState,
  loadState,
  saveState,
  type SavedState,
} from './storage'

const validEntry: MatchEntry = {
  id: 'entry-1',
  date: '2026-03-23T12:00:00.000Z',
  opponentCharacter: 'Mario',
  situationTags: ['corner'],
  deathCauseText: 'jumped from corner',
}

describe('loadState', () => {
  it('returns parse-error when storage contains malformed JSON', () => {
    const storage = createStorageMock({
      'smash-matchup-lab.v1': '{bad json',
    })

    expect(loadState(storage)).toEqual({
      state: { entries: [], pinnedDrills: [] },
      status: 'parse-error',
    })
  })

  it('returns future-version when storage contains a newer payload version', () => {
    const storage = createStorageMock({
      'smash-matchup-lab.v1': JSON.stringify({
        version: 99,
        entries: [validEntry],
        pinnedDrills: [],
      }),
    })

    expect(loadState(storage)).toEqual({
      state: { entries: [], pinnedDrills: [] },
      status: 'future-version',
    })
  })

  it('returns invalid when an entry shape is malformed', () => {
    const storage = createStorageMock({
      'smash-matchup-lab.v1': JSON.stringify({
        version: 1,
        entries: [{ id: 'broken', situationTags: null }],
        pinnedDrills: [],
      }),
    })

    expect(loadState(storage)).toEqual({
      state: { entries: [], pinnedDrills: [] },
      status: 'invalid',
    })
  })

  it('returns ready with validated entries and pinned drills', () => {
    const storage = createStorageMock({
      'smash-matchup-lab.v1': JSON.stringify({
        version: 1,
        entries: [validEntry],
        pinnedDrills: ['Drill title'],
      }),
    })

    expect(loadState(storage)).toEqual({
      state: {
        entries: [validEntry],
        pinnedDrills: ['Drill title'],
      },
      status: 'ready',
    })
  })
})

describe('saveState', () => {
  it('returns a failure result when local storage rejects a write', () => {
    const storage = createStorageMock(undefined, true)

    expect(
      saveState(
        {
          entries: [validEntry],
          pinnedDrills: [],
        },
        storage,
      ),
    ).toEqual({
      error: new Error('write failed'),
      ok: false,
      status: 'write-error',
    })
  })
})

describe('commitState', () => {
  it('keeps the current state when persistence fails', () => {
    const current: SavedState = {
      entries: [validEntry],
      pinnedDrills: [],
    }
    const storage = createStorageMock(undefined, true)

    const result = commitState(
      current,
      (state) => ({
        ...state,
        entries: [{ ...validEntry, id: 'entry-2' }, ...state.entries],
      }),
      storage,
    )

    expect(result).toEqual({
      error: new Error('write failed'),
      ok: false,
      state: current,
      status: 'write-error',
    })
  })

  it('applies sequential updates from current state without dropping entries', () => {
    const storage = createStorageMock()
    const current: SavedState = { entries: [], pinnedDrills: [] }

    const first = commitState(
      current,
      (state) => ({
        ...state,
        entries: [{ ...validEntry, id: 'entry-1' }, ...state.entries],
      }),
      storage,
    )
    const second = commitState(
      first.state,
      (state) => ({
        ...state,
        entries: [{ ...validEntry, id: 'entry-2' }, ...state.entries],
      }),
      storage,
    )

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.state.entries.map((entry) => entry.id)).toEqual([
      'entry-2',
      'entry-1',
    ])
  })
})

function createStorageMock(
  initialValues?: Record<string, string>,
  shouldThrowOnSet = false,
): Storage {
  const values = new Map<string, string>(Object.entries(initialValues ?? {}))

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      if (shouldThrowOnSet) {
        throw new Error('write failed')
      }

      values.set(key, value)
    },
  }
}

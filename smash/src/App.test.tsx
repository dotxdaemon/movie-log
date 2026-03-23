// ABOUTME: Verifies the notebook shell and navigation structure for the main app UI.
// ABOUTME: Locks the redesigned front-end landmarks without depending on browser-only APIs.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

describe('App notebook shell', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    })
  })

  it('renders separate desktop and mobile navigation landmarks', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('aria-label="Notebook navigation"')
    expect(markup).toContain('aria-label="Mobile navigation"')
    expect(markup).toContain('>Dashboard</span>')
    expect(markup).toContain('>Log Set</span>')
    expect(markup).toContain('>Matchups</span>')
    expect(markup).toContain('>Notes</span>')
    expect(markup).toContain('>Drills</span>')
    expect(markup).not.toContain('>New Entry</span>')
    expect(markup).not.toContain('>Entry Log</span>')
    expect(markup).not.toContain('>Drill Library</span>')
  })

  it('renders the simplified dashboard loop', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('data-shell="tournament-notebook"')
    expect(markup).toContain('data-section="dashboard-topbar"')
    expect(markup).toContain('data-topbar-tone="notebook"')
    expect(markup).toContain('data-section="training-console"')
    expect(markup).toContain('data-focus-layout="coaching"')
    expect(markup).toContain('data-focus-item="issue"')
    expect(markup).toContain('data-focus-item="rule"')
    expect(markup).toContain('data-focus-item="drill"')
    expect(markup).toContain('data-section="recent-notes"')
    expect(markup).toContain('data-log-link="inline"')
    expect(markup).toContain('data-nav-tone="integrated"')
    expect(markup).toContain('href="#main-content"')
    expect(markup).toContain('id="main-content"')
    expect(markup.match(/Log Set/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(markup).not.toContain('data-section="summary-stats"')
    expect(markup).not.toContain('data-section="matchup-patterns"')
    expect(markup).not.toContain('data-section="drill-preview"')
    expect(markup).not.toContain('data-section="dashboard-header"')
    expect(markup).not.toContain('data-section="current-focus"')
    expect(markup).not.toContain('data-section="masthead"')
    expect(markup).not.toContain('data-section="focus-board"')
  })

  it('renders the entry form with explicit status and grouped tag semantics', () => {
    const markup = renderToStaticMarkup(<App initialView="entry" />)

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-describedby="entry-shortcuts"')
    expect(markup).toContain('aria-label="Situation tags"')
  })

  it('keeps the full notebook cover scoped to the dashboard view', () => {
    const dashboardMarkup = renderToStaticMarkup(<App />)
    const entryMarkup = renderToStaticMarkup(<App initialView="entry" />)

    expect(dashboardMarkup).not.toContain('<header class="cover-sheet panel animated-entry">')
    expect(dashboardMarkup).toContain('data-section="dashboard-topbar"')
    expect(entryMarkup).not.toContain('<header class="cover-sheet panel animated-entry">')
    expect(entryMarkup).toContain('id="entry-title"')
    expect(entryMarkup).toContain('>Log Set</h2>')
    expect(entryMarkup).not.toContain('data-section="dashboard-topbar"')
  })

  it('renders a recovery state instead of an empty notebook when saved data is invalid', () => {
    globalThis.localStorage.setItem(
      'smash-matchup-lab.v1',
      JSON.stringify({
        version: 1,
        entries: [{ id: 'broken', situationTags: null }],
        pinnedDrills: [],
      }),
    )

    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('data-section="storage-recovery"')
    expect(markup).toContain('Saved notebook could not be loaded')
    expect(markup).not.toContain('No notes yet')
  })

  it('renders saved note text in the dashboard loop and the notes view', () => {
    globalThis.localStorage.setItem(
      'smash-matchup-lab.v1',
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'entry-1',
            date: '2026-03-23T12:00:00.000Z',
            opponentCharacter: 'Mario',
            situationTags: ['corner'],
            deathCauseText: 'jumped from corner',
            oneRuleNextTime: 'Hold shield first',
            notes: 'Watch for panic jump from corner.',
          },
        ],
        pinnedDrills: [],
      }),
    )

    const dashboardMarkup = renderToStaticMarkup(<App />)
    const logMarkup = renderToStaticMarkup(<App initialView="log" />)

    expect(dashboardMarkup).toContain('Watch for panic jump from corner.')
    expect(logMarkup).toContain('Watch for panic jump from corner.')
    expect(logMarkup).toContain(
      'Filter by opponent, tag, stage, date, habit, rule, or note text without leaving the notebook.',
    )
  })

  it('keeps the entry screen focused on the log form instead of extra utility chrome', () => {
    const markup = renderToStaticMarkup(<App initialView="entry" />)

    expect(markup).not.toContain('View Full Log')
    expect(markup).not.toContain('Keyboard flow')
  })
})

function createStorageMock(): Storage {
  const values = new Map<string, string>()

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
      values.set(key, value)
    },
  }
}

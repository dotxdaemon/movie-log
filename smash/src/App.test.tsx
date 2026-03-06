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
    expect(markup).toContain('<span class="nav-button__title">Dashboard</span>')
    expect(markup).toContain('<span class="nav-button__title">New Entry</span>')
    expect(markup).toContain('<span class="nav-button__title">Entry Log</span>')
    expect(markup).not.toContain('<span class="nav-button__title">Home</span>')
    expect(markup).not.toContain('<span class="nav-button__title">Log</span>')
    expect(markup).not.toContain('<span class="nav-button__title">Ledger</span>')
  })

  it('renders a notebook cover and dashboard lead section', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('data-shell="tournament-notebook"')
    expect(markup).toContain('data-section="dashboard-lead"')
    expect(markup).toContain('href="#main-content"')
    expect(markup).toContain('id="main-content"')
    expect(markup).toContain('Quick log a note')
  })

  it('renders the entry form with explicit status and grouped tag semantics', () => {
    const markup = renderToStaticMarkup(<App initialView="entry" />)

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-describedby="entry-shortcuts"')
    expect(markup).toContain('aria-label="Situation tags"')
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

// ABOUTME: Renders the Smash Matchup Lab notebook UI with keyboard-first logging and analytics views.
// ABOUTME: Connects local entry persistence, recurrence summaries, drill mapping, and filters.
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import { CHARACTERS } from './data/characters'
import {
  computeWorstMatchups,
  getTodayFocus,
  summarizeMatchup,
} from './lib/analytics'
import { ALL_DRILLS } from './lib/drills'
import { createEntry, type EntryInput } from './lib/entries'
import { filterEntries, type EntryFilters } from './lib/filters'
import { loadState, saveState } from './lib/storage'
import { buildWeeklyTrend } from './lib/trends'
import {
  DEATH_CAUSE_CATEGORIES,
  SITUATION_TAGS,
  STOCK_CONTEXTS,
  type DeathCauseCategory,
  type MatchEntry,
  type SituationTag,
} from './types'

type View = 'dashboard' | 'entry' | 'matchup' | 'log' | 'drills'

interface ViewItem {
  view: View
  title: string
  step: string
  detail: string
}

interface AppProps {
  initialView?: View
}

const DEFAULT_DRAFT: EntryInput = {
  opponentCharacter: '',
  situationTags: [],
}

const VIEW_ITEMS: ViewItem[] = [
  {
    view: 'dashboard',
    title: 'Dashboard',
    step: '01',
    detail: 'Session view',
  },
  {
    view: 'entry',
    title: 'New Entry',
    step: '02',
    detail: 'Quick write',
  },
  {
    view: 'matchup',
    title: 'Matchup',
    step: '03',
    detail: 'Opponent notes',
  },
  {
    view: 'log',
    title: 'Entry Log',
    step: '04',
    detail: 'Search notes',
  },
  {
    view: 'drills',
    title: 'Drill Library',
    step: '05',
    detail: 'Study board',
  },
]

function App({ initialView = 'dashboard' }: AppProps) {
  const [initialState] = useState(loadState)
  const [entries, setEntries] = useState<MatchEntry[]>(initialState.entries)
  const [pinnedDrills, setPinnedDrills] = useState<string[]>(
    initialState.pinnedDrills,
  )
  const [activeView, setActiveView] = useState<View>(initialView)
  const [selectedOpponent, setSelectedOpponent] = useState<string>('')
  const [draft, setDraft] = useState<EntryInput>(DEFAULT_DRAFT)
  const [filters, setFilters] = useState<EntryFilters>({})
  const [latestInsight, setLatestInsight] = useState<
    ReturnType<typeof summarizeMatchup> | undefined
  >()
  const [formError, setFormError] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [tagCursor, setTagCursor] = useState(0)
  const [currentTime] = useState(() => Date.now())

  const opponentInputRef = useRef<HTMLInputElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const deathCauseRef = useRef<HTMLInputElement>(null)
  const whatWorkedRef = useRef<HTMLInputElement>(null)
  const ruleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveState({ entries, pinnedDrills })
  }, [entries, pinnedDrills])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  )

  const trackedMatchups = useMemo(
    () => new Set(entries.map((entry) => entry.opponentCharacter)).size,
    [entries],
  )

  const opponentOptions = useMemo(() => {
    const options = new Set<string>(CHARACTERS)
    for (const entry of entries) {
      options.add(entry.opponentCharacter)
    }

    return Array.from(options).sort((left, right) => left.localeCompare(right))
  }, [entries])

  const deathCauseHistory = useMemo(() => {
    const causes = new Set<string>()
    for (const entry of entries) {
      if (entry.deathCauseText) {
        causes.add(entry.deathCauseText)
      }
    }

    return Array.from(causes).sort((left, right) => left.localeCompare(right))
  }, [entries])

  const stageOptions = useMemo(() => {
    const stages = new Set<string>()
    for (const entry of entries) {
      if (entry.stage) {
        stages.add(entry.stage)
      }
    }

    return Array.from(stages).sort((left, right) => left.localeCompare(right))
  }, [entries])

  const todayFocus = useMemo(() => getTodayFocus(entries), [entries])

  const lastThirtyDaysWorst = useMemo(() => {
    const endDate = new Date(currentTime).toISOString()
    const startDate = new Date(
      currentTime - 30 * 24 * 60 * 60 * 1000,
    ).toISOString()

    return computeWorstMatchups(entries, {
      startDate,
      endDate,
      limit: 3,
    })
  }, [currentTime, entries])

  const matchupEntries = useMemo(() => {
    if (!selectedOpponent) {
      return []
    }

    return sortedEntries.filter(
      (entry) => entry.opponentCharacter === selectedOpponent,
    )
  }, [selectedOpponent, sortedEntries])

  const matchupSummary = useMemo(() => {
    if (!selectedOpponent) {
      return undefined
    }

    return summarizeMatchup(entries, selectedOpponent)
  }, [entries, selectedOpponent])

  const matchupTrend = useMemo(
    () => buildWeeklyTrend(matchupEntries),
    [matchupEntries],
  )

  const matchupDeathCauses = useMemo(
    () => rankDeathCauseCategories(matchupEntries, 3),
    [matchupEntries],
  )

  const matchupClips = useMemo(
    () => matchupEntries.filter((entry) => Boolean(entry.clipLink)),
    [matchupEntries],
  )

  const matchupLastRule = useMemo(
    () => matchupEntries.find((entry) => entry.oneRuleNextTime)?.oneRuleNextTime,
    [matchupEntries],
  )

  const filteredEntries = useMemo(
    () => filterEntries(sortedEntries, filters),
    [filters, sortedEntries],
  )

  const rankedDrills = useMemo(() => {
    const pinSet = new Set(pinnedDrills)
    return [...ALL_DRILLS].sort((left, right) => {
      const pinDelta = Number(pinSet.has(right.title)) - Number(pinSet.has(left.title))
      if (pinDelta !== 0) {
        return pinDelta
      }

      return left.title.localeCompare(right.title)
    })
  }, [pinnedDrills])

  const pinnedDrillCards = rankedDrills.filter((drill) =>
    pinnedDrills.includes(drill.title),
  )

  const coverRule =
    todayFocus?.rule ??
    latestInsight?.focusRule ??
    'Opponent required. Add the loss pattern and one next rule.'

  const coverOpponent =
    todayFocus?.opponentCharacter ?? latestInsight?.opponentCharacter

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isTypingTarget) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(opponentInputRef)
      }

      if (key === 'c') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(opponentInputRef)
      }

      if (key === 't') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(tagPickerRef)
      }

      if (key === 'd') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(deathCauseRef)
      }

      if (key === 'w') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(whatWorkedRef)
      }

      if (key === 'r') {
        event.preventDefault()
        setActiveView('entry')
        focusSoon(ruleRef)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function onDraftChange<K extends keyof EntryInput>(
    key: K,
    value: EntryInput[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function toggleTag(tag: SituationTag) {
    setDraft((current) => {
      const hasTag = current.situationTags.includes(tag)
      const nextTags = hasTag
        ? current.situationTags.filter((currentTag) => currentTag !== tag)
        : [...current.situationTags, tag]

      return {
        ...current,
        situationTags: nextTags,
      }
    })
  }

  function onTagPickerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setTagCursor((current) => (current + 1) % SITUATION_TAGS.length)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setTagCursor(
        (current) => (current + SITUATION_TAGS.length - 1) % SITUATION_TAGS.length,
      )
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      const tag = SITUATION_TAGS[tagCursor]
      if (tag) {
        toggleTag(tag)
      }
    }
  }

  function onSaveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSaveStatus('')

    try {
      const entry = createEntry(draft)
      const nextEntries = [entry, ...entries]
      setEntries(nextEntries)

      const summary = summarizeMatchup(nextEntries, entry.opponentCharacter)
      setLatestInsight(summary)
      setSelectedOpponent(entry.opponentCharacter)

      setDraft({
        ...DEFAULT_DRAFT,
        yourCharacter: draft.yourCharacter,
      })
      setActiveView('entry')
      setSaveStatus(`Saved entry for ${entry.opponentCharacter}.`)

      focusSoon(opponentInputRef)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Unable to save this entry',
      )
    }
  }

  function openMatchup(opponentCharacter: string) {
    setSelectedOpponent(opponentCharacter)
    setActiveView('matchup')
  }

  function onToggleDrillPin(title: string) {
    setPinnedDrills((current) => {
      if (current.includes(title)) {
        return current.filter((item) => item !== title)
      }

      return [...current, title]
    })
  }

  return (
    <div className="app-shell" data-shell="tournament-notebook">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {saveStatus}
      </p>
      {activeView === 'dashboard' && (
        <header className="cover-sheet panel animated-entry">
          <div className="cover-sheet__meta">
            <div>
              <p className="eyebrow">Smash Matchup Lab</p>
              <p className="cover-sheet__issue">Matchup notes</p>
            </div>
            <p className="cover-sheet__stamp">
              {coverOpponent ? `Focus / ${coverOpponent}` : 'No focus yet'}
            </p>
          </div>

          <div className="cover-sheet__grid">
            <div className="cover-sheet__copy">
              <h1>Set Notes</h1>
              <p className="cover-sheet__lede">
                Log what lost you the set, what worked, and the next rule to test.
              </p>
              <p className="cover-sheet__rule">{coverRule}</p>
              <div className="cover-sheet__actions">
                <button
                  type="button"
                  className="cover-button"
                  onClick={() => {
                    setActiveView('entry')
                    focusSoon(opponentInputRef)
                  }}
                >
                  Quick log a note
                </button>
                <button
                  type="button"
                  className="cover-button cover-button--secondary"
                  onClick={() => setActiveView('log')}
                >
                  Open log
                </button>
              </div>
            </div>

            <div className="cover-sheet__stats">
              <article className="stat-card">
                <span className="stat-card__label">Entries logged</span>
                <strong className="stat-card__value">{entries.length}</strong>
                <p className="stat-card__note">
                  {entries.length > 0
                    ? `${trackedMatchups} matchups tracked`
                    : 'Start with one set and the notebook begins to trend.'}
                </p>
              </article>

              <article className="stat-card stat-card--accent">
                <span className="stat-card__label">Pinned drills</span>
                <strong className="stat-card__value">{pinnedDrills.length}</strong>
                <p className="stat-card__note">
                  {pinnedDrills.length > 0
                    ? 'Keep your next session visible and concrete.'
                    : 'Pin the drills you want ready before bracket.'}
                </p>
              </article>
            </div>
          </div>

          <div className="hotkeys">
            <span>`N` New</span>
            <span>`C` Opponent</span>
            <span>`T` Tags</span>
            <span>`D` Death</span>
            <span>`W` Worked</span>
            <span>`R` Rule</span>
            <span>`Enter` Save</span>
          </div>
        </header>
      )}

      <NotebookNavigation
        activeView={activeView}
        ariaLabel="Notebook navigation"
        className="view-nav view-nav--desktop panel animated-entry delay-1"
        onSelect={setActiveView}
      />

      <main
        id="main-content"
        className="view-panel notebook-panel panel animated-entry delay-2"
        tabIndex={-1}
      >
        {activeView === 'dashboard' && (
          <section className="dashboard-view">
            <div className="dashboard-lead" data-section="dashboard-lead">
              <article className="lead-sheet notebook-card">
                <p className="section-kicker">Today</p>
                <h2>
                  {todayFocus
                    ? `Carry one clear rule into your next ${todayFocus.opponentCharacter} set.`
                    : 'Turn one bad set into your next drill.'}
                </h2>
                <p className="lead-sheet__copy">
                  {todayFocus
                    ? todayFocus.rule
                    : 'Add one note after a set and the app turns it into one drill and one focus rule.'}
                </p>
                <div className="lead-sheet__actions">
                  <button
                    type="button"
                    className="cover-button"
                    onClick={() => {
                      setActiveView('entry')
                      focusSoon(opponentInputRef)
                    }}
                  >
                    Quick log a note
                  </button>
                  {todayFocus ? (
                    <button
                      type="button"
                      className="cover-button cover-button--secondary"
                      onClick={() => openMatchup(todayFocus.opponentCharacter)}
                    >
                      Open matchup
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cover-button cover-button--secondary"
                      onClick={() => setActiveView('drills')}
                    >
                      Review drills
                    </button>
                  )}
                </div>
              </article>

              <div className="dashboard-metrics">
                <article className="metric-card notebook-card">
                  <span className="metric-card__label">Matchups tracked</span>
                  <strong className="metric-card__value">{trackedMatchups}</strong>
                  <p className="metric-card__note">
                    Opponents with at least one logged set.
                  </p>
                </article>

                <article className="metric-card notebook-card">
                  <span className="metric-card__label">Latest note</span>
                  <strong className="metric-card__value">
                    {sortedEntries[0]?.opponentCharacter ?? 'No entries'}
                  </strong>
                  <p className="metric-card__note">
                    {sortedEntries[0]
                      ? formatDate(sortedEntries[0].date)
                      : 'Your newest set note will show up here.'}
                  </p>
                </article>

                <article className="metric-card notebook-card metric-card--pin">
                  <span className="metric-card__label">Pinned drills</span>
                  <strong className="metric-card__value">{pinnedDrills.length}</strong>
                  <p className="metric-card__note">
                    {pinnedDrills.length > 0
                      ? `${pinnedDrills.length} session reminders ready.`
                      : 'Pin the drills you want for next session.'}
                  </p>
                </article>
              </div>
            </div>

            <div className="dashboard-ledger">
              <article className="ledger-panel notebook-card">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Ledger</p>
                    <h3>Recent set notes</h3>
                  </div>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => setActiveView('log')}
                  >
                    Open full log
                  </button>
                </div>

                {sortedEntries.slice(0, 5).length > 0 ? (
                  <ul className="ledger-list">
                    {sortedEntries.slice(0, 5).map((entry, index) => (
                      <li key={entry.id} className="ledger-row">
                        <span className="ledger-row__index">{String(index + 1).padStart(2, '0')}</span>
                        <div className="ledger-row__body">
                          <button
                            type="button"
                            className="inline-link ledger-row__title"
                            onClick={() => openMatchup(entry.opponentCharacter)}
                          >
                            {entry.opponentCharacter}
                          </button>
                          <p>{entry.deathCauseText ?? 'No death cause logged'}</p>
                        </div>
                        <span className="ledger-row__meta">{formatDate(entry.date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NotebookEmptyState
                    title="No entries yet"
                    body="Add one note after your next set and patterns will start to show up here."
                  />
                )}
              </article>

              <div className="dashboard-stack">
                <article className="notebook-card">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">Pressure points</p>
                      <h3>Worst 3 matchups</h3>
                    </div>
                    <span className="panel-heading__note">Last 30 days</span>
                  </div>

                  {lastThirtyDaysWorst.length > 0 ? (
                    <ul className="rank-list">
                      {lastThirtyDaysWorst.map((item, index) => (
                        <li key={item.opponentCharacter} className="rank-list__item">
                          <span className="rank-list__index">{index + 1}</span>
                          <button
                            type="button"
                            className="inline-link rank-list__title"
                            onClick={() => openMatchup(item.opponentCharacter)}
                          >
                            {item.opponentCharacter}
                          </button>
                          <span className="rank-list__count">{item.negativeCount}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <NotebookEmptyState
                      title="No recurring problem matchups yet"
                      body="Once negative notes build up, this board will show where your practice time should go."
                    />
                  )}
                </article>
              </div>
            </div>
          </section>
        )}

        {activeView === 'entry' && (
          <section className="entry-view">
            <article className="entry-sheet notebook-card">
              <div className="panel-heading panel-heading--split">
                <div>
                  <p className="section-kicker">Match log</p>
                  <h2 id="entry-title">New Entry</h2>
                </div>
                <p className="panel-heading__note">Opponent is the only required field.</p>
              </div>

              <form
                className="entry-form"
                onSubmit={onSaveEntry}
                aria-describedby="entry-shortcuts"
              >
                <section className="form-block">
                  <div className="form-block__heading">
                    <h3>Set context</h3>
                    <p>Who you played, where it happened, and what phase kept repeating.</p>
                  </div>

                  <label className="command-row">
                    <span className="command-key">C</span>
                    <span className="command-name">opponent</span>
                    <input
                      ref={opponentInputRef}
                      list="character-options"
                      value={draft.opponentCharacter}
                      onChange={(event) =>
                        onDraftChange('opponentCharacter', event.target.value)
                      }
                      placeholder="Zero Suit Samus"
                      required
                    />
                  </label>

                  <label className="command-row">
                    <span className="command-key">Y</span>
                    <span className="command-name">your character</span>
                    <input
                      value={draft.yourCharacter ?? ''}
                      onChange={(event) =>
                        onDraftChange('yourCharacter', event.target.value)
                      }
                      placeholder="Wolf"
                    />
                  </label>

                  <div className="command-grid">
                    <label className="command-row">
                      <span className="command-key">S</span>
                      <span className="command-name">stage</span>
                      <input
                        list="stage-options"
                        value={draft.stage ?? ''}
                        onChange={(event) => onDraftChange('stage', event.target.value)}
                        placeholder="PS2"
                      />
                    </label>

                    <label className="command-row">
                      <span className="command-key">K</span>
                      <span className="command-name">stock context</span>
                      <select
                        value={draft.stockContext ?? ''}
                        onChange={(event) =>
                          onDraftChange(
                            'stockContext',
                            event.target.value
                              ? (event.target.value as EntryInput['stockContext'])
                              : undefined,
                          )
                        }
                      >
                        <option value="">Not set</option>
                        {STOCK_CONTEXTS.map((context) => (
                          <option key={context} value={context}>
                            {context}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="command-row command-row--stacked">
                    <span className="command-key">T</span>
                    <span className="command-name">tags</span>
                    <div
                      ref={tagPickerRef}
                      className="tag-picker"
                      tabIndex={0}
                      onKeyDown={onTagPickerKeyDown}
                      role="group"
                      aria-label="Situation tags"
                    >
                      {SITUATION_TAGS.map((tag, index) => {
                        const active = draft.situationTags.includes(tag)
                        const highlighted = index === tagCursor

                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`tag-chip ${active ? 'active' : ''} ${
                              highlighted ? 'highlighted' : ''
                            }`}
                            onClick={() => toggleTag(tag)}
                            onFocus={() => setTagCursor(index)}
                            aria-pressed={active}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </label>
                </section>

                <section className="form-block">
                  <div className="form-block__heading">
                    <h3>Loss pattern</h3>
                    <p>Write the exact thing that kept costing you stocks.</p>
                  </div>

                  <div className="command-grid">
                    <label className="command-row">
                      <span className="command-key">D</span>
                      <span className="command-name">death cause</span>
                      <input
                        ref={deathCauseRef}
                        list="death-cause-history"
                        value={draft.deathCauseText ?? ''}
                        onChange={(event) =>
                          onDraftChange('deathCauseText', event.target.value)
                        }
                        placeholder="jumped from ledge into fair"
                      />
                    </label>

                    <label className="command-row">
                      <span className="command-key">G</span>
                      <span className="command-name">category</span>
                      <select
                        value={draft.deathCauseCategory ?? ''}
                        onChange={(event) =>
                          onDraftChange(
                            'deathCauseCategory',
                            event.target.value
                              ? (event.target.value as DeathCauseCategory)
                              : undefined,
                          )
                        }
                      >
                        <option value="">Not set</option>
                        {DEATH_CAUSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="command-row">
                    <span className="command-key">W</span>
                    <span className="command-name">what worked</span>
                    <input
                      ref={whatWorkedRef}
                      value={draft.whatWorked ?? ''}
                      onChange={(event) => onDraftChange('whatWorked', event.target.value)}
                      placeholder="holding center"
                    />
                  </label>

                  <label className="command-row">
                    <span className="command-key">R</span>
                    <span className="command-name">rule next set</span>
                    <input
                      ref={ruleRef}
                      value={draft.oneRuleNextTime ?? ''}
                      onChange={(event) =>
                        onDraftChange('oneRuleNextTime', event.target.value)
                      }
                      placeholder="no jump from ledge unless they commit"
                    />
                  </label>
                </section>

                <section className="form-block">
                  <div className="form-block__heading">
                    <h3>Review notes</h3>
                    <p>Link the clip and keep any last notes concise.</p>
                  </div>

                  <div className="command-grid">
                    <label className="command-row">
                      <span className="command-key">L</span>
                      <span className="command-name">clip link</span>
                      <input
                        value={draft.clipLink ?? ''}
                        onChange={(event) => onDraftChange('clipLink', event.target.value)}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="command-row">
                      <span className="command-key">F</span>
                      <span className="command-name">confidence</span>
                      <select
                        value={draft.confidence ?? ''}
                        onChange={(event) =>
                          onDraftChange(
                            'confidence',
                            event.target.value
                              ? (Number(event.target.value) as 1 | 2 | 3)
                              : undefined,
                          )
                        }
                      >
                        <option value="">Not set</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </label>
                  </div>

                  <label className="command-row command-row--notes">
                    <span className="command-key">N</span>
                    <span className="command-name">notes</span>
                    <textarea
                      value={draft.notes ?? ''}
                      onChange={(event) => onDraftChange('notes', event.target.value)}
                      rows={4}
                    />
                  </label>
                </section>

                {formError && (
                  <p className="error-text" role="alert">
                    {formError}
                  </p>
                )}

                <div className="save-bar">
                  <p id="entry-shortcuts" className="save-bar__note">
                    Opponent required. Shortcuts: C opponent, T tags, D death cause, R rule, Enter save.
                  </p>
                  <button type="submit" className="save-button">
                    Save note (Enter)
                  </button>
                </div>
              </form>
            </article>

            <aside className="entry-side">
              <article className="insight-card insight-card--primary">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Immediate output</p>
                    <h3>Next actionable read</h3>
                  </div>
                </div>

                {latestInsight ? (
                  <>
                    <p className="insight-card__opponent">
                      vs {latestInsight.opponentCharacter}
                    </p>
                    <p className="insight-card__line">
                      <strong>Recurring failure</strong>
                      <span>
                        {latestInsight.topDeathCauseCategory ??
                          'Not enough category data yet'}
                      </span>
                    </p>
                    <p className="insight-card__line">
                      <strong>Next drill</strong>
                      <span>{latestInsight.nextDrill.title}</span>
                    </p>
                    <p className="insight-card__line">
                      <strong>Focus rule</strong>
                      <span>{latestInsight.focusRule}</span>
                    </p>
                    <button
                      type="button"
                      className="cover-button cover-button--secondary"
                      onClick={() => openMatchup(latestInsight.opponentCharacter)}
                    >
                      Open matchup page
                    </button>
                  </>
                ) : (
                  <NotebookEmptyState
                    title="No output yet"
                    body="Save a note and the app will surface the main problem, next drill, and focus rule."
                  />
                )}
              </article>

              <article className="insight-card">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Shortcuts</p>
                    <h3>Keyboard flow</h3>
                  </div>
                </div>
                <ul className="command-legend">
                  <li><span>`C`</span> choose opponent</li>
                  <li><span>`T`</span> tag the situation</li>
                  <li><span>`D`</span> capture what killed you</li>
                  <li><span>`R`</span> write the one next-set rule</li>
                </ul>
              </article>
            </aside>
          </section>
        )}

        {activeView === 'matchup' && (
          <section className="matchup-view">
            <article className="matchup-sheet notebook-card">
              <div className="matchup-sheet__header">
                <div>
                  <p className="section-kicker">Matchup notebook</p>
                  <h2>{selectedOpponent || 'Choose an opponent'}</h2>
                </div>

                <label className="matchup-picker">
                  <span>Opponent</span>
                  <input
                    list="character-options"
                    value={selectedOpponent}
                    onChange={(event) => setSelectedOpponent(event.target.value)}
                    placeholder="Choose character"
                  />
                </label>
              </div>

              {!selectedOpponent ? (
                <NotebookEmptyState
                  title="No matchup selected"
                  body="Choose an opponent to load the trend line, death causes, tags, and drill recommendations."
                />
              ) : matchupSummary && matchupSummary.totalEntries > 0 ? (
                <>
                  <div className="matchup-sheet__lead">
                    <div className="matchup-sheet__copy">
                      <p className="matchup-sheet__copy-label">Primary leak</p>
                      <h3>{matchupSummary.topDeathCauseCategory ?? 'Pattern still forming'}</h3>
                      <p>{matchupSummary.focusRule}</p>
                    </div>

                    <div className="matchup-sheet__note">
                      <span className="matchup-sheet__note-label">Recommended drill</span>
                      <strong>{matchupSummary.nextDrill.title}</strong>
                      <p>{matchupSummary.nextDrill.description}</p>
                    </div>
                  </div>

                  <div className="matchup-grid">
                    <article className="notebook-card">
                      <div className="panel-heading">
                        <div>
                          <p className="section-kicker">Trend</p>
                          <h3>Entries per week</h3>
                        </div>
                      </div>

                      {matchupTrend.length > 0 ? (
                        <ul className="trend-list">
                          {matchupTrend.map((point) => (
                            <li key={point.weekStart}>
                              <span>{formatWeek(point.weekStart)}</span>
                              <div className="trend-bar-shell">
                                <div
                                  className="trend-bar"
                                  style={{ width: `${Math.max(18, point.count * 28)}px` }}
                                />
                              </div>
                              <span>{point.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <NotebookEmptyState
                          title="No trend points yet"
                          body="Keep logging this opponent and the notebook will start showing your weekly volume."
                        />
                      )}
                    </article>

                    <article className="notebook-card">
                      <div className="panel-heading">
                        <div>
                          <p className="section-kicker">Loss profile</p>
                          <h3>Top death causes</h3>
                        </div>
                      </div>

                      {matchupDeathCauses.length > 0 ? (
                        <ul className="rank-list">
                          {matchupDeathCauses.map((item, index) => (
                            <li key={item.category} className="rank-list__item">
                              <span className="rank-list__index">{index + 1}</span>
                              <span className="rank-list__title">{item.category}</span>
                              <span className="rank-list__count">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <NotebookEmptyState
                          title="No death causes logged yet"
                          body="Tag the exact thing that killed you and this ranking will sharpen quickly."
                        />
                      )}
                    </article>

                    <article className="notebook-card">
                      <div className="panel-heading">
                        <div>
                          <p className="section-kicker">Situation profile</p>
                          <h3>Top tags</h3>
                        </div>
                      </div>

                      {matchupSummary.topTags.length > 0 ? (
                        <div className="tag-cluster">
                          {matchupSummary.topTags.map((tag) => (
                            <span key={tag} className="tag-pill">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <NotebookEmptyState
                          title="No tags logged yet"
                          body="Use the situation tags to reveal whether the problem keeps happening at ledge, in disadvantage, or elsewhere."
                        />
                      )}
                    </article>

                    <article className="notebook-card notebook-card--accent">
                      <div className="panel-heading">
                        <div>
                          <p className="section-kicker">Saved note</p>
                          <h3>Last rule and drill</h3>
                        </div>
                      </div>

                      <p className="drill-title">{matchupSummary.nextDrill.title}</p>
                      <p>{matchupSummary.nextDrill.description}</p>
                      <p className="matchup-rule">
                        <strong>Last rule:</strong>{' '}
                        {matchupLastRule ?? 'No saved rule yet'}
                      </p>
                    </article>

                    <article className="notebook-card notebook-card--full">
                      <div className="panel-heading">
                        <div>
                          <p className="section-kicker">Clips</p>
                          <h3>Linked review clips</h3>
                        </div>
                      </div>

                      {matchupClips.length > 0 ? (
                        <ul className="clip-list">
                          {matchupClips.map((entry) => (
                            <li key={entry.id}>
                              <a href={entry.clipLink} target="_blank" rel="noreferrer">
                                {formatDate(entry.date)}
                              </a>
                              <p>{entry.deathCauseText ?? 'No note'}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <NotebookEmptyState
                          title="No clips saved for this matchup"
                          body="Attach a clip link whenever a stock loss is worth reviewing later."
                        />
                      )}
                    </article>
                  </div>
                </>
              ) : (
                <NotebookEmptyState
                  title={`No notes for ${selectedOpponent}`}
                  body="Log one set from New Entry and this matchup notebook will populate automatically."
                />
              )}
            </article>
          </section>
        )}

        {activeView === 'log' && (
          <section className="log-view">
            <article className="filter-sheet notebook-card" role="search" aria-labelledby="log-title">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Search</p>
                  <h2 id="log-title">Entry Log</h2>
                </div>
                <p className="panel-heading__note">Filter by opponent, tag, stage, date, or death note.</p>
              </div>

              <div className="filter-grid">
                <label>
                  <span>Opponent</span>
                  <input
                    list="character-options"
                    value={filters.opponentCharacter ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        opponentCharacter: event.target.value || undefined,
                      }))
                    }
                    placeholder="Any"
                  />
                </label>

                <label>
                  <span>Tag</span>
                  <select
                    value={filters.tag ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        tag: event.target.value
                          ? (event.target.value as SituationTag)
                          : undefined,
                      }))
                    }
                  >
                    <option value="">Any</option>
                    {SITUATION_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Stage</span>
                  <input
                    list="stage-options"
                    value={filters.stage ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        stage: event.target.value || undefined,
                      }))
                    }
                    placeholder="Any"
                  />
                </label>

                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={toDateInput(filters.startDate)}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        startDate: event.target.value
                          ? `${event.target.value}T00:00:00.000Z`
                          : undefined,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={toDateInput(filters.endDate)}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        endDate: event.target.value
                          ? `${event.target.value}T23:59:59.999Z`
                          : undefined,
                      }))
                    }
                  />
                </label>

                <label className="search-filter">
                  <span>Search death cause</span>
                  <input
                    value={filters.deathCauseSearch ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        deathCauseSearch: event.target.value || undefined,
                      }))
                    }
                    placeholder="airdodge, fair, ledge..."
                  />
                </label>
              </div>
            </article>

            <article className="ledger-panel notebook-card notebook-card--full">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Results</p>
                  <h3>{filteredEntries.length} matching entries</h3>
                </div>
              </div>

              {filteredEntries.length > 0 ? (
                <ul className="logbook-list">
                  {filteredEntries.map((entry) => (
                    <li key={entry.id} className="logbook-row">
                      <div className="logbook-row__margin">
                        <span>{formatDate(entry.date)}</span>
                        {entry.stage && <span>{entry.stage}</span>}
                      </div>
                      <div className="logbook-row__body">
                        <button
                          type="button"
                          className="inline-link logbook-row__title"
                          onClick={() => openMatchup(entry.opponentCharacter)}
                        >
                          {entry.opponentCharacter}
                        </button>
                        <p>{entry.deathCauseText ?? 'No death cause logged'}</p>
                        <div className="entry-meta">
                          {entry.deathCauseCategory && <span>{entry.deathCauseCategory}</span>}
                          {entry.situationTags.length > 0 && (
                            <span>{entry.situationTags.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <NotebookEmptyState
                  title="No entries match these filters"
                  body="Broaden the date range or clear a field to pull more notebook rows back into view."
                />
              )}
            </article>
          </section>
        )}

        {activeView === 'drills' && (
          <section className="drill-view">
            <article className="notebook-card notebook-card--accent">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Study board</p>
                  <h2>Drill Library</h2>
                </div>
                <p className="panel-heading__note">Pin drills you want ready before the next session.</p>
              </div>
            </article>

            {pinnedDrillCards.length > 0 && (
              <article className="notebook-card">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Pinned</p>
                    <h3>Ready for next session</h3>
                  </div>
                </div>

                <ul className="drill-list">
                  {pinnedDrillCards.map((drill) => (
                    <li key={drill.title} className="drill-item pinned">
                      <div>
                        <h4>{drill.title}</h4>
                        <p>{drill.description}</p>
                        <p className="drill-meta">
                          Categories: {drill.categories.join(', ') || 'n/a'} | Tags:{' '}
                          {drill.tags.join(', ') || 'n/a'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="cover-button cover-button--secondary"
                        onClick={() => onToggleDrillPin(drill.title)}
                      >
                        Unpin
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            <article className="notebook-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Library</p>
                  <h3>All drills</h3>
                </div>
              </div>

              <ul className="drill-list">
                {rankedDrills.map((drill) => {
                  const isPinned = pinnedDrills.includes(drill.title)

                  return (
                    <li
                      key={drill.title}
                      className={isPinned ? 'drill-item pinned' : 'drill-item'}
                    >
                      <div>
                        <h4>{drill.title}</h4>
                        <p>{drill.description}</p>
                        <p className="drill-meta">
                          Categories: {drill.categories.join(', ') || 'n/a'} | Tags:{' '}
                          {drill.tags.join(', ') || 'n/a'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={isPinned ? 'cover-button cover-button--secondary' : 'cover-button'}
                        onClick={() => onToggleDrillPin(drill.title)}
                      >
                        {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </article>
          </section>
        )}
      </main>

      <NotebookNavigation
        activeView={activeView}
        ariaLabel="Mobile navigation"
        className="view-nav view-nav--mobile"
        mobile
        onSelect={setActiveView}
      />

      <datalist id="character-options">
        {opponentOptions.map((character) => (
          <option key={character} value={character} />
        ))}
      </datalist>

      <datalist id="death-cause-history">
        {deathCauseHistory.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <datalist id="stage-options">
        {stageOptions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  )
}

interface NotebookNavigationProps {
  activeView: View
  ariaLabel: string
  className: string
  mobile?: boolean
  onSelect: (view: View) => void
}

function NotebookNavigation({
  activeView,
  ariaLabel,
  className,
  mobile,
  onSelect,
}: NotebookNavigationProps) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      {VIEW_ITEMS.map((item) => {
        const active = item.view === activeView

        return (
          <button
            key={item.view}
            type="button"
            className={active ? 'nav-button active' : 'nav-button'}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(item.view)}
          >
            {mobile ? (
              <>
                <span className="nav-button__title">{item.title}</span>
                <span className="nav-button__detail">{item.step}</span>
              </>
            ) : (
              <>
                <span className="nav-button__step">{item.step}</span>
                <span className="nav-button__title">{item.title}</span>
                <span className="nav-button__detail">{item.detail}</span>
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}

interface NotebookEmptyStateProps {
  body: string
  title: string
}

function NotebookEmptyState({ body, title }: NotebookEmptyStateProps) {
  return (
    <div className="empty-note">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function focusSoon(
  ref: RefObject<HTMLElement | null>,
): void {
  requestAnimationFrame(() => ref.current?.focus())
}

function rankDeathCauseCategories(entries: MatchEntry[], limit: number) {
  const counts = new Map<DeathCauseCategory, number>()

  for (const entry of entries) {
    if (!entry.deathCauseCategory) {
      continue
    }

    counts.set(
      entry.deathCauseCategory,
      (counts.get(entry.deathCauseCategory) ?? 0) + 1,
    )
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.category.localeCompare(right.category)
    })
    .slice(0, limit)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatWeek(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function toDateInput(value?: string): string {
  if (!value) {
    return ''
  }

  return value.slice(0, 10)
}

export default App

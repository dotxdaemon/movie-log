// ABOUTME: Renders the Smash Matchup Lab interface with Tailwind-based views and keyboard-first logging.
// ABOUTME: Connects local entry persistence, recurrence summaries, drill mapping, and filters.
import {
  type ComponentPropsWithoutRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CHARACTERS } from './data/characters'
import {
  getTodayFocus,
  summarizeMatchup,
} from './lib/analytics'
import { ALL_DRILLS } from './lib/drills'
import { createEntry, type EntryInput } from './lib/entries'
import { filterEntries, type EntryFilters } from './lib/filters'
import { formatDateKey, toLocalDateKey } from './lib/local-date'
import {
  commitState,
  loadState,
  type LoadStateStatus,
  type SavedState,
} from './lib/storage'
import { buildWeeklyTrend } from './lib/trends'
import {
  DEATH_CAUSE_CATEGORIES,
  SITUATION_TAGS,
  STOCK_CONTEXTS,
  type ConfidenceLevel,
  type DeathCauseCategory,
  type Drill,
  type MatchEntry,
  type SituationTag,
} from './types'

type View = 'dashboard' | 'entry' | 'matchup' | 'log' | 'drills'

interface ViewItem {
  view: View
  title: string
}

interface AppProps {
  initialView?: View
}

const DEFAULT_DRAFT: EntryInput = {
  opponentCharacter: '',
  situationTags: [],
}

const VIEW_ITEMS: ViewItem[] = [
  { view: 'dashboard', title: 'Dashboard' },
  { view: 'entry', title: 'Log Set' },
  { view: 'matchup', title: 'Matchups' },
  { view: 'log', title: 'Notes' },
  { view: 'drills', title: 'Drills' },
]

const FIELD_INPUT_STYLES =
  'mt-2 w-full rounded-[0.95rem] border border-line/55 bg-paper-strong/92 px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/10'

const PRIMARY_BUTTON_STYLES =
  'inline-flex items-center justify-center rounded-[0.95rem] bg-accent px-[1.15rem] py-[0.72rem] text-sm font-semibold text-paper-strong shadow-[0_10px_18px_rgba(151,69,34,0.18)] transition hover:bg-accent-strong'

const SECONDARY_BUTTON_STYLES =
  'inline-flex items-center justify-center rounded-[0.95rem] border border-line/65 bg-paper-strong/90 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-paper-soft/80'

const INLINE_LINK_STYLES =
  'inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition hover:text-accent-strong'

function App({ initialView = 'dashboard' }: AppProps) {
  const [initialState] = useState(loadState)
  const [entries, setEntries] = useState<MatchEntry[]>(initialState.state.entries)
  const [pinnedDrills, setPinnedDrills] = useState<string[]>(
    initialState.state.pinnedDrills,
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
  const notebookRef = useRef<SavedState>(initialState.state)
  const opponentInputRef = useRef<HTMLInputElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const deathCauseRef = useRef<HTMLInputElement>(null)
  const whatWorkedRef = useRef<HTMLInputElement>(null)
  const ruleRef = useRef<HTMLInputElement>(null)
  const storageRecoveryStatus = getStorageRecoveryStatus(initialState.status)

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
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

  const overallTopIssue = useMemo(
    () => rankDeathCauseCategories(entries, 1)[0]?.category,
    [entries],
  )

  const currentFocusIssue =
    (todayFocus?.summary.topDeathCauseCategory && todayFocus
      ? `${todayFocus.summary.topDeathCauseCategory} vs ${todayFocus.opponentCharacter}`
      : undefined) ??
    (latestInsight?.topDeathCauseCategory
      ? `${latestInsight.topDeathCauseCategory} vs ${latestInsight.opponentCharacter}`
      : undefined) ??
    overallTopIssue ??
    'No recurring issue yet'

  const currentFocusRule =
    todayFocus?.rule ??
    latestInsight?.focusRule ??
    'Log your first set to turn a vague problem into one clear next rule.'

  const currentFocusDrill =
    todayFocus?.summary.nextDrill ??
    latestInsight?.nextDrill ?? {
      title: 'No drill yet',
      description: 'Your notes will turn into a drill suggestion after the first set log.',
      categories: [],
      tags: [],
    }

  const shellPurpose = (() => {
    switch (activeView) {
      case 'dashboard':
        return 'Log the set. See the habit, the rule, and the drill.'
      case 'entry':
        return 'Capture the exact habit, the one thing that worked, and the rule to test next set.'
      case 'matchup':
        return 'Review one opponent page for recurring deaths, tags, rules, clips, and drills.'
      case 'log':
        return 'Search notes by opponent, tag, stage, date, habit, rule, or note text.'
      case 'drills':
        return 'Keep the practice reps you want visible before the next session starts.'
    }
  })()

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
      const nextState = commitNotebook(
        (current) => ({
          ...current,
          entries: [entry, ...current.entries],
        }),
        (message) => setFormError(message),
      )

      if (!nextState) {
        return
      }

      const summary = summarizeMatchup(nextState.entries, entry.opponentCharacter)
      setLatestInsight(summary)
      setSelectedOpponent(entry.opponentCharacter)

      setDraft({
        ...DEFAULT_DRAFT,
        yourCharacter: draft.yourCharacter,
      })
      setActiveView('entry')
      setSaveStatus(`Saved note for ${entry.opponentCharacter}.`)

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
    setSaveStatus('')
    commitNotebook(
      (current) => ({
        ...current,
        pinnedDrills: current.pinnedDrills.includes(title)
          ? current.pinnedDrills.filter((item) => item !== title)
          : [...current.pinnedDrills, title],
      }),
      () => setSaveStatus('Unable to save drill changes right now.'),
    )
  }

  function commitNotebook(
    update: (current: SavedState) => SavedState,
    onError: (message: string) => void,
  ): SavedState | undefined {
    if (storageRecoveryStatus) {
      onError(getStorageRecoveryMessage(storageRecoveryStatus))
      return undefined
    }

    const result = commitState(notebookRef.current, update)
    if (!result.ok) {
      onError('Unable to save this notebook right now.')
      return undefined
    }

    notebookRef.current = result.state
    setEntries(result.state.entries)
    setPinnedDrills(result.state.pinnedDrills)
    return result.state
  }

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-5 px-3 pb-28 pt-4 sm:px-5 lg:px-8"
      data-shell="tournament-notebook"
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-paper-strong focus:px-4 focus:py-2"
        href="#main-content"
      >
        Skip to main content
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {saveStatus}
      </p>

      <DashboardHeader
        activeView={activeView}
        onOpenEntry={() => {
          setActiveView('entry')
          focusSoon(opponentInputRef)
        }}
        onSelectView={setActiveView}
        shellPurpose={shellPurpose}
      />

      <main id="main-content" className="flex flex-col gap-5" tabIndex={-1}>
        {storageRecoveryStatus ? (
          <SectionCard
            className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6 sm:py-7"
            data-section="storage-recovery"
          >
            <SectionHeading
              eyebrow="Storage"
              title={<h2 className="text-[1.9rem] leading-tight text-ink">Saved notebook could not be loaded</h2>}
              description={getStorageRecoveryMessage(storageRecoveryStatus)}
            />
            <div className="mt-5 border-l-2 border-danger/50 pl-4">
              <p className="text-sm leading-6 text-ink-soft">
                The existing local notebook was preserved and was not overwritten.
                Clear site data for this app when you are ready to start fresh.
              </p>
            </div>
          </SectionCard>
        ) : activeView === 'dashboard' && (
          <DashboardPage
            currentFocusDrill={currentFocusDrill}
            currentFocusIssue={currentFocusIssue}
            currentFocusRule={currentFocusRule}
            focusOpponent={todayFocus?.opponentCharacter ?? latestInsight?.opponentCharacter}
            onOpenLog={() => setActiveView('log')}
            onOpenMatchup={openMatchup}
            recentEntries={sortedEntries.slice(0, 3)}
          />
        )}

        {activeView === 'entry' && (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                eyebrow="Match log"
                title={<h2 id="entry-title" className="text-[1.9rem] leading-tight text-ink">Log Set</h2>}
                description="Capture the matchup, the stock-loss habit, and the next rule while the set is still fresh."
                note="Opponent is the only required field."
              />

              <form className="mt-6 flex flex-col gap-6" onSubmit={onSaveEntry} aria-describedby="entry-shortcuts">
                <FormBlock
                  description="Who you played, where it happened, and which situation kept repeating."
                  title="Set context"
                >
                  <FieldShell label="Opponent" shortcut="C">
                    <input
                      ref={opponentInputRef}
                      className={FIELD_INPUT_STYLES}
                      list="character-options"
                      value={draft.opponentCharacter}
                      onChange={(event) =>
                        onDraftChange('opponentCharacter', event.target.value)
                      }
                      placeholder="Zero Suit Samus"
                      required
                    />
                  </FieldShell>

                  <FieldShell label="Your character" shortcut="Y">
                    <input
                      className={FIELD_INPUT_STYLES}
                      value={draft.yourCharacter ?? ''}
                      onChange={(event) =>
                        onDraftChange('yourCharacter', event.target.value)
                      }
                      placeholder="Wolf"
                    />
                  </FieldShell>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldShell label="Stage" shortcut="S">
                      <input
                        className={FIELD_INPUT_STYLES}
                        list="stage-options"
                        value={draft.stage ?? ''}
                        onChange={(event) => onDraftChange('stage', event.target.value)}
                        placeholder="PS2"
                      />
                    </FieldShell>

                    <FieldShell label="Stock context" shortcut="K">
                      <select
                        className={FIELD_INPUT_STYLES}
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
                    </FieldShell>
                  </div>

                  <FieldShell label="Situation tags" shortcut="T">
                    <div
                      ref={tagPickerRef}
                      className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-[1rem] border border-line/70 bg-paper-soft px-3 py-3"
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
                            className={joinClassNames(
                              'rounded-full border px-3 py-1.5 text-sm transition',
                              active
                                ? 'border-support/30 bg-support/10 text-support'
                                : 'border-line/70 bg-paper-strong text-ink-soft hover:border-line-strong',
                              highlighted && 'ring-2 ring-accent/25',
                            )}
                            onClick={() => toggleTag(tag)}
                            onFocus={() => setTagCursor(index)}
                            aria-pressed={active}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </FieldShell>
                </FormBlock>

                <FormBlock
                  description="Write the exact habit or option that kept costing you stocks."
                  title="Loss pattern"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldShell label="Death cause" shortcut="D">
                      <input
                        ref={deathCauseRef}
                        className={FIELD_INPUT_STYLES}
                        list="death-cause-history"
                        value={draft.deathCauseText ?? ''}
                        onChange={(event) =>
                          onDraftChange('deathCauseText', event.target.value)
                        }
                        placeholder="jumped from ledge into fair"
                      />
                    </FieldShell>

                    <FieldShell label="Category" shortcut="G">
                      <select
                        className={FIELD_INPUT_STYLES}
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
                    </FieldShell>
                  </div>

                  <FieldShell label="What worked" shortcut="W">
                    <input
                      ref={whatWorkedRef}
                      className={FIELD_INPUT_STYLES}
                      value={draft.whatWorked ?? ''}
                      onChange={(event) => onDraftChange('whatWorked', event.target.value)}
                      placeholder="holding center"
                    />
                  </FieldShell>

                  <FieldShell label="Rule for next set" shortcut="R">
                    <input
                      ref={ruleRef}
                      className={FIELD_INPUT_STYLES}
                      value={draft.oneRuleNextTime ?? ''}
                      onChange={(event) =>
                        onDraftChange('oneRuleNextTime', event.target.value)
                      }
                      placeholder="No jump from corner until they commit"
                    />
                  </FieldShell>
                </FormBlock>

                <FormBlock
                  description="Attach a clip, confidence level, and any short notes you want to keep."
                  title="Review notes"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldShell label="Clip link" shortcut="L">
                      <input
                        className={FIELD_INPUT_STYLES}
                        value={draft.clipLink ?? ''}
                        onChange={(event) => onDraftChange('clipLink', event.target.value)}
                        placeholder="https://..."
                      />
                    </FieldShell>

                    <FieldShell label="Confidence" shortcut="F">
                      <select
                        className={FIELD_INPUT_STYLES}
                        value={draft.confidence ?? ''}
                        onChange={(event) =>
                          onDraftChange(
                            'confidence',
                            event.target.value
                              ? (Number(event.target.value) as ConfidenceLevel)
                              : undefined,
                          )
                        }
                      >
                        <option value="">Not set</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </FieldShell>
                  </div>

                  <FieldShell label="Notes" shortcut="N">
                    <textarea
                      className={`${FIELD_INPUT_STYLES} min-h-32 resize-y`}
                      value={draft.notes ?? ''}
                      onChange={(event) => onDraftChange('notes', event.target.value)}
                      rows={4}
                    />
                  </FieldShell>
                </FormBlock>

                {formError && (
                  <p className="text-sm font-semibold text-danger" role="alert">
                    {formError}
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t border-line/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p id="entry-shortcuts" className="text-sm leading-6 text-ink-soft">
                    Opponent required. Shortcuts: C opponent, T tags, D death cause, R rule, Enter save.
                  </p>
                  <button type="submit" className={PRIMARY_BUTTON_STYLES}>
                    Save note
                  </button>
                </div>
              </form>
            </SectionCard>

            <div className="flex flex-col gap-5">
              <SectionCard className="px-4 py-5 sm:px-5 sm:py-6">
                <SectionHeading
                  eyebrow="Immediate output"
                  title={<h3 className="text-[1.45rem] leading-tight text-ink">Next read</h3>}
                  description="The app turns your last note into one failure pattern, one drill, and one focus rule."
                />

                <div className="mt-5">
                  {latestInsight ? (
                    <div className="space-y-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                        vs {latestInsight.opponentCharacter}
                      </p>
                      <FocusLine label="Recurring failure" value={latestInsight.topDeathCauseCategory ?? 'Not enough category data yet'} />
                      <FocusLine label="Next drill" value={latestInsight.nextDrill.title} />
                      <FocusLine label="Focus rule" value={latestInsight.focusRule} />
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_STYLES}
                        onClick={() => openMatchup(latestInsight.opponentCharacter)}
                      >
                        Open matchup page
                      </button>
                    </div>
                  ) : (
                    <EmptyState
                      body="Save a note to generate the next read."
                      title="No output yet"
                    />
                  )}
                </div>
              </SectionCard>
            </div>
          </section>
        )}

        {activeView === 'matchup' && (
          <section className="flex flex-col gap-5">
            <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <SectionHeading
                  eyebrow="Matchups"
                  title={<h2 className="text-[1.9rem] leading-tight text-ink">{selectedOpponent || 'Choose an opponent'}</h2>}
                  description="Review recurring deaths, top tags, last rule, clips, and the drill the app keeps pointing you toward."
                />

                <label className="block max-w-xs text-sm font-medium text-ink-soft">
                  Opponent
                  <input
                    className={FIELD_INPUT_STYLES}
                    list="character-options"
                    value={selectedOpponent}
                    onChange={(event) => setSelectedOpponent(event.target.value)}
                    placeholder="Choose character"
                  />
                </label>
              </div>
            </SectionCard>

            {!selectedOpponent ? (
              <SectionCard className="px-4 py-6 sm:px-6">
                <EmptyState
                  body="Choose an opponent to load trends, top causes, tags, and drill guidance."
                  title="No matchup selected"
                />
              </SectionCard>
            ) : matchupSummary && matchupSummary.totalEntries > 0 ? (
              <>
                <SectionCard className="surface-muted px-4 py-5 sm:px-6 sm:py-6">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                    <div className="space-y-4">
                      <SectionHeading
                        eyebrow="Primary leak"
                        title={<h3 className="text-[1.7rem] leading-tight text-ink">{matchupSummary.topDeathCauseCategory ?? 'Pattern still forming'}</h3>}
                        description={matchupSummary.focusRule}
                      />
                    </div>
                    <div className="rounded-[1.2rem] border border-line/70 bg-paper-strong/80 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Suggested drill</p>
                      <p className="mt-2 font-display text-[1.2rem] leading-tight text-ink">{matchupSummary.nextDrill.title}</p>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">{matchupSummary.nextDrill.description}</p>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid gap-5 xl:grid-cols-2">
                  <SectionCard className="px-4 py-5 sm:px-5 sm:py-6">
                    <SectionHeading
                      eyebrow="Trend"
                      title={<h3 className="text-[1.45rem] leading-tight text-ink">Entries per week</h3>}
                    />
                    <div className="mt-5">
                      {matchupTrend.length > 0 ? (
                        <ul className="space-y-3">
                          {matchupTrend.map((point) => (
                            <li key={point.weekStart} className="grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-3 text-sm text-ink-soft">
                              <span>{formatWeek(point.weekStart)}</span>
                              <div className="h-2 rounded-full bg-paper-muted">
                                <div
                                  className="h-2 rounded-full bg-accent"
                                  style={{ width: `${Math.max(18, point.count * 28)}px` }}
                                />
                              </div>
                              <span className="text-right font-semibold text-ink">{point.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          body="Keep logging this opponent and the weekly trend will fill in."
                          title="No trend points yet"
                        />
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard className="px-4 py-5 sm:px-5 sm:py-6">
                    <SectionHeading
                      eyebrow="Loss profile"
                      title={<h3 className="text-[1.45rem] leading-tight text-ink">Top death causes</h3>}
                    />
                    <div className="mt-5">
                      {matchupDeathCauses.length > 0 ? (
                        <ul className="divide-y divide-line/70">
                          {matchupDeathCauses.map((item, index) => (
                            <li key={item.category} className="grid grid-cols-[32px_minmax(0,1fr)_40px] items-center gap-3 py-3">
                              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">{index + 1}</span>
                              <span className="text-sm font-semibold text-ink">{item.category}</span>
                              <span className="text-right text-sm font-semibold text-ink">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          body="Add exact death-cause categories and this ranking will sharpen quickly."
                          title="No death causes yet"
                        />
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard className="px-4 py-5 sm:px-5 sm:py-6">
                    <SectionHeading
                      eyebrow="Situation profile"
                      title={<h3 className="text-[1.45rem] leading-tight text-ink">Top tags</h3>}
                    />
                    <div className="mt-5">
                      {matchupSummary.topTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {matchupSummary.topTags.map((tag) => (
                            <span key={tag} className="rounded-full border border-support/25 bg-support/10 px-3 py-1.5 text-sm text-support">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          body="Use situation tags to show whether the problem is ledge, landing, pressure, or neutral."
                          title="No tags yet"
                        />
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard className="surface-muted px-4 py-5 sm:px-5 sm:py-6">
                    <SectionHeading
                      eyebrow="Saved note"
                      title={<h3 className="text-[1.45rem] leading-tight text-ink">Last rule and drill</h3>}
                    />
                    <div className="mt-5 space-y-3">
                      <p className="font-display text-[1.2rem] leading-tight text-ink">{matchupSummary.nextDrill.title}</p>
                      <p className="text-sm leading-6 text-ink-soft">{matchupSummary.nextDrill.description}</p>
                      <p className="text-sm text-ink-soft">
                        <span className="font-semibold text-ink">Last rule:</span>{' '}
                        {matchupLastRule ?? 'No saved rule yet'}
                      </p>
                    </div>
                  </SectionCard>
                </div>

                <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
                  <SectionHeading
                    eyebrow="Clips"
                    title={<h3 className="text-[1.45rem] leading-tight text-ink">Linked review clips</h3>}
                  />
                  <div className="mt-5">
                    {matchupClips.length > 0 ? (
                      <ul className="divide-y divide-line/70">
                        {matchupClips.map((entry) => (
                          <li key={entry.id} className="space-y-2 py-3">
                            <a className="text-sm font-semibold text-accent hover:text-accent-strong" href={entry.clipLink} target="_blank" rel="noreferrer">
                              {formatDate(entry.date)}
                            </a>
                            <p className="text-sm text-ink-soft">{entry.deathCauseText ?? 'No note'}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        body="Attach clip links whenever a stock loss is worth reviewing later."
                        title="No clips saved"
                      />
                    )}
                  </div>
                </SectionCard>
              </>
            ) : (
              <SectionCard className="px-4 py-6 sm:px-6">
                <EmptyState
                  body={`Log one set against ${selectedOpponent} and this page will populate automatically.`}
                  title={`No notes for ${selectedOpponent}`}
                />
              </SectionCard>
            )}
          </section>
        )}

        {activeView === 'log' && (
          <section className="flex flex-col gap-5">
            <SectionCard
              className="px-4 py-5 sm:px-6 sm:py-6"
              role="search"
              aria-labelledby="log-title"
            >
              <SectionHeading
                eyebrow="Notes"
                title={<h2 id="log-title" className="text-[1.9rem] leading-tight text-ink">Search notes</h2>}
                description="Filter by opponent, tag, stage, date, habit, rule, or note text without leaving the notebook."
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FilterField label="Opponent">
                  <input
                    className={FIELD_INPUT_STYLES}
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
                </FilterField>

                <FilterField label="Tag">
                  <select
                    className={FIELD_INPUT_STYLES}
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
                </FilterField>

                <FilterField label="Stage">
                  <input
                    className={FIELD_INPUT_STYLES}
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
                </FilterField>

                <FilterField label="Start date">
                  <input
                    className={FIELD_INPUT_STYLES}
                    type="date"
                    value={toDateInput(filters.startDate)}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        startDate: event.target.value
                          ? event.target.value
                          : undefined,
                      }))
                    }
                  />
                </FilterField>

                <FilterField label="End date">
                  <input
                    className={FIELD_INPUT_STYLES}
                    type="date"
                    value={toDateInput(filters.endDate)}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        endDate: event.target.value
                          ? event.target.value
                          : undefined,
                      }))
                    }
                  />
                </FilterField>

                <FilterField label="Search death cause">
                  <input
                    className={FIELD_INPUT_STYLES}
                    value={filters.deathCauseSearch ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        deathCauseSearch: event.target.value || undefined,
                      }))
                    }
                    placeholder="airdodge, fair, ledge..."
                  />
                </FilterField>
              </div>
            </SectionCard>

            <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                eyebrow="Results"
                title={<h3 className="text-[1.45rem] leading-tight text-ink">{filteredEntries.length} matching entries</h3>}
              />

              <div className="mt-5">
                {filteredEntries.length > 0 ? (
                  <ul className="divide-y divide-line/70">
                    {filteredEntries.map((entry) => (
                      <li key={entry.id} className="grid gap-3 py-4 sm:grid-cols-[124px_minmax(0,1fr)]">
                        <div className="space-y-1 text-sm text-ink-faint">
                          <p>{formatDate(entry.date)}</p>
                          {entry.stage && <p>{entry.stage}</p>}
                        </div>
                        <div className="space-y-2">
                          <button
                            type="button"
                            className="text-left text-base font-semibold text-ink transition hover:text-accent"
                            onClick={() => openMatchup(entry.opponentCharacter)}
                          >
                            {entry.opponentCharacter}
                          </button>
                          <p className="text-sm leading-6 text-ink-soft">{entry.deathCauseText ?? 'No death cause logged'}</p>
                          {entry.notes && (
                            <p className="text-sm leading-6 text-ink-faint">{entry.notes}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-[12px] text-ink-faint">
                            {entry.deathCauseCategory && <span>{entry.deathCauseCategory}</span>}
                            {entry.situationTags.length > 0 && <span>{entry.situationTags.join(', ')}</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    body="Broaden the date range or clear a filter to bring more notes back into view."
                    title="No entries match these filters"
                  />
                )}
              </div>
            </SectionCard>
          </section>
        )}

        {activeView === 'drills' && (
          <section className="flex flex-col gap-5">
            <SectionCard className="surface-muted px-4 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                eyebrow="Drills"
                title={<h2 className="text-[1.9rem] leading-tight text-ink">Practice library</h2>}
                description="Pin the reps you want ready before the next session starts."
              />
            </SectionCard>

            {pinnedDrillCards.length > 0 && (
              <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
                <SectionHeading
                  eyebrow="Saved drills"
                  title={<h3 className="text-[1.45rem] leading-tight text-ink">Ready for next session</h3>}
                />
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {pinnedDrillCards.map((drill) => (
                    <DrillItem
                      key={drill.title}
                      drill={drill}
                      pinned
                      onToggle={() => onToggleDrillPin(drill.title)}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
              <SectionHeading
                eyebrow="Library"
                title={<h3 className="text-[1.45rem] leading-tight text-ink">All drills</h3>}
              />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {rankedDrills.map((drill) => {
                  const isPinned = pinnedDrills.includes(drill.title)
                  return (
                    <DrillItem
                      key={drill.title}
                      drill={drill}
                      pinned={isPinned}
                      onToggle={() => onToggleDrillPin(drill.title)}
                    />
                  )
                })}
              </div>
            </SectionCard>
          </section>
        )}
      </main>

      <AppNav
        activeView={activeView}
        ariaLabel="Mobile navigation"
        mobile
        onSelect={setActiveView}
      />

      <datalist id="character-options">
        {opponentOptions.map((character) => (
          <option key={character} value={character} />
        ))}
      </datalist>
      <datalist id="death-cause-history">
        {deathCauseHistory.map((deathCause) => (
          <option key={deathCause} value={deathCause} />
        ))}
      </datalist>
      <datalist id="stage-options">
        {stageOptions.map((stage) => (
          <option key={stage} value={stage} />
        ))}
      </datalist>
    </div>
  )
}

interface AppNavProps {
  activeView: View
  ariaLabel: string
  mobile?: boolean
  onSelect: (view: View) => void
}

function AppNav({ activeView, ariaLabel, mobile, onSelect }: AppNavProps) {
  return (
    <nav
      className={mobile
        ? 'fixed left-4 right-4 z-30 flex items-center gap-1 rounded-[1.02rem] border border-line/28 bg-paper-strong/76 px-1.5 py-1.5 shadow-[0_10px_24px_rgba(40,27,20,0.08)] backdrop-blur-[16px] md:hidden'
        : 'hidden items-center gap-4 lg:inline-flex'}
      aria-label={ariaLabel}
      data-nav-tone={mobile ? 'quiet' : undefined}
      style={mobile ? { bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' } : undefined}
    >
      {VIEW_ITEMS.map((item) => {
        const active = item.view === activeView

        return (
          <button
            key={item.view}
            type="button"
            className={joinClassNames(
              'group flex min-w-0 items-center justify-center font-medium transition',
              mobile
                ? 'flex-1 rounded-[0.78rem] px-1.5 py-2 text-center text-[10.5px] leading-none text-ink-faint'
                : 'border-b border-transparent px-0 py-1 text-[13px] text-ink-faint hover:text-ink-soft',
              active &&
                (mobile
                  ? 'bg-paper/65 text-ink'
                  : 'border-accent/55 text-ink'),
            )}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(item.view)}
          >
            <span className="nav-button__title whitespace-nowrap">{item.title}</span>
          </button>
        )
      })}
    </nav>
  )
}

interface CurrentFocusCardProps {
  currentFocusDrill: Drill
  currentFocusIssue: string
  currentFocusRule: string
  focusOpponent?: string
  recentEntries: MatchEntry[]
  onOpenLog: () => void
  onOpenMatchup: (opponentCharacter: string) => void
}

function TrainingConsole({
  currentFocusDrill,
  currentFocusIssue,
  currentFocusRule,
  focusOpponent,
  recentEntries,
  onOpenLog,
  onOpenMatchup,
}: CurrentFocusCardProps) {
  return (
    <section
      className="surface-sheet relative mx-auto w-full max-w-4xl overflow-hidden rounded-[1.08rem] border border-line/38 px-5 py-5 shadow-[0_18px_36px_rgba(40,27,20,0.06)] sm:px-7 sm:py-7"
      data-section="training-console"
      data-console-tone="sheet"
      data-focus-layout="coaching"
    >
      <div className="pointer-events-none absolute inset-y-0 left-7 hidden w-px bg-line/22 sm:block" />

      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)] lg:gap-8">
        <div className="space-y-5 sm:pl-5" data-focus-item="issue">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-accent">
              After the set
            </p>
            {focusOpponent && (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
                vs {focusOpponent}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              Habit to stop
            </p>
            <h2 className="max-w-xl text-[2.7rem] leading-[0.92] text-ink sm:text-[3.45rem]">
              {currentFocusIssue}
            </h2>
          </div>
        </div>

        <div className="space-y-5 border-t border-line/28 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
          <div className="space-y-2.5" data-focus-item="rule">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              Rule to follow
            </p>
            <p className="text-[1.04rem] font-semibold leading-7 text-ink">
              {currentFocusRule}
            </p>
          </div>
          <div className="space-y-2.5 border-t border-line/28 pt-5" data-focus-item="drill">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
              Drill to run
            </p>
            <p className="text-[1.04rem] font-semibold leading-7 text-ink">
              {currentFocusDrill.title}
            </p>
            <p className="text-sm leading-6 text-ink-soft">
              {currentFocusDrill.description}
            </p>
          </div>
          {focusOpponent && (
            <div className="pt-1">
              <button
                type="button"
                className={INLINE_LINK_STYLES}
                onClick={() => onOpenMatchup(focusOpponent)}
              >
                Open {focusOpponent} notes
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="mt-7 border-t border-line/28 pt-4" data-section="recent-notes">
        <div className="flex items-end justify-between gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-faint">
            Recent notes
          </p>
          <button
            type="button"
            className={INLINE_LINK_STYLES}
            data-log-link="inline"
            onClick={onOpenLog}
          >
            Full log
          </button>
        </div>

        <div className="mt-3">
          {recentEntries.length > 0 ? (
            <ul className="divide-y divide-line/30">
              {recentEntries.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    className="grid w-full gap-1.5 py-1 text-left transition hover:text-ink"
                    onClick={() => onOpenMatchup(entry.opponentCharacter)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">{entry.opponentCharacter}</span>
                      <span className="text-[12px] text-ink-faint">{formatDate(entry.date)}</span>
                    </div>
                    <p className="text-[13px] leading-6 text-ink-soft">
                      {entry.oneRuleNextTime ?? entry.deathCauseText ?? 'No takeaway logged'}
                    </p>
                    {entry.notes && (
                      <p className="text-[12.5px] leading-6 text-ink-faint">{entry.notes}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              body="Log your first set to get a habit, a rule, and a drill."
              title="No notes yet"
            />
          )}
        </div>
      </section>
    </section>
  )
}

interface DashboardHeaderProps {
  activeView: View
  onOpenEntry: () => void
  onSelectView: (view: View) => void
  shellPurpose: string
}

function DashboardHeader({
  activeView,
  onOpenEntry,
  onSelectView,
  shellPurpose,
}: DashboardHeaderProps) {
  if (activeView === 'dashboard') {
    return (
      <section
        className="grid gap-4 border-b border-line/35 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
        data-section="dashboard-topbar"
        data-topbar-tone="editorial"
      >
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              Smash Matchup Lab
            </p>
            <span className="hidden h-px w-10 bg-line/55 sm:block" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-[1.72rem] leading-[0.9] text-ink sm:text-[1.98rem]">
              Smash Log
            </h1>
            <p className="max-w-sm text-[0.94rem] leading-6 text-ink-soft">
              Log the set. Get the next step.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:items-end">
          <AppNav
            activeView={activeView}
            ariaLabel="Notebook navigation"
            mobile={false}
            onSelect={onSelectView}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-[0.98rem] bg-accent px-5 py-3 text-sm font-semibold text-paper-strong shadow-[0_12px_20px_rgba(151,69,34,0.18)] transition hover:bg-accent-strong"
            onClick={onOpenEntry}
          >
            Log Set
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="grid gap-4 border-b border-line/35 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
      data-section="page-header"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Smash Matchup Lab
          </p>
          <span className="hidden h-px w-10 bg-line/55 sm:block" />
        </div>
        <div className="space-y-1">
          <h1 className="max-w-3xl font-display text-[1.9rem] leading-[0.9] text-ink sm:text-[2.2rem] lg:text-[2.55rem]">
            {VIEW_ITEMS.find((item) => item.view === activeView)?.title}
          </h1>
          <p className="max-w-lg text-sm leading-6 text-ink-soft sm:text-[0.95rem]">
            {shellPurpose}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 lg:items-end">
        <AppNav
          activeView={activeView}
          ariaLabel="Notebook navigation"
          mobile={false}
          onSelect={onSelectView}
        />
        {activeView !== 'entry' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-[0.98rem] bg-accent px-5 py-3 text-sm font-semibold text-paper-strong shadow-[0_12px_20px_rgba(151,69,34,0.18)] transition hover:bg-accent-strong"
              onClick={onOpenEntry}
            >
              Log Set
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

interface DashboardPageProps {
  currentFocusDrill: Drill
  currentFocusIssue: string
  currentFocusRule: string
  focusOpponent?: string
  onOpenLog: () => void
  onOpenMatchup: (opponentCharacter: string) => void
  recentEntries: MatchEntry[]
}

function DashboardPage({
  currentFocusDrill,
  currentFocusIssue,
  currentFocusRule,
  focusOpponent,
  onOpenLog,
  onOpenMatchup,
  recentEntries,
}: DashboardPageProps) {
  return (
    <section className="flex flex-col">
      <TrainingConsole
        currentFocusDrill={currentFocusDrill}
        currentFocusIssue={currentFocusIssue}
        currentFocusRule={currentFocusRule}
        focusOpponent={focusOpponent}
        recentEntries={recentEntries}
        onOpenLog={onOpenLog}
        onOpenMatchup={onOpenMatchup}
      />
    </section>
  )
}

function DrillItem({
  drill,
  pinned,
  onToggle,
}: {
  drill: Drill
  pinned: boolean
  onToggle: () => void
}) {
  return (
    <article className="flex h-full flex-col justify-between rounded-[0.95rem] bg-paper px-4 py-4 ring-1 ring-line/35">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[1.1rem] leading-tight text-ink">{drill.title}</h4>
          {pinned && (
            <span className="rounded-[0.8rem] bg-support/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-support">
              Pinned
            </span>
          )}
        </div>
        <p className="text-sm leading-6 text-ink-soft">{drill.description}</p>
        <p className="text-[12px] leading-5 text-ink-faint">
          Categories: {drill.categories.join(', ') || 'n/a'} · Tags: {drill.tags.join(', ') || 'n/a'}
        </p>
      </div>
      <div className="mt-4">
        <button
          type="button"
          className={pinned ? SECONDARY_BUTTON_STYLES : PRIMARY_BUTTON_STYLES}
          onClick={onToggle}
        >
          {pinned ? 'Unpin' : 'Pin'}
        </button>
      </div>
    </article>
  )
}

function SectionHeading({
  action,
  description,
  eyebrow,
  note,
  title,
}: {
  action?: ReactNode
  description?: string
  eyebrow: string
  note?: string
  title: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          {eyebrow}
        </p>
        {title}
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-ink-soft">{description}</p>
        )}
      </div>
      {(action || note) && (
        <div className="flex items-center gap-3 lg:pt-1">
          {note && <p className="text-sm text-ink-faint">{note}</p>}
          {action}
        </div>
      )}
    </div>
  )
}

function FormBlock({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) {
  return (
    <section className="space-y-3 border-t border-line/35 pt-4 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h3 className="text-[1.15rem] leading-tight text-ink">{title}</h3>
        <p className="text-[12.5px] leading-6 text-ink-soft">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FieldShell({
  children,
  label,
  shortcut,
}: {
  children: ReactNode
  label: string
  shortcut?: string
}) {
  return (
    <label className="block text-sm font-medium text-ink-soft">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {shortcut && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {shortcut}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-sm font-medium text-ink-soft">
      {label}
      {children}
    </label>
  )
}

function FocusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 border-l-2 border-line/55 pl-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">{label}</p>
      <p className="text-sm font-semibold leading-6 text-ink">{value}</p>
    </div>
  )
}

interface SectionCardProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode
}

function SectionCard({ children, className, ...props }: SectionCardProps) {
  return (
    <section
      className={joinClassNames(
        'rounded-panel border border-line/55 surface-paper shadow-[0_12px_26px_rgba(40,27,20,0.05)]',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="border-l-2 border-line/70 pl-4">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{body}</p>
    </div>
  )
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
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
  return formatDateKey(value)
}

function toDateInput(value?: string): string {
  if (!value) {
    return ''
  }

  if (value.length === 10) {
    return value
  }

  return toLocalDateKey(value)
}

function getStorageRecoveryStatus(
  status: LoadStateStatus,
): Exclude<LoadStateStatus, 'empty' | 'ready'> | undefined {
  if (status === 'empty' || status === 'ready') {
    return undefined
  }

  return status
}

function getStorageRecoveryMessage(
  status: Exclude<LoadStateStatus, 'empty' | 'ready'>,
): string {
  switch (status) {
    case 'future-version':
      return 'This browser has notebook data from a newer app version, so Smash Log is keeping it untouched.'
    case 'parse-error':
      return 'The saved notebook could not be parsed, so Smash Log is leaving the stored data untouched.'
    case 'invalid':
      return 'The saved notebook shape is incomplete or malformed, so Smash Log is leaving the stored data untouched.'
  }
}

export default App

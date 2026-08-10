# Movie Log first-prompt acceptance ledger — 2026-08-10

This ledger maps the original 103-line product-and-engineering prompt to current evidence. It corrects the omissions found after the earlier closeout and does not count source inspection, a green test, or a future-tense procedure as installed proof.

## Evidence labels

- **Installed** — exercised in `/Applications/Movie Log.app` with protected real-data snapshots or an isolated scratch store and visually inspected where appearance matters.
- **Tested** — directly established by automated checks or source inspection, but not used as a substitute for installed visual behavior.
- **Preserved** — already satisfied at correction baseline `bf42d27308d8cd5c827d7f1372727bfc345823d8` and rechecked for regression.
- **Conditional** — impossible to prove in the current hardware/session; no first-prompt requirement is left in this category.

The evidence root is `/Users/seankim/.codex-artifacts/movie-log-first-prompt-20260810`. Installed mutation profiles use disposable copies. Real-data captures use the snapshot-protected read-only path.

## Correction baseline

The historical state that existed before the original prompt is no longer reproducible without discarding later user-approved work. The legitimate baseline for this correction is the clean, installed `bf42d27` tree that was aligned with `origin/main` before editing.

| Baseline check | Result |
| --- | --- |
| Working tree and branch | Clean `main`; `HEAD`, `origin/main`, and `origin/HEAD` at `bf42d27` |
| Clean install | `npm ci`: 249 packages installed; 0 vulnerabilities |
| Tests | 61 files, 379 tests passed |
| Lint | Passed |
| TypeScript | Renderer and Node/Electron projects passed |
| Format and diff validation | Passed |
| Production build | Passed; renderer CSS 65.48 kB and JavaScript 293.78 kB |
| macOS package | Passed and installed at `/Applications/Movie Log.app` |
| Installed baseline frames | `baseline-library-desktop.png` at 1180×788 and `baseline-library-phone.png` at 390×844; both opened and inspected |

## The eight closeout omissions and their corrections

| Omission at `bf42d27` | Current classification | Correction and evidence |
| --- | --- | --- |
| Removed Diary destination still had an unreachable view, component, mode props, skeletons, styles, and capture profiles | **Tested/Installed** | Deleted the obsolete view/component/tests and every hidden application/capture path. Library is now the direct default surface. Underlying viewing history remains available to Library, Search, Statistics, Dossier, and Log. |
| Library lacked Director, exact Year, and Watch date criteria; “Recent” did not distinguish viewing recency from first-added recency | **Installed/Tested** | Added Director, Year, and Watch date controls plus independent Recent viewing and Recently added sorts. Model regressions prove each predicate and first-seen ordering; `library-criteria` replays the controls and active chips in the installed app. |
| Truncated-path help relied on mouse-only native `title` behavior | **Installed/Tested** | Replaced native title hints with real `role="tooltip"` content associated by `aria-describedby`, revealed by hover or keyboard focus. The installed `keyboard-tooltip` profile rejects transparent or off-screen output and its screenshot was visually inspected. |
| Form validation was only inferred from source/tests | **Installed/Tested** | Future viewing dates now retain the form and selected film, focus the date field, set `aria-invalid`/`aria-errormessage`, and show actionable `role="alert"` feedback. The installed `log-validation` replay deliberately submits tomorrow's date and asserts the complete failure state. |
| The final responsive/state matrix was not tied to the exact finished tree | **Installed** | The final capture run covers the width boundaries, every primary surface, Log/Dossier/filter states, loading/empty/error/outage/missing/long-text states, accessibility at phone/tablet/desktop, poster/layout stability, and stress/performance profiles. Artifacts use the `final-*` prefix in the evidence root. |
| No honest current baseline/final visual ledger was retained | **Installed** | Baseline frames are preserved separately from `final-*` frames. This ledger names the correction baseline and does not pretend to reconstruct the unavailable historical pre-prompt app. |
| Clean-install verification was not shown on both sides of the work | **Tested** | Baseline and post-correction `npm ci` each installed 249 packages and reported 0 vulnerabilities. |
| The earlier acceptance ledger contained proposed future closeout steps presented beside completed evidence | **Tested** | `finish-acceptance-2026-08-09.md` now marks those rows as completed historical facts, partial evidence, or explicitly unverified. This ledger maps the original prompt and only reports commands that ran. |

## Original prompt mapping

| Original prompt area | Classification and current evidence |
| --- | --- |
| Full structure, package, persistence, routes/views, styling, tests, lint, build, and documentation inspection | **Tested.** The repository, complete journal, manifests/lockfile/configuration, Electron/preload/IPC/store/catalog/capture paths, design/navigation/watcher/lifecycle contracts, tests, workflow, and installed bundle were inspected. |
| Baseline install/build/type/lint/test results separated from regressions | **Tested.** Recorded above before editing; post-correction results are separate below. |
| Main user flows end to end | **Installed/Preserved.** Existing release profiles cover launch, Library, Search/catalog, filters, Dossier origin/return, Log, rating, all annotations, edit/date/delete/relaunch persistence, watched folders, drag/drop, path actions, Statistics, and metadata states. Current correction adds direct validation and criteria replays. |
| Dead code, duplication, component consistency, responsive behavior, accessibility, dependencies, performance, and bugs | **Tested.** Obsolete Diary code was the only production orphan found and is removed. No-unused checks pass. The production import graph reaches 71 of 72 TypeScript/TSX/CJS files; the sole non-runtime file is `src/vite-env.d.ts`. Dependency audit reports 0 vulnerabilities and no unused runtime dependency. |
| Restrained cinematic visual direction and coherent system | **Installed/Preserved.** Additive controls, feedback, and tooltips use the existing pale paper, lavender grouping, graphite structure, burgundy seam, square-control, typography, spacing, and motion rules. No unrelated redesign or generic dashboard treatment was introduced. |
| Poster-led Library/cards; missing art, long titles, partial metadata, duplicate identity, narrow screens | **Installed/Preserved.** Existing poster, fallback, aggregation, long-search, missing-Dossier, responsive, and layout-stability profiles remain in the final matrix. |
| Search, sorting, filters, active filters, and quick clearing | **Installed/Tested.** Title search and existing criteria remain; Director, Year, Watch date, and Recently added are now connected to real archive data. Active chips and Clear all cover the added criteria. |
| Detail and entry editing: rating, date, rewatch, notes, favorite, tags, labels, defaults, keyboard use, validation, save state | **Installed/Tested.** Existing edit/persistence profiles are preserved; future-date validation is now directly replayed in the installed Log sheet and shared by Dossier editors. |
| Empty, loading, validation, success, confirmation, and actionable error states | **Installed.** Each is represented in the final state matrix, including dedicated validation, deletion confirmation, load error, catalog outage, missing poster/metadata, and filtered empty output. |
| Personal record value and truthful statistics | **Installed/Preserved.** Viewing history, favorites, ratings, rewatches, genres, directors, tags, monthly/yearly activity, runtime, and media counts continue to derive only from genuine available data. |
| Desktop, tablet, mobile, keyboard, focus, semantics, names, contrast, alt text, headings, reduced motion, touch targets | **Installed/Tested.** Final boundary captures and installed accessibility audits run at 390×844, 834×900, and 1180×788; keyboard tooltip, search, ratings, filters, sheets, and dialogs have dedicated replay/tests. |
| Dialog focus trap, predictable dismissal, and opener restoration | **Installed/Tested.** Existing Log/filter/confirmation and Search/Dossier focus contracts are preserved in the final accessibility and interaction matrix. |
| Existing stack/data model, type safety, reusable components, no fake content/secrets/machine-specific product paths | **Tested/Preserved.** Electron/React/TypeScript/Vite/Vitest and persisted schemas are unchanged; no dependency or migration was added. The tooltip and validation behavior are shared components/utilities. |
| Data preservation and destructive-action protection | **Installed/Tested.** All mutation replay uses scratch copies; deletion remains an explicit accessible confirmation. The three canonical production files retain the exact baseline hashes, sizes, mtimes, and counts below. |
| Poster/network/rendering performance and bounded work | **Installed/Preserved.** Responsive sources, lazy decoding, 2:3 stable geometry, retry/backoff, layout stability, bounded Library batches, 1,000-title/history profiles, and transition/search budgets remain in the final matrix. |
| Tests for changed filtering/sorting/validation/utility behavior | **Tested.** Added deterministic archive-model, validation, tooltip, capture-contract, rendered-surface, style, and removal regressions. |
| Manual inspection at desktop/mobile across major and adverse states | **Installed.** Final frames were opened individually or in contact sheets; black, stale, clipped, occluded, or malformed frames are rejected rather than retained as proof. |

## Production-data ledger

| File | SHA-256 | Bytes | Modification time | Relevant counts |
| --- | --- | ---: | --- | --- |
| `movie-log.json` | `c7d23a29796cecd8940ea7f211d017c0e2c3d2a0dd5246b6e2685837cf002910` | 72,089 | 2026-08-05 19:26:22 MDT | 129 history, 31 library items, 1 watched folder |
| `movie-log-note.md` | `0c0e63cc47ccb24ad7764efe2be219a4b175c48f410c363be46e81dabed90054` | 26,009 | 2026-08-05 19:26:22 MDT | Human-readable journal retained byte-for-byte |
| `movie-log-films.json` | `954c8f4d8f718c76054aa792590474236cd4472b47311d05743346892a7fcf22` | 81,141 | 2026-08-05 19:26:53 MDT | 104 film records |

## Current correction checks

| Check | Result |
| --- | --- |
| Post-correction clean install under Node 22 | 249 packages installed; 0 vulnerabilities |
| Full automated suite | 60 files, 369 tests passed |
| Strict TypeScript plus no-unused diagnostics | Passed for renderer and Node/Electron projects |
| Lint, changed-file format, and diff validation | Passed |
| Production build/package | Passed; installed app rebuilt at `/Applications/Movie Log.app` |
| Focused installed criteria replay | Passed with Director `Boots Riley`, exact Year `2026`, Watch date `Last 30 days`, and sort `Recently added` |
| Focused installed validation replay | Passed with tomorrow retained, selected film retained, `role="alert"`, and `aria-invalid="true"` |
| Focused installed keyboard-tooltip replay | Passed with keyboard focus, matching description ID, visible opacity, on-screen bounds, and real tooltip text |
| Dependency audit | 0 vulnerabilities |

No original first-prompt requirement is knowingly left missing. The separate August 9 hardware limitation for cross-display/cross-Space migration belongs to the later finish prompt, not the original prompt, and remains documented there without being converted into a false pass.

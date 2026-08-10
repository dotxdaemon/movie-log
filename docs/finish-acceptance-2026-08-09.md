# Movie Log finish acceptance ledger — 2026-08-09

This ledger classifies the requirements from the August 9 finish brief. It separates direct installed-app evidence from source/test evidence and records the one environment-dependent limitation without treating it as a product pass.

## Evidence labels

- **Installed** — exercised against `/Applications/Movie Log.app` with an explicit `real` or isolated `scratch` data mode.
- **Tested** — established by source inspection and automated tests, but not independently replayed through the installed UI during this pass.
- **Conditional** — the concept is intentionally unsupported by the product contract or unavailable in the current hardware/session.
- **Unchanged** — explicitly preserved because the requirement forbids expanding or redesigning it.

The durable capture root is `/Users/seankim/.codex-artifacts`. The broad installed matrix uses the `movie-log-finish-final-*` files. New gap-closing captures are under `movie-log-finish-20260809/`.

## Baseline classification and corrections

| Requirement area | Pre-correction classification | Final evidence |
| --- | --- | --- |
| Existing functional, visual, accessibility, persistence, lifecycle, and security acceptance | Implemented and directly confirmed by the installed `a36d011` acceptance run | Preserved; full sequential gates, packaging, installed comparison, and release verification are repeated for the final commit. |
| 1,000-title Library | Implemented and directly confirmed, but rendering all cards remained unnecessarily costly | **Installed.** Library now reveals 120-card bounded batches; all 1,000 titles remain loadable and searchable. Final-package worst batch `24.1ms`, worst sampled frame `23.7ms`, and full scripted load `178.8ms`. `performance-library-large-final.png`. |
| 1,000-viewing history | Implemented but the only retained installed stress artifact belonged to the removed Diary surface | **Installed.** A current 1,000-history run covered Library, Dossier, Search, and Statistics. Final-package transitions were Statistics `26.9ms`, Search `13.8ms`, and Library `27.1ms`; local Search was `20ms`; ready was `626.2ms`. `performance-history-large-final.png`. |
| Large-history derived-data work | Broken against the 100ms transition budget: Statistics `106.2ms`, Library `465.4ms` | Corrected by sharing memoized archive items, coverage, filter options, and search inputs instead of rebuilding them per view. |
| Statistics yearly activity final month | Visually broken: the last desktop month label extended into implicit grid columns and clipped | Corrected by anchoring the final label to the explicit grid end; regression covered in `tests/statistics-activity.test.ts`. |
| Metadata retry/backoff | Implemented and test-confirmed; no current installed scheduled-retry fixture | **Installed.** Relaunch preserved attempts/status/next retry; visible Retry advanced attempt 2 to 3, persisted `matched`, and restored the IMDb poster. `retry-backoff.png`, `metadata-retry.png`. |
| Watched-folder operations | Implemented/test-confirmed; direct installed acceptance did not cover the full mutation sequence | **Installed.** Add, Scan Now, current contents, hidden/unsupported exclusion, settled arrivals, copy/reveal/open, disappearance, remount, remove, and history preservation ran against an isolated real folder. `watched-folder-flow.png`. |
| Finder drag and drop | Synthetic drop coverage only | **Installed.** Finder supplied one MKV and one JPEG through a native macOS pointer drag. The installed sheet received real `File` objects, logged the MKV, skipped the JPEG, and displayed exact feedback. `finder-drag-drop.png`. |
| Cross-display and cross-Space reopen | Unverified | **Conditional.** Current hardware exposes one online `3440×1440` display and the current monitor has one active desktop Space. The existing installed lifecycle proof covers cold launch, Command-W, menu reopen, Dock/second instance, focus, one process, and `1 -> 0 -> 1` windows on that display/Space; migration between displays/Spaces cannot be exercised in this environment. |
| Downloaded rolling-release ZIP | Remote workflow/release metadata confirmed, but asset not independently unpacked | The final release procedure downloads the published ZIP into an isolated directory, verifies its digest/signature/root plist, and compares its app resources with the committed package before closeout. |

## Product, domain, and navigation

| Requirement | Classification and evidence |
| --- | --- |
| Local macOS archive/journal identity; no social, streaming, profile, feed, comment, or public features | **Unchanged.** `docs/navigation-contract.md`, persisted types, installed Library/Search/Statistics/Settings/Dossier/Log captures. |
| Library startup and post-log destination | **Installed.** Cold launch, persistence, multiple-path, path-match, and native Finder-drop profiles return to Library. |
| Exactly four top-level destinations; Log is an action; Diary remains absent | **Installed.** 390px, 700px, 701px, 834px, 900px, 901px, and desktop captures; accessibility profiles also assert the rendered navigation. |
| In-memory navigation; no fake URLs or web history | **Unchanged.** Intentional contract in `docs/navigation-contract.md`; no routing layer added. |
| Dossier returns to actual Library/Search origin and restores focus when possible | **Installed/Tested.** Library and Search dossier profiles plus return-state/focus tests. |
| Escape from Search restores prior destination and opener focus | **Installed/Tested.** Interaction replay and navigation/focus tests. |
| Indexed inventory stays distinct from genuine viewings | **Installed/Tested.** Empty/indexed dossiers, Statistics counts, delete flow, aggregation tests. |
| Watcher inventory, manual/drop entries, title identity, source paths, and viewing events remain distinct | **Installed/Tested.** Watched-folder, multiple-path, path-match, persistence, and archive-model tests. |
| Synthetic records do not inflate personal statistics or annotations | **Installed/Tested.** Statistics and indexed-only dossier profiles; archive-model/statistics tests. |
| Films, series episodes, and unknown media retain honest labels | **Installed/Tested.** Statistics counts and media-type tests. |
| Multiple paths do not create duplicate title identities; genuine viewings stay independently editable | **Installed/Tested.** `log-multiple-paths`, Search, aggregation, Dossier editor, date-edit/delete persistence profiles. |

## Complete user flows

| Flow | Classification and evidence |
| --- | --- |
| Launch installed app; browse/open Library item | **Installed.** Real-data Library matrix and packaged lifecycle replay. |
| Search local titles and live catalog; keyboard catalog navigation; local utility during outage | **Installed.** `search-results`, `search-long`, `catalog-live`, `catalog-outage`, `slow-catalog`; exact-title ranking selects The Ring rather than broader Ring titles. |
| Filter/sort/apply/reset/clear/dismiss; compact draft state does not commit on close/Escape/backdrop/swipe | **Installed/Tested.** `filters` at phone and 900px, filtered/empty Library profiles, transactional-filter tests. |
| Open Dossier from Library/Search and return to origin | **Installed/Tested.** Dossier matrix and navigation/focus tests. |
| Log catalog title, file, directory, multiple paths, matched path, and native drop | **Installed.** `log-selected`, `log-multiple-paths`, `log-path-match`, persistence save, Finder-drop profiles. |
| Preserve selected catalog identity across multiple chosen paths | **Installed/Tested.** `log-ambiguity` phone/desktop and form-domain tests. |
| Rating, viewing date, review, cast notes, favorite, rewatch, tags, location, viewing format | **Installed.** Save/relaunch/edit/relaunch/date-edit/relaunch sequence persisted every field. |
| Validation and recoverable failure preserve input; truthful save/skip/pending/failure feedback | **Installed/Tested.** Log validation, outage, ambiguity, multiple-path, and Finder-drop profiles; form tests. |
| Delete one viewing through explicit accessible confirmation | **Installed.** `detail-delete-confirmation`, delete/relaunch profiles; indexed media and unrelated data remain. |
| Add/remove watched folder, Scan Now, current contents | **Installed.** Full native watched-folder profile. |
| Real top-level arrival; hidden/unsupported ignored; multiple arrivals settle once | **Installed.** Two MKVs shared one exact `watchedAt`; hidden `.Hidden.mkv` and JPEG were absent. |
| Missing/renamed/remounted watched folder | **Installed.** Disappearance cleared current inventory without history loss; remount restored it without duplicate history. |
| Remove watched folder without deleting unrelated history or recording later arrivals | **Installed.** Removal preserved five new history rows plus existing archive and ignored a post-removal MKV. |
| Open, Copy Path, Show in Finder | **Installed.** Exact clipboard path assertion and main-process open/reveal calls in the watched-folder profile. |
| Removable-volume access and permission states | **Installed/Tested.** Root `NSRemovableVolumesUsageDescription`, real `/Volumes/blve/movies` read-only Settings evidence, folder/open error paths. No production permission mutation was performed. |
| Missing, pending, unmatched, failed, retry-scheduled metadata | **Installed/Tested.** Missing/outage/live/slow/retry profiles and catalog/poster policy tests. |

## Production-data safety

| Requirement | Classification and evidence |
| --- | --- |
| Preflight hashes, sizes, mtimes, record counts | **Installed.** Recorded before mutation-capable runtime work and rechecked after installed replays. |
| Complete store copied before mutation; `MOVIE_LOG_DATA_DIR` points to isolated copies | **Installed.** Stress, persistence, retry, watched-folder, poster, outage, and Finder-drop runs used unique temporary full-store copies. |
| Real mode is snapshot-protected and read-only | **Installed/Tested.** Capture path validation rejects real-mode writes and aliasing; real visual captures used the protected path. |
| Append/readable-note protection and rollback-safe paired writes | **Tested.** Store transaction regressions inject second-file failure and restore both artifacts. |
| Deletion snapshots and removes only the logical viewing plus hidden watcher duplicates | **Installed/Tested.** Confirmation/delete/relaunch proof and mutation tests. |
| Folder removal preserves history and unrelated inventory | **Installed.** Native watched-folder profile. |
| All three canonical files remain byte-identical | Final closeout rechecks exact SHA-256, byte size, and mtime after the last installed replay. No cache-policy migration is part of this correction. |

## Visual contract and surfaces

| Requirement | Classification and evidence |
| --- | --- |
| Pale paper/cool lavender field, graphite structure, burgundy seams, asymmetry, negative space, angular controls, compact top band | **Installed.** Every retained matrix capture was visually inspected against `docs/workspace-reference.md` and `docs/reference/movie-log-character-sheet.png`. |
| Poster art remains the dominant saturated material | **Installed.** Library, Search, Dossier, and selected Log captures; Settings remains intentionally non-poster-led. |
| No glass, glow, gradients, pills, dashboards, generic streaming chrome, decorative prisms, or unrelated redesign | **Installed/Tested.** Visual inspection plus reference-contract/style tests. |
| Loading, empty, filtered-empty, load-error, catalog-outage, slow-catalog, missing-poster, partial-metadata, feedback, filter, form, and confirmation states | **Installed.** Each named `movie-log-finish-final-*` capture was opened and inspected; no black, occluded, malformed, or development-app frame was accepted. |
| Long titles/paths and dense metadata remain intentional | **Installed.** Search-long, missing Dossier, Settings contents, ambiguity Log, phone/desktop layouts. |

## Surface-specific acceptance

| Surface | Classification and evidence |
| --- | --- |
| Library communicates totals, viewing count, coverage, indexed status, title/type/year/rating/viewing information | **Installed.** Real Library matrix and large-store profiles. |
| Search covers local metadata, separates lanes/providers, avoids duplicate title lanes, and reports partial states honestly | **Installed/Tested.** Search/live/outage/slow profiles and identity tests. |
| Dossier leads with identity/status, distinguishes indexed-only, lists every viewing, edits all fields, and protects delete | **Installed.** Phone/desktop/missing/outage/IMDb-match/delete/persistence profiles. |
| Log supports catalog/local identity, all annotations, defaults, validation, keyboard use, recoverable input, and precise feedback | **Installed/Tested.** Log matrix, persistence, Finder-drop, rating-keyboard, and form tests. |
| Statistics uses genuine data for ratings, favorites, rewatches, monthly/yearly activity, genres, directors, tags, decades, runtime, and media counts | **Installed/Tested.** Statistics upper/lower captures, 1,000-history profile, archive-model tests. |
| Settings exposes real folder/index/path and data-file operations with honest missing states | **Installed/Tested.** Real Settings and watched-folder profile plus IPC/path tests. |

## Poster, accessibility, responsive, and performance acceptance

| Requirement | Classification and evidence |
| --- | --- |
| IMDb locale tiering, primary-within-tier, provider identity, headers, retryability, policy migration, fallback, and no stale foreign-only image | **Installed/Tested.** Inception exact US/English installed poster and cache migration; retry/outage profiles; poster-selection/provider tests. |
| Responsive sources, 2:3 geometry, lazy loading, source resolution, request stability | **Installed.** Poster-performance and layout-stability profiles at phone/tablet/desktop; zero phone CLS and sufficient natural/rendered pixel ratios. |
| Full keyboard/semantic/name/alt/heading/contrast/non-color/reduced-motion/pointer-target requirements | **Installed/Tested.** Installed accessibility audit reports zero findings at 390×844, 834×900, and 1180×788; keyboard-specific profiles/tests cover catalog, menus, filters, ratings, sheets, and dialogs. |
| 48×48 sheet close, focus traps, inert backgrounds, Escape/backdrop/close, opener restoration | **Installed/Tested.** Accessibility and modal profiles plus focus/inert tests. |
| 390×844, 520, 700, 701, 834×900, 900, 901, 1024, 1025, 1180×788, and 1500 widths | **Installed.** Retained Library boundary matrix plus surface/state captures at applicable phone, compact, rail, tablet, and desktop layouts. |
| No horizontal overflow, clipping, fixed-nav occlusion; correct four-slot mobile nav and 701–900 rail | **Installed.** Layout/accessibility profiles and manual capture inspection. The statistics final-month clipping found during this review was corrected. |
| Stable loading/poster geometry; CLS ≤ 0.01 | **Installed.** Phone `0`; desktop `0.00022941401345520355`; poster geometry unchanged after decode. |
| Major transitions/local Search under 100ms on 1,000-history profile | **Installed.** Statistics `26.9ms`, Search `13.8ms`, Library `27.1ms`, local Search `20ms`. |
| 1,000-title Library remains usable without unbounded rendering | **Installed.** Initial 120 cards, eight bounded batches, all 1,000 reachable; maximum batch `24.1ms`, sampled frame `23.7ms`, scripted total `178.8ms`. |
| No repeated settled metadata fetch, unbounded retry/scan, idle rewrites; settled watcher batch and zero-window pause | **Installed/Tested.** Retry, watched-folder, lifecycle profiles and scheduler/watcher tests. |

## Native lifecycle, security, engineering, and release

| Requirement | Classification and evidence |
| --- | --- |
| One instance/window, Command-W, menu reopen, Dock/second-instance focus, no unexpected focus theft | **Installed.** Packaged lifecycle routine: one process, window counts `1 -> 0 -> 1`, menu reopen remained inactive behind Brave, second launch focused the existing app. |
| Reopen across display/Space | **Conditional.** One connected display and one active desktop Space make cross-display/Space migration unavailable. Same-display/same-Space behavior passed. |
| Watchers/scheduled work follow zero-window behavior | **Installed/Tested.** Lifecycle run and watcher scheduler tests. |
| Root removable-volume plist, full ad hoc signing, temporary cache cleanup | **Installed/Tested.** Final package root-plist inspection, strict `codesign`, and cache failure-path tests. |
| Narrow preload; validated IPC identifiers, paths, details, catalog/search inputs; no renderer Node access or remote execution | **Tested/Installed boundary.** IPC/preload/security tests and packaged bundle inspection. Capture-only folder override is accepted only for the isolated `watched-folder-flow` profile. |
| Existing Electron/React/TypeScript/Vite/Vitest stack; no dependency/schema/storage rewrite | **Unchanged.** No dependency or lockfile change; persisted data remains backward compatible. |
| Focused regressions for changed behavior | **Tested.** Archive derivation/search inputs, bounded Library batches, statistics label, retry-store generator, watched/drop capture contracts. |
| Sequential test/lint/type/format/diff/build/package gates | Final closeout records the exact command result after this ledger and all code are final. |
| Installed app matches build and passes strict signature | Final closeout performs resource comparison and strict signing verification. |
| Commit/push/workflow/tag/asset | Final closeout commits only scoped files to `main`, pushes, waits for `Release Main Build`, confirms its head SHA, validates `main-build`, then downloads and independently inspects the macOS ZIP. |

## Deliberately unchanged or conditional

- Diary remains absent; underlying history remains available everywhere it is required.
- Navigation remains in memory; no URL, browser-history, or deep-link system was added.
- No unsupported social, streaming, watchlist, or profile concept was introduced.
- Production history, note, and film cache are not normalized or reconstructed.
- The current environment cannot prove moving a reopened window between physical displays or active Spaces because it contains exactly one connected display and one active desktop Space. This is the only acceptance item that remains environment-conditional.

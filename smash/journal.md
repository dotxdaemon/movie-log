# Journal

## 2026-03-10

- Request: Add a repo-local journal and make `fix` a trigger word in `AGENTS.md`.
- Attempt: Added the repo journal policy to `/Users/seankim/smash/AGENTS.md` and created this file.
- Result: Initial journal created so future fix requests have a repo-local memory file to read first.
- Verification: `npm test`, `npm run lint`, and `npm run typecheck` all passed.
- Request: Simplify the repo journal policy wording in `AGENTS.md`.
- Attempt: Shortened the `Repo Journal Policy` block to a compact checklist with the same constraints.
- Result: The repo journal rules are now shorter and easier to scan.
- Verification: `npm test`, `npm run lint`, and `npm run typecheck` all passed.
- Error: The first proof screenshot hit a dead temporary HTTP server, so the browser loaded an error page instead of the snippet.
- Request: Fix the layout and UI so it is more functional, easier to read, and visually consistent.
- Previous attempt: The last UI pass added a large dark masthead and mixed dark and light summary surfaces, which made the first screen feel dense and inconsistent.
- Attempt: Reproduced the dense dashboard layout on a 390x844 viewport and added a deterministic UI repro script for masthead height and duplicate summary content.
- Error: The current dashboard still renders a 610px masthead on mobile and a duplicate `session-brief` block, so the first screen stays overcrowded.
- Attempt: Removed the duplicate dashboard summary panel and moved the key metrics into the main focus card.
- Error: The dashboard is simpler now, but the mobile masthead still measures about 507px because the title and stacked actions are still taking too much vertical space.
- Result: The dashboard now uses one compact masthead, one summary card, and a single light surface system, which reduced the mobile masthead from 610px to about 406px and removed the duplicate session summary panel.
- Verification: `npm test`, `npm run lint`, and `npm run typecheck` all passed after the layout simplification.
- Request: Rebuild the app in Tailwind with a calmer, more legible dashboard hierarchy and lighter navigation.
- Previous attempt: The CSS-based simplification reduced clutter, but it did not fully re-architect the product shell or navigation around a stronger scan path.
- Attempt: Rebuilt the app shell and dashboard in Tailwind with the new navigation labels and dashboard section structure.
- Error: The first browser proof run hit a dead local dev server after the Tailwind rewrite, so the screenshots captured a connection error instead of the app.
- Attempt: Ran the first live browser pass on the Tailwind dashboard at desktop and 390x844 mobile.
- Error: The dashboard hierarchy is working, but the slim nav still lets labels wrap or clip, especially `Dashboard` and `Log Set`, so the navigation is not clean enough yet.
- Result: The app now uses a Tailwind-based product shell with a compact dashboard header, a single current-focus anchor, a restrained stat row, lighter navigation, and reusable dashboard components.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed after the Tailwind redesign.
- Request: Refine the current Tailwind dashboard without rewriting it, and explicitly record what was missed after the fix completes.
- Previous attempt: The Tailwind redesign fixed the broad IA, but it still relied on too many full outlined sections, a soft Current Focus treatment, and a header that remained taller and quieter than the brief called for.
- Attempt: Tightened the dashboard header, turned Current Focus into one unified coaching surface, flattened the stats row, and removed the heavy boxed treatment from the lower dashboard sections.
- Error: `npm run lint` failed once because `FocusPanel` became unused after the Current Focus refactor, so the dead helper had to be removed.
- Result: The dashboard now leads with a compact header, one clear coaching output, a quiet stats strip, flatter analysis sections, and less competing chrome.
- Missed: The first Tailwind pass still treated the header, Current Focus, stats, and analysis panels as nearly the same kind of rounded slab, which flattened the hierarchy; it also left Current Focus split into equal subcards and kept the stats row too tall on mobile.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed after the second-pass dashboard refinement.
- Request: Simplify the dashboard aggressively so the product reads as log set -> see habit, rule, drill -> review notes only when needed.
- Previous attempt: The second-pass refinement improved hierarchy, but the dashboard still exposed support metrics, matchup diagnostics, and drill browsing as if they were equal parts of the product.
- Attempt: Removed the stats strip and dashboard drill preview, hid recurring matchup diagnostics unless there is real data, simplified the header copy, and lightened the mobile nav so the product reads as one focused loop.
- Result: The dashboard now shows only the header, the current habit/rule/drill output, recent notes, and an optional recurring-matchup list when it adds value.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed after the dashboard simplification pass.
- Request: Change the dashboard silhouette materially so it stops reading as top block plus big middle card plus lower support card.
- Previous attempt: The simplification cut sections, but it still kept the same overall stacked dashboard composition, so the screen still looked too similar at a glance.
- Attempt: Deleted the stacked dashboard silhouette by replacing the old header-plus-cards composition with a compact top bar and one notebook-like training console that contains both the habit/rule/drill output and the recent-notes footer.
- Error: `npm run typecheck` failed once because the non-dashboard header path still contained a `dashboard` branch that TypeScript had already ruled out.
- Result: The dashboard now has a materially different shape at a glance: top bar, one dominant training surface, and no extra overview regions.
- Missed: The previous simplification removed sections but still kept the same broad header, big middle card, and lower support block silhouette, so it still read as the same dashboard.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed after the console-style dashboard pass.
- Request: Refine the current training-console UI and fix the stale Vercel deployment so the live app matches the current product direction.
- Previous attempt: The training-console pass fixed the silhouette, but the nav and `Full log` control still used mismatched secondary styling, and Vercel was still serving the much older `masthead` build.
- Attempt: Tightened the dashboard topbar, turned the mobile nav into a lighter integrated strip, and moved `Full log` into the recent-notes heading as an inline secondary path inside the existing training-console layout.
- Result: The topbar keeps the same compact structure but feels more intentional, the main card reads more naturally, and the bottom nav now matches the lighter editorial surface model.
- Missed: The previous console pass still left the bottom nav too dark and rounded, and it kept `Full log` as a parked utility button that interrupted the notes flow.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed after the training-console refinement pass.

## Weekly recap: 2026-03-05 to 2026-03-12

### 1. What Sean asked for this week, and which bugs Sean asked Codex to fix

- GitHub and deployment asks:
  - Push the repo to `https://github.com/dotxdaemon`.
  - Make a Vercel deployment.
  - Make the app usable from a phone as a PWA.
  - Later fix the fact that Vercel was still serving an older build than the current local app.
- Repo process asks:
  - Add the source-first policy to both `~/AGENTS.md` and repo `AGENTS.md`.
  - Add a repo-local `journal.md`.
  - Treat `fix` as a trigger word and log request, previous attempt, and resulting error.
  - Simplify the journal policy wording after the first version was too verbose.
- Front-end redesign asks:
  - Read `SKILL.md` and redesign the front end more aggressively.
  - Move away from a generic, padded multi-card dashboard.
  - Make the product much simpler and closer to its core loop:
    - log the set
    - see the habit
    - get the rule
    - run the drill
  - Keep reducing the dashboard until it stopped looking like a broad analytics product.
  - Keep the final structure compact instead of rewriting it again once the training-console direction was correct.
- Visual bugfix asks Sean called out explicitly:
  - The first Palutena icon was not the correct SSBU stock logo.
  - The icon was blurry, low resolution, haloed, touching the edges, and visually wrong multiple times.
  - The bottom navigation wrapped, overlapped content, got clipped by screen corners, and felt like it belonged to a different app.
  - The app still triggered zoom behavior Sean did not want.
  - The UI had overlapping text, heavy container framing, and too many equally weighted panels.
  - The later dashboard simplification still looked too similar to the earlier version and had not changed silhouette enough.
  - The final console pass still had a nav and `Full log` control that looked visually disconnected from the rest of the product.

### 2. What fixed those asks and bugs this week

- GitHub / deploy / phone access:
  - Created and pushed the public GitHub repo at `dotxdaemon/smash`.
  - Linked the project to Vercel and did production deploys from the local repo.
  - Added PWA support with manifest, service worker, and icon wiring so the app could be installed from a phone.
  - Verified the live Vercel site after deploy instead of assuming the alias had moved.
- Process / memory / instruction fixes:
  - Added a reference-first policy to both AGENTS files so external assets and named references must be proven before editing.
  - Added repo-local `journal.md` and started logging requests, prior attempts, resulting errors, misses, and verification outcomes.
  - Simplified the journal policy wording so it stayed usable rather than turning into its own wall of text.
- Dashboard / layout fixes:
  - Removed repeated overview panels, then removed the stats strip and drill preview from the dashboard when they were not helping the core loop.
  - Rebuilt the front end in Tailwind, then repeatedly tightened the dashboard hierarchy with failing tests and viewport checks.
  - Replaced the stacked dashboard silhouette with a compact top bar and one unified training console that contains the habit, rule, drill, and recent notes.
  - After the silhouette changed, refined only the remaining mismatches:
    - lighter integrated bottom nav
    - inline `Full log` link
    - more intentional topbar
    - smoother internal training-console spacing
- Mobile and nav bug fixes:
  - Scoped the notebook cover to the dashboard so non-dashboard views stopped starting underneath unnecessary hero content.
  - Tightened mobile bottom-nav width, label wrapping, and spacing so labels no longer broke or clipped.
  - Inset the mobile dock and honored safe-area spacing so it stopped getting cut off at the corners.
  - Applied touch handling and minimum input font sizes so app-triggered zoom and focus jumps stopped happening.
  - Lightened the nav chrome so it no longer looked like a dark slab pasted over a lighter editorial page.
- Icon fixes:
  - Switched from drawing the icon from memory to using exact Palutena stock-icon references.
  - Added icon asset tests so incorrect or blurry icon regressions had a failing gate.
  - Removed border treatments, clip-path framing, semi-transparent halo pixels, and overly literal low-resolution sprite presentation that caused blur or edge collisions.
  - Iterated until the icon stopped touching the border and the shape matched the intended reference more closely.

### 3. Notes for future tests

- Deployment checks:
  - After every visual/dashboard change, verify the live Vercel alias, not just the local build.
  - Check the live page for the expected `data-section` landmarks in a real browser session.
  - Do not trust a deploy until both `curl` and browser evaluation confirm the alias is serving the intended build.
- Icon checks:
  - Keep using exact source references rather than memory.
  - Continue testing for:
    - correct asset wiring
    - no embedded blurry bitmap fallback where it should not exist
    - no unintended border treatment
    - no edge-touching bounds
  - Render icon proof images at actual install-icon scale before calling the work done.
- Mobile UI checks:
  - Keep deterministic viewport checks at `390x844`.
  - Continue verifying:
    - nav height
    - nav radius
    - safe-area insets
    - label wrapping
    - no overlap with content
    - no clipped corners
    - no input-focus zoom jump
  - For future modal or sheet work, explicitly add open/close, internal scroll, swipe-down, backdrop close, and nav interference checks.
- Dashboard / IA checks:
  - Preserve the current console silhouette:
    - compact top bar
    - one unified training surface
    - recent notes as support
  - Add or keep tests that fail if the main screen drifts back toward:
    - multiple equal-weight dashboard cards
    - repeated summary panels
    - stats and analytics sections that compete with the core loop
  - Treat “looks too similar to the last version” as a real failure mode and verify silhouette changes, not just styling changes.
- Journal / process checks:
  - Keep recording what Sean asked for, what failed, and what actually fixed it.
  - When the same issue is reported more than once, search the journal first before touching code.
  - For visual bug reports, capture before/after screenshots at the same viewport every time.

## 2026-03-23

- Request: Implement the full fix plan for storage safety, truthful persistence, notes visibility/search, local-date consistency, base-aware PWA paths, and the last notebook UI cleanup without changing the simplified product structure.
- Previous attempt: The last shipped notebook UI looked cleaner, but storage hydration still trusted malformed records, saves still relied on a follow-up effect, freeform notes still disappeared from the product, date filters and weekly trends still used UTC semantics, and the PWA still assumed a root deployment path.
- Attempt: Added failing tests for storage hydration and recovery rendering, note visibility and search, local-day filtering, weekly trend grouping, coherent current-focus summaries, base-aware service-worker registration, and the entry-screen chrome regression.
- Error: The first storage validator pass compiled in tests but failed `tsc -b` because the enum checks were still feeding generic strings into literal-tuple `includes()` calls.
- Error: The first base-path HTML change broke Vite build resolution because `%BASE_URL%src/main.tsx` is not treated as a source entry the way `/src/main.tsx` is.
- Result: Storage now returns explicit hydration states, malformed or future payloads render a recovery state without being overwritten, notebook writes happen through one immediate commit path, notes render in recent/history views and search correctly, local date filters and weekly trends align with displayed local dates, dashboard focus uses one recent summary, PWA runtime paths work under a subpath build, and the entry screen no longer carries the extra `View Full Log` utility action or the standalone keyboard-help panel.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and a subpath build check with `npm run build -- --base=/smash/` all passed; local screenshots were captured for the normal notebook state and the storage recovery state.
- Request: Use the frontend design skill and make the simplified notebook UI actually look good without changing the current topbar-plus-training-console structure.
- Previous attempt: The product structure was finally correct, but the shell still looked cheap because the topbar, training console, and nav were each using a different visual language, so the screen read as a collection of decent pieces instead of one resolved product surface.
- Attempt: Added a failing shell test for an editorial topbar tone, a sheet-like console tone, and a quieter mobile-nav tone; then tightened the global tokens and shell primitives so the dashboard reads like one editorial training sheet and the entry form chrome uses the same calmer system.
- Error: The first browser proof screenshot for this pass was invalid because the local dev server had dropped and Firefox captured a connection error instead of the app, so the visual proof had to be rerun after the targeted test passed.
- Result: The dashboard now uses an editorial topbar, a lined-paper coaching sheet, a quieter integrated mobile nav, flatter note rows, and less pill-heavy form chrome while keeping the same simplified product structure.
- Verification: `npm test -- src/App.test.tsx`, `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed; fresh desktop and mobile screenshots were captured for the polished dashboard shell.
- Request: Fix the fact that the last design pass still looked like the same screen and make the dashboard materially different at a glance without changing the simplified structure.
- Previous attempt: The earlier polish pass only changed chrome and spacing, so the topbar, nav, and console still preserved the same header-plus-card composition and felt visually too close to the previous version.
- Attempt: Added a failing shell test for a folio topbar, a spread console layout, a ledger notes strip, and a bare nav treatment; then converted the dashboard shell from a centered paper card into a split folio surface with a stronger rail, larger issue typography, and line-based nav states.
- Result: The dashboard now reads as a folio spread instead of the same rounded card layout, and the before/after screenshots at both desktop and 390x844 show a materially different composition while keeping the same product structure.
- Verification: `npm test -- src/App.test.tsx`, `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` all passed; fresh desktop/mobile before-and-after proof images were captured.

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


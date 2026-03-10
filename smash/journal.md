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


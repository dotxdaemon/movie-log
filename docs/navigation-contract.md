# Navigation Contract

Movie Log is a local Electron archive, not a web site. Its destinations are in-memory application views:

- Library
- Search
- Statistics
- Settings
- Dossier detail

Top-level navigation changes the active working surface without creating placeholder URLs or pretending local files have public deep links. A Dossier records its originating Library or Search context; its explicit Back action restores that view and returns focus to the triggering entry when the element can be recovered. Escape from Search restores the prior top-level view and opener focus. Relaunch starts at Library.

This is intentional product behavior. URL history, refresh restoration, and browser-style deep links are not supported capabilities and must not be described as existing routes.

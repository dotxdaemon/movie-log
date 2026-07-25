# Workspace Reference

This document defines the visual contract for Movie Log using Sean's supplied four-panel fashion illustration, preserved at `docs/reference/movie-log-pastel-fashion-grid.png`.

The application translates the image's palette, balance, optical geometry, and contrast hierarchy into an original interface. It does not copy a depicted person, garment, pose, logo, or illustration into the product UI.

## Reference Evidence

- Source dimensions: 1542×2048 PNG
- SHA-256: `3daa458e544ce6f962fa56032d13d5217445b504b1d62754d57a05171724745c`
- Canonical repository asset: `docs/reference/movie-log-pastel-fashion-grid.png`
- Pale volume: white hair and skin create luminous high-value masses against a cool gray-pink field.
- Graphite anchor: black outerwear gives each panel a stable visual base.
- Controlled accent field: coral, powder blue, muted tangerine, and floral fragments appear in concentrated patches.
- Circular geometry: glasses, hair coils, and repeated rounded forms soften the dark structural clothing.
- Four-panel balance: separate portraits form a regular matrix while each portrait remains compositionally different.
- Air and texture: quiet backgrounds leave room for expressive color without reducing legibility.

## Required Markers

- Original product interface with no direct reproduction of the supplied subjects or artwork
- Soft gray-pink canvas with pale white and blush surface layers
- Graphite navigation and high-contrast structural text
- Coral primary accent, powder-blue secondary accent, and restrained tangerine support accent
- Rounded optical geometry used for navigation, controls, cards, and status markers
- Luminous top-level surfaces with translucent layering limited to shell, header, dialogs, and mobile navigation
- Repeated content rows and cards kept blur-free for scrolling performance
- Four-part visual rhythm expressed through balanced grids, paired metrics, and asymmetric detail regions
- Poster artwork given primary visual weight without obscuring title, date, rating, or action state
- Typography split between a characterful editorial heading face and a highly readable body face
- Strong keyboard focus, twelve-pixel minimum text, forty-four-pixel interactive targets, and AA muted-text contrast
- Responsive navigation synchronized with screenshot capture at 900 pixels
- Compact library filters synchronized with screenshot capture at 1024 pixels
- Every visible action connected to existing logging, search, filtering, file, folder, editing, or navigation behavior

## Surface Map

- Application shell: graphite navigation beside a luminous archive field
- Header: editorial title, count pills, metadata status, search, and the primary logging action
- Library: poster-led cards with a persistent selected-title inspector on desktop
- Diary: timeline, ledger, and poster-grid modes with separate usable geometries
- Search: diary, library, and catalog lanes with one keyboard-active result
- Dossier: poster-first identity, personal rating, metadata, viewing history, catalog match, and local-file actions
- Statistics: compact metric plates, readable charts, and a horizontally contained 53-week activity calendar
- Settings: watched folders, current indexed content, and durable local data paths
- Dialogs: focused logging and filter workspaces that become safe-area-aware sheets on narrow screens

## Guardrails

- No fake routes, ratings, filters, posters, metadata, or controls
- No copied character artwork inside the application interface
- No repeated backdrop blur on cards, list rows, search results, or statistics panels
- No hover motion that shifts controls under the pointer
- No text below twelve pixels
- No horizontal document overflow
- No screenshot selector breakpoint that disagrees with the rendered CSS breakpoint
- No normal-motion importance overrides outside the reduced-motion block

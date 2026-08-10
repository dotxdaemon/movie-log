// ABOUTME: Verifies that the main Movie Log surfaces avoid expensive backdrop blur effects.
// ABOUTME: Keeps renderer compositing cost low enough for responsive desktop interactions.
import postcss, { type Container } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readStyles } from './style-source.js';

const readCompleteStyles = async () => readStyles();

describe('styles.css', () => {
  it('keeps one authoritative rule per selector and one block per responsive query', async () => {
    const styles = await readCompleteStyles();
    const root = postcss.parse(styles);
    const duplicateSelectors: string[] = [];

    function inspect(container: Container, context: string): void {
      const seen = new Set<string>();

      for (const node of container.nodes ?? []) {
        if (node.type === 'rule') {
          if (seen.has(node.selector)) {
            duplicateSelectors.push(`${context}: ${node.selector}`);
          }

          seen.add(node.selector);
        }

        if (node.type === 'atrule' && node.nodes) {
          inspect(node, `${node.name} ${node.params}`);
        }
      }
    }

    inspect(root, 'root');
    const mediaQueries = root.nodes.flatMap((node) =>
      node.type === 'atrule' && node.name === 'media' ? [node.params] : []
    );

    expect(duplicateSelectors).toEqual([]);
    expect(new Set(mediaQueries).size).toBe(mediaQueries.length);
  });

  it('keeps the large window surfaces free of backdrop blur', async () => {
    const styles = await readCompleteStyles();

    expect(styles).not.toMatch(
      /\.stat-card,\s*\.panel,\s*\.drop-zone,\s*\.message-strip,\s*\.tab-row,\s*\.empty-card\s*\{[^}]*backdrop-filter:/s
    );
  });

  it('keeps shared button hover styles from moving controls under the pointer', async () => {
    const styles = await readCompleteStyles();

    expect(styles).not.toMatch(
      /\.tab-button:hover,\s*\.panel-button:hover,\s*\.ghost-button:hover\s*\{[^}]*transform:/s
    );
  });

  it('keeps the focal Library on the pale field instead of restoring the tailored dark slab', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.archive-canvas\s*\{[^}]*background:[^}]*var\(--canvas\)/s);
    expect(styles).not.toMatch(/\.tailored-room\s*\{/s);
    expect(styles).not.toMatch(/\.command-bar\s*\{/s);
    expect(styles).not.toMatch(/\.ledger-surface\s*\{/s);
    expect(styles).not.toMatch(/\.records-frame\s*\{[^}]*border:/s);
  });

  it('gives Library titles a direct dossier action instead of a persistent action column', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.movie-card-open-action\s*\{/);
    expect(styles).toMatch(/\.dossier-actions\s*\{/);
    expect(styles).not.toMatch(/\.record-actions\s*\{/);
  });

  it('contains unbroken filename-stem titles across Library, settings, and dossier surfaces', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(
      /\.current-contents-list button > span\s*\{[^}]*overflow:\s*hidden[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*2/s
    );
    expect(styles).toMatch(/\.movie-card-title\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*2/s);
    expect(styles).toMatch(
      /\.current-contents-list button:focus-visible small,[^{]*\{[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*normal/s
    );
    expect(styles).toMatch(/\.dossier-identity h2\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  });

  it('clips root horizontal overflow while keeping wide activity inside its own scroller', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/html\s*\{[^}]*overflow-x:\s*clip/s);
    expect(styles).toMatch(/body,\s*#root\s*\{[^}]*overflow-x:\s*clip/s);
    expect(styles).toMatch(/\.activity-calendar\s*\{[^}]*overflow-x:\s*auto/s);
  });

  it('keeps the phone search input at a non-zooming size above the safe mobile action bar', async () => {
    const styles = await readCompleteStyles();
    const phoneStyles = styles.split('@media (max-width: 700px)')[1] ?? '';
    const mobileNavigationStyles = styles.slice(
      styles.indexOf('@media (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(phoneStyles).toMatch(/\.archive-search input\s*\{[^}]*font-size:\s*1rem/s);
    expect(phoneStyles).toMatch(/:is\(input, select, textarea\)\s*\{[^}]*font-size:\s*16px/s);
    expect(mobileNavigationStyles).toMatch(/\.mobile-nav\s*\{[^}]*safe-area-inset-bottom/s);
    expect(mobileNavigationStyles).toMatch(/\.mobile-nav-item\s*\{[^}]*min-height:\s*64px/s);
  });

  it('uses a two-column logging workspace on desktop', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(
      /\.log-sheet-body\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*0\.85fr\)\s+minmax\(360px,\s*1\.15fr\)/s
    );
  });

  it('wraps the logging rating control inside its desktop form column', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.log-sheet \.rating-input\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(styles).toMatch(
      /\.log-sheet \.rating-segments\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(styles).toMatch(/\.log-sheet \.rating-none\s*\{[^}]*width:\s*100%/s);
  });

  it('wraps the dossier editor rating control before it can overlap the current value', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.viewing-editor-body \.rating-input\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(styles).toMatch(
      /\.viewing-editor-body \.rating-segments\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(styles).toMatch(/\.viewing-editor-body \.rating-none\s*\{[^}]*width:\s*100%/s);
  });

  it('moves the deliberate logging action with the navigation breakpoint', async () => {
    const styles = await readCompleteStyles();
    const compactRailStyles = styles.slice(
      styles.indexOf('@media (max-width: 1180px)'),
      styles.indexOf('@media (max-width: 1024px)')
    );
    const mobileNavigationStyles = styles.slice(
      styles.indexOf('@media (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(compactRailStyles).toMatch(/\.archive-spine \.log-action\s*\{/);
    expect(compactRailStyles).not.toMatch(/\n\s*\.log-action\s*\{/);
    expect(mobileNavigationStyles).toMatch(/\.header-log-action\s*\{[^}]*display:\s*flex/s);
    expect(mobileNavigationStyles).toMatch(
      /\.mobile-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(mobileNavigationStyles).not.toMatch(/\.mobile-nav \.mobile-log-action\s*\{/s);
  });

  it('shows the persistent Library inspector at normal desktop widths', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toContain('@media (min-width: 1180px)');
    expect(styles).toMatch(
      /@media \(min-width:\s*1180px\)\s*\{[\s\S]*?\.library-workspace-selected\s*\{[^}]*grid-template-columns:[^}]*280px/s
    );
  });

  it('keeps Statistics contained and the phone dossier identity inside the first viewport', async () => {
    const styles = await readCompleteStyles();
    const phoneStyles = styles.slice(styles.lastIndexOf('@media (max-width: 700px)'));

    expect(phoneStyles).toMatch(/\.statistics-view,[^{]*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s);
    expect(phoneStyles).toMatch(/\.dossier-identity > \.dossier-poster-col\s*\{[^}]*width:\s*min\(34vw,\s*130px\)/s);
  });

  it('lets viewing rows contract inside the tablet content width', async () => {
    const styles = await readCompleteStyles();
    const tabletStyles = styles.slice(
      styles.indexOf('@media (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(tabletStyles).toMatch(
      /\.viewing-row\s*\{[^}]*grid-template-columns:[^}]*minmax\(0,\s*0\.9fr\)[^}]*minmax\(0,\s*1fr\)/s
    );
    expect(tabletStyles).toMatch(/\.viewing-row\s*>\s*\*\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s);
  });

  it('keeps interactive controls at comfortable touch sizes', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.dossier-actions button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.rating-segment\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.filter-field select\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.status-banner button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.watched-folder-list article > button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.filter-chip\s*\{[^}]*min-height:\s*44px/s);
  });

  it('keeps the checked rating plate structural beneath its light numeric label', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(
      /\.rating-segment input:checked\s*~\s*\.rating-segment-mark\s*\{[^}]*background:\s*var\(--structural\)/s
    );
    expect(styles).toMatch(
      /\.rating-segment input:checked\s*~\s*\.rating-segment-readout\s*\{[^}]*color:\s*var\(--paper\)/s
    );
    expect(styles).toMatch(
      /\.rating-segment\s+\.rating-segment-readout\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s
    );
  });

  it('puts dossier artwork before title, rating, and metadata on phones', async () => {
    const styles = await readCompleteStyles();
    const phoneStyles = styles.slice(styles.lastIndexOf('@media (max-width: 700px)'));

    expect(phoneStyles).toMatch(/\.dossier-identity\s*>\s*\.dossier-poster-col\s*\{[^}]*order:\s*0/s);
    expect(phoneStyles).toMatch(/\.dossier-identity\s*>\s*\.dossier-copy\s*\{[^}]*order:\s*1/s);
    expect(phoneStyles).toMatch(/\.dossier-backdrop\s*\{[^}]*display:\s*none/s);
  });

  it('shows three library poster columns from wider phones through tablets', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(
      /@media \(min-width:\s*520px\) and \(max-width:\s*900px\)\s*\{[^}]*\.movie-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(styles.lastIndexOf('@media (min-width: 520px) and (max-width: 900px)')).toBeGreaterThan(
      styles.lastIndexOf('@media (max-width: 700px)')
    );
  });

  it('uses an unclipped icon action in the compact desktop rail', async () => {
    const styles = await readCompleteStyles();
    const compactRailStyles = styles.slice(
      styles.indexOf('@media (max-width: 1180px)'),
      styles.indexOf('@media (max-width: 1024px)')
    );

    expect(compactRailStyles).toMatch(/\.archive-spine \.log-action\s*\{[^}]*width:\s*58px/s);
    expect(compactRailStyles).toMatch(/\.archive-spine \.log-action\s*\{[^}]*min-height:\s*58px/s);
    expect(compactRailStyles).toMatch(/\.archive-spine \.log-action-label\s*\{[^}]*display:\s*none/s);
  });

  it('keeps medium-width poster grids truthful and free of duplicate overlays', async () => {
    const styles = await readCompleteStyles();
    const mobileNavigationStyles = styles.slice(
      styles.indexOf('@media (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(mobileNavigationStyles).toMatch(/\.movie-grid \.card-annotation\s*\{[^}]*display:\s*none/s);
    expect(styles).toMatch(
      /@media \(min-width:\s*520px\) and \(max-width:\s*900px\)\s*\{[^}]*\.movie-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s
    );
  });

  it('reserves metadata geometry and separates compact heading rows', async () => {
    const styles = await readCompleteStyles();
    const phoneStyles = styles.slice(
      styles.indexOf('@media (max-width: 700px)'),
      styles.indexOf('@media (min-width: 520px) and (max-width: 900px)')
    );

    expect(styles).toMatch(
      /\.metadata-status-placeholder\s*\{[^}]*width:\s*190px[^}]*height:\s*24px[^}]*background:\s*var\(--surface-lavender\)/s
    );
    expect(phoneStyles).toMatch(/\.header-title-block h1\s*\{[^}]*grid-row:\s*2[^}]*grid-column:\s*1\s*\/\s*-1/s);
    expect(phoneStyles).toMatch(
      /\.header-title-block \.section-index\s*\{[^}]*grid-row:\s*1[^}]*white-space:\s*nowrap/s
    );
    expect(phoneStyles).toMatch(/\.header-title-block \.metadata-status\s*\{[^}]*display:\s*none/s);
    expect(phoneStyles).toMatch(/\.mobile-archive-status\s*\{[^}]*grid-row:\s*1[^}]*grid-column:\s*2/s);
    expect(phoneStyles).toMatch(/\.mobile-archive-status\s*\{[^}]*min-height:\s*24px[^}]*line-height:\s*24px/s);
    expect(phoneStyles).toMatch(/\.header-count-line\s*\{[^}]*display:\s*none/s);
    expect(phoneStyles).toMatch(/\.metadata-status-placeholder\s*\{[^}]*width:\s*166px[^}]*height:\s*24px/s);
    expect(styles).toMatch(/\.library-loading\s*\{[^}]*border-top:\s*0/s);
    expect(styles).toMatch(/\.skeleton-card-title\s*\{[^}]*height:\s*37px/s);
    expect(styles).toMatch(/\.skeleton-card-media,\s*\.skeleton-card-meta\s*\{[^}]*height:\s*17px/s);
  });

  it('keeps the compact side rail on tablet instead of switching to phone navigation', async () => {
    const styles = await readCompleteStyles();
    const tabletRailStyles = styles.slice(
      styles.indexOf('@media (min-width: 701px) and (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(tabletRailStyles).toMatch(/\.dossier-shell\s*\{[^}]*display:\s*grid[^}]*padding-bottom:\s*0/s);
    expect(tabletRailStyles).toMatch(/\.archive-spine\s*\{[^}]*display:\s*flex/s);
    expect(tabletRailStyles).toMatch(/\.archive-canvas\s*\{[^}]*min-height:\s*100dvh/s);
    expect(tabletRailStyles).toMatch(/\.mobile-nav\s*\{[^}]*display:\s*none/s);
  });

  it('defines spacing, shadow, and motion tokens for the shared visual system', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toContain('--space-1: 4px');
    expect(styles).toContain('--space-4: 16px');
    expect(styles).toContain('--space-6: 32px');
    expect(styles).toContain('--space-7: 48px');
    expect(styles).toContain('--space-8: 64px');
    expect(styles).toContain('--shadow-panel:');
    expect(styles).toContain('--motion:');
  });

  it('contains none of the obsolete style families removed by the archive passes', async () => {
    const styles = await readCompleteStyles();
    const obsoleteFamilies = [
      'entry-poster',
      'rating-display',
      'diary-review',
      'filter-drawer',
      'mobile-filter-actions',
      'poster-index',
      'poster-monogram',
      'poster-rule',
      'primary-button',
      'secondary-button',
      'text-button',
      'loading-row',
      'header-filters'
    ];

    for (const family of obsoleteFamilies) {
      expect(styles).not.toContain(`.${family}`);
    }
  });

  it('gives catalog failures a designed alert state', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(
      /\.catalog-error\s*\{[^}]*min-height:\s*96px[^}]*border-left:\s*4px solid var\(--active-red\)[^}]*background:\s*var\(--surface\)/s
    );
  });

  it('uses one restrained archive composition instead of dashboard matrices', async () => {
    const styles = await readCompleteStyles();

    expect(styles).not.toContain('Remaining audit composition');
    expect(styles).toMatch(/\.filter-toolbar\s*\{[^}]*display:\s*none/s);
    expect(styles).toMatch(/\.search-groups\s*\{[^}]*display:\s*block/s);
    expect(styles).toMatch(/\.metric-strip\s*>\s*div\s*\{[^}]*background:\s*transparent/s);
    expect(styles).toMatch(
      /\.statistics-panels\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.4fr\)\s+minmax\(260px,\s*0\.7fr\)/s
    );
    expect(styles).toMatch(
      /\.activity-grid\s*\{[^}]*grid-template-columns:\s*repeat\(53,[^}]*grid-template-rows:\s*repeat\(7,/s
    );
    expect(styles).toMatch(/@media \(min-width:\s*1180px\)\s*\{[^}]*\.library-workspace-selected/s);
  });

  it('lays out all twelve desktop filters and reveals custom tooltips on keyboard focus', async () => {
    const styles = await readCompleteStyles();

    expect(styles).toMatch(/\.filter-toolbar\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s);
    expect(styles).toMatch(/\.filter-toolbar \.filter-field:nth-child\(-n \+ 6\)\s*\{[^}]*border-bottom:/s);
    expect(styles).toMatch(/\.accessible-tooltip-bubble\s*\{[^}]*visibility:\s*hidden/s);
    expect(styles).toMatch(
      /\.accessible-tooltip:focus-within \.accessible-tooltip-bubble\s*\{[^}]*visibility:\s*visible/s
    );
    expect(styles).not.toMatch(/\.accessible-tooltip:hover[^}]*transform:/s);
  });

  it('keeps the phone dossier informative and motion functional', async () => {
    const styles = await readCompleteStyles();
    const phoneStyles = styles.split('@media (max-width: 700px)')[1] ?? '';
    const reducedMotion = styles.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';

    expect(phoneStyles).toMatch(
      /\.dossier-identity\s*>\s*\.dossier-poster-col\s*\{[^}]*width:\s*min\(34vw,\s*130px\)/s
    );
    expect(styles).toMatch(/@keyframes sheet-reveal\s*\{[^}]*translateX\(4px\)/s);
    expect(styles).toMatch(/@keyframes sheet-rise\s*\{[^}]*translateY\(4px\)/s);
    expect(styles).toContain('@keyframes dossier-arrive');
    expect(reducedMotion).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('uses seams, compact filter access, and unobscured poster selection', async () => {
    const styles = await readCompleteStyles();
    const tabletStyles = styles.slice(
      styles.indexOf('@media (max-width: 1024px)'),
      styles.indexOf('@media (max-width: 900px)')
    );

    expect(styles).toMatch(/\.nav-item\[aria-current='page'\]\s*\{[^}]*background:\s*transparent/s);
    expect(styles).toMatch(/\.nav-item\[aria-current='page'\]::before\s*\{[^}]*transform:\s*scaleY\(1\)/s);
    expect(tabletStyles).toMatch(/\.filter-toolbar\s*\{[^}]*display:\s*none/s);
    expect(tabletStyles).toMatch(/\.filter-sheet-trigger\s*\{[^}]*display:\s*block/s);
    expect(styles).not.toMatch(/\.movie-card-selected\s+\.card-annotation/);
  });

  it('keeps modal surfaces above the mobile navigation', async () => {
    const styles = await readCompleteStyles();
    const mobileNavigationStyles = styles.slice(
      styles.indexOf('@media (max-width: 900px)'),
      styles.indexOf('@media (max-width: 700px)')
    );

    expect(styles).toMatch(/\.log-backdrop\s*\{[^}]*z-index:\s*100/s);
    expect(styles).toMatch(/\.filter-sheet-backdrop\s*\{[^}]*z-index:\s*110/s);
    expect(mobileNavigationStyles).toMatch(/\.mobile-nav\s*\{[^}]*z-index:\s*80/s);
  });

  it('keeps form actions in flow and reserves importance overrides for reduced motion', async () => {
    const styles = await readCompleteStyles();
    const normalMotion = styles.split('@media (prefers-reduced-motion: reduce)')[0] ?? styles;

    expect(styles).toMatch(/\.entry-form-footer\s*\{[^}]*position:\s*static/s);
    expect(styles).toMatch(/\.sheet-close\s*\{[^}]*flex:\s*0 0 48px[^}]*width:\s*48px[^}]*height:\s*48px/s);
    expect(normalMotion).not.toContain('!important');
  });
});

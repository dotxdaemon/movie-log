// ABOUTME: Verifies that the main Movie Log surfaces avoid expensive backdrop blur effects.
// ABOUTME: Keeps renderer compositing cost low enough for responsive desktop interactions.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss, { type Container } from 'postcss';
import { describe, expect, it } from 'vitest';

const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

describe('styles.css', () => {
  it('keeps one authoritative rule per selector and one block per responsive query', async () => {
    const styles = await readFile(stylesPath, 'utf8');
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
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).not.toMatch(
      /\.stat-card,\s*\.panel,\s*\.drop-zone,\s*\.message-strip,\s*\.tab-row,\s*\.empty-card\s*\{[^}]*backdrop-filter:/s
    );
  });

  it('keeps shared button hover styles from moving controls under the pointer', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).not.toMatch(
      /\.tab-button:hover,\s*\.panel-button:hover,\s*\.ghost-button:hover\s*\{[^}]*transform:/s
    );
  });

  it('keeps the focal diary on the pale field instead of restoring the tailored dark slab', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.archive-canvas\s*\{[^}]*background:[^}]*var\(--canvas\)/s);
    expect(styles).toMatch(/\.entry-body\s*\{[^}]*background:[^}]*var\(--surface\)/s);
    expect(styles).not.toMatch(/\.tailored-room\s*\{/s);
    expect(styles).not.toMatch(/\.command-bar\s*\{/s);
    expect(styles).not.toMatch(/\.ledger-surface\s*\{/s);
    expect(styles).not.toMatch(/\.records-frame\s*\{[^}]*border:/s);
  });

  it('gives diary titles a direct dossier action instead of a persistent action column', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.entry-body h3 button\s*\{/);
    expect(styles).toMatch(/\.dossier-actions\s*\{/);
    expect(styles).not.toMatch(/\.record-actions\s*\{/);
  });

  it('contains unbroken filename-stem titles inside the diary column', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.entry-body h3 button\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s);
    expect(styles).toMatch(
      /\.current-contents-list button > span\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s
    );
    expect(styles).toMatch(/\.dossier-identity h2\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  });

  it('keeps the phone search input at a non-zooming size above the safe mobile action bar', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const phoneStyles = styles.split('@media (max-width: 700px)')[1] ?? '';

    expect(phoneStyles).toMatch(/\.archive-search input\s*\{[^}]*font-size:\s*1rem/s);
    expect(phoneStyles).toMatch(/:is\(input, select, textarea\)\s*\{[^}]*font-size:\s*16px/s);
    expect(phoneStyles).toMatch(/\.mobile-nav\s*\{[^}]*safe-area-inset-bottom/s);
    expect(phoneStyles).toMatch(/\.mobile-nav-item\s*\{[^}]*min-height:\s*64px/s);
  });

  it('gives ledger and grid diary modes distinct working geometries', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.diary-ledger \.diary-entry\s*\{/);
    expect(styles).toMatch(/\.diary-grid \.diary-list\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.diary-grid \.film-poster\s*\{/);
  });

  it('styles the selected diary view tab through its rendered ARIA state', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(
      /\.view-switcher button\[aria-selected=['"]true['"]\]\s*\{[^}]*background:\s*var\(--structural\)/s
    );
    expect(styles).not.toMatch(/\.view-switcher button\[aria-pressed="true"\]/);
  });

  it('uses a two-column logging workspace on desktop', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(
      /\.log-sheet-body\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*0\.85fr\)\s+minmax\(360px,\s*1\.15fr\)/s
    );
  });

  it('wraps the logging rating control inside its desktop form column', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.log-sheet \.rating-input\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(styles).toMatch(
      /\.log-sheet \.rating-segments\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(styles).toMatch(/\.log-sheet \.rating-none\s*\{[^}]*width:\s*100%/s);
  });

  it('keeps one deliberate logging action on tablets and phones', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const tabletStyles = styles.slice(
      styles.indexOf('@media (max-width: 1040px)'),
      styles.indexOf('@media (max-width: 700px)')
    );
    const phoneStyles = styles.slice(styles.lastIndexOf('@media (max-width: 700px)'));

    expect(tabletStyles).toMatch(/\.archive-spine \.log-action\s*\{/);
    expect(tabletStyles).not.toMatch(/\n\s*\.log-action\s*\{/);
    expect(phoneStyles).toMatch(/\.header-log-action\s*\{[^}]*display:\s*none/s);
    expect(phoneStyles).toMatch(/\.mobile-nav\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*1fr\)/s);
    expect(phoneStyles).toMatch(/\.mobile-nav \.mobile-log-action\s*\{[^}]*position:\s*relative/s);
  });

  it('keeps interactive controls at comfortable touch sizes', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.view-switcher button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.dossier-actions button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.rating-segment\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.filter-field select\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.status-banner button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.watched-folder-list article > button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.filter-chip\s*\{[^}]*min-height:\s*44px/s);
  });

  it('puts dossier artwork before title, rating, and metadata on phones', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const phoneStyles = styles.slice(styles.lastIndexOf('@media (max-width: 700px)'));

    expect(phoneStyles).toMatch(/\.dossier-identity\s*>\s*\.dossier-poster-col\s*\{[^}]*order:\s*0/s);
    expect(phoneStyles).toMatch(/\.dossier-identity\s*>\s*\.dossier-copy\s*\{[^}]*order:\s*1/s);
    expect(phoneStyles).toMatch(/\.dossier-backdrop\s*\{[^}]*display:\s*none/s);
  });

  it('shows three library poster columns on wider phones', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(
      /@media \(min-width:\s*520px\) and \(max-width:\s*700px\)\s*\{[^}]*\.movie-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s
    );
    expect(styles.lastIndexOf('@media (min-width: 520px) and (max-width: 700px)')).toBeGreaterThan(
      styles.lastIndexOf('@media (max-width: 700px)')
    );
  });

  it('defines spacing, shadow, and motion tokens for the shared visual system', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toContain('--space-1: 4px');
    expect(styles).toContain('--space-4: 16px');
    expect(styles).toContain('--space-6: 32px');
    expect(styles).toContain('--space-7: 48px');
    expect(styles).toContain('--space-8: 64px');
    expect(styles).toContain('--shadow-panel:');
    expect(styles).toContain('--motion:');
  });

  it('contains none of the obsolete style families removed by the archive passes', async () => {
    const styles = await readFile(stylesPath, 'utf8');
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
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(
      /\.catalog-error\s*\{[^}]*min-height:\s*96px[^}]*border-left:\s*4px solid var\(--active-red\)[^}]*background:\s*var\(--surface\)/s
    );
  });

  it('uses one cardless archive composition instead of dashboard matrices', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const composition = styles.split('/* Remaining audit composition */')[1] ?? '';

    expect(composition).toMatch(/\.month-metrics\s*>\s*div\s*\{[^}]*background:\s*transparent/s);
    expect(composition).toMatch(/\.filter-toolbar\s*\{[^}]*display:\s*none/s);
    expect(composition).toMatch(/\.search-groups\s*\{[^}]*display:\s*block/s);
    expect(composition).toMatch(/\.metric-strip\s*>\s*div\s*\{[^}]*background:\s*transparent/s);
    expect(composition).toMatch(
      /\.statistics-panels\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.4fr\)\s+minmax\(260px,\s*0\.7fr\)/s
    );
    expect(composition).toMatch(
      /\.activity-grid\s*\{[^}]*grid-template-columns:\s*repeat\(53,[^}]*grid-template-rows:\s*repeat\(7,/s
    );
    expect(composition).toMatch(/@media \(min-width:\s*1500px\)\s*\{[^}]*\.library-workspace-selected/s);
  });

  it('keeps the phone dossier informative and motion functional', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const composition = styles.split('/* Remaining audit composition */')[1] ?? '';
    const phoneStyles = composition.split('@media (max-width: 700px)')[1] ?? '';
    const reducedMotion = composition.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';

    expect(phoneStyles).toMatch(
      /\.dossier-identity\s*>\s*\.dossier-poster-col\s*\{[^}]*width:\s*min\(46vw,\s*180px\)/s
    );
    expect(composition).toContain('@keyframes sheet-reveal');
    expect(composition).toContain('@keyframes dossier-arrive');
    expect(reducedMotion).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});

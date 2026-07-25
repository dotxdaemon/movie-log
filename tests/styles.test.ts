// ABOUTME: Verifies the rewritten Movie Log surface hierarchy, responsive geometry, and interaction safeguards.
// ABOUTME: Reads the complete CSS cascade so visual quality, accessibility, and capture compatibility regress together.
import postcss, { type AtRule, type Container, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readStyles } from './style-source.js';

const stylesheet = readStyles();
const root = postcss.parse(stylesheet);

function parentMedia(rule: Rule): string | null {
  let parent: unknown = rule.parent;

  while (parent && typeof parent === 'object') {
    const node = parent as { name?: string; params?: string; parent?: unknown; type?: string };

    if (node.type === 'atrule' && node.name === 'media') {
      return node.params ?? null;
    }

    parent = node.parent;
  }

  return null;
}

function rulesFor(selector: string, media: string | null = null): Rule[] {
  const matches: Rule[] = [];

  root.walkRules((rule) => {
    if (rule.selectors.includes(selector) && parentMedia(rule) === media) {
      matches.push(rule);
    }
  });

  return matches;
}

function declarationValues(selector: string, property: string, media: string | null = null): string[] {
  return rulesFor(selector, media).flatMap((rule) =>
    rule.nodes.flatMap((node) => (node.type === 'decl' && node.prop === property ? [node.value] : []))
  );
}

function expectDeclaration(
  selector: string,
  property: string,
  expected: string | RegExp,
  media: string | null = null
): void {
  const values = declarationValues(selector, property, media);

  if (typeof expected === 'string') {
    expect(values).toContain(expected);
  } else {
    expect(values.some((value) => expected.test(value))).toBe(true);
  }
}

describe('styles.css', () => {
  it('keeps one authoritative full selector per cascade scope and one block per responsive query', () => {
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

  it('limits backdrop blur to the shell, dialogs, and mobile navigation', () => {
    const allowed = new Set([
      '.archive-background',
      '.filter-sheet,\n.log-sheet',
      '.filter-sheet-backdrop,\n.log-backdrop',
      '.filter-sheet-head,\n.log-sheet-head',
      '.mobile-nav'
    ]);
    const unexpected: string[] = [];

    root.walkDecls('backdrop-filter', (declaration) => {
      const rule = declaration.parent;

      if (rule?.type === 'rule' && !allowed.has(rule.selector)) {
        unexpected.push(rule.selector);
      }
    });

    expect(unexpected).toEqual([]);
    expectDeclaration('.archive-background', 'backdrop-filter', /blur\(16px\)/);
    expectDeclaration('.mobile-nav', 'backdrop-filter', /blur\(18px\)/, '(max-width: 900px)');
  });

  it('keeps hover feedback from moving controls beneath the pointer', () => {
    const movingHoverRules: string[] = [];

    root.walkRules((rule) => {
      if (!rule.selector.includes(':hover')) {
        return;
      }

      if (rule.nodes.some((node) => node.type === 'decl' && node.prop === 'transform')) {
        movingHoverRules.push(rule.selector);
      }
    });

    expect(movingHoverRules).toEqual([]);
  });

  it('uses the supplied pale field with a graphite navigation anchor', () => {
    expectDeclaration('body', 'background', /radial-gradient/);
    expectDeclaration('.archive-spine', 'background', /linear-gradient/);
    expectDeclaration('.archive-background', 'background', /var\(--panel-strong\)/);
    expect(stylesheet).not.toContain('.tailored-room');
    expect(stylesheet).not.toContain('.command-bar');
    expect(stylesheet).not.toContain('.ledger-surface');
  });

  it('contains long titles and local paths without document overflow', () => {
    expectDeclaration('.entry-body h3 button', 'overflow-wrap', 'anywhere');
    expectDeclaration('.movie-card-title', '-webkit-line-clamp', '2');
    expectDeclaration('.movie-card-title', 'overflow-wrap', 'anywhere');
    expectDeclaration('.current-contents-list button > span', '-webkit-line-clamp', '2');
    expectDeclaration('.current-contents-list button > span', 'overflow-wrap', 'anywhere');
    expectDeclaration('.dossier-copy h2', 'overflow-wrap', 'anywhere');
    expectDeclaration('.current-contents-list button:focus-visible small', 'white-space', 'normal');
  });

  it('clips root overflow while keeping the yearly activity calendar independently scrollable', () => {
    expectDeclaration('html', 'overflow-x', 'clip');
    expectDeclaration('body', 'overflow-x', 'clip');
    expectDeclaration('#root', 'overflow-x', 'clip');
    expectDeclaration('.activity-calendar', 'overflow-x', 'auto');
  });

  it('keeps phone form fields at a non-zooming size above a safe-area-aware action bar', () => {
    expectDeclaration(':is(input, select, textarea)', 'font-size', '16px', '(max-width: 700px)');
    expectDeclaration('.archive-search input', 'font-size', '1rem', '(max-width: 700px)');
    expectDeclaration('.mobile-nav', 'bottom', /safe-area-inset-bottom/, '(max-width: 900px)');
    expectDeclaration('.mobile-nav-item', 'min-height', '64px', '(max-width: 900px)');
  });

  it('gives timeline, ledger, and poster diary modes separate usable geometry', () => {
    expectDeclaration('.diary-entry', 'grid-template-columns', /96px minmax\(0, 1fr\)/);
    expectDeclaration('.diary-ledger-row > button', 'grid-template-columns', /92px minmax\(0, 1fr\)/);
    expectDeclaration('.diary-poster-grid', 'grid-template-columns', /auto-fill/);
  });

  it('styles the selected diary tab through its rendered ARIA state', () => {
    expectDeclaration(".view-switcher button[aria-selected='true']", 'background', /var\(--accent\)/);
    expect(stylesheet).not.toContain('.view-switcher button[aria-pressed');
  });

  it('uses a two-column logging workspace on desktop and one column in the compact layout', () => {
    expectDeclaration('.log-sheet-body', 'grid-template-columns', /minmax\(0, 0\.85fr\) minmax\(360px, 1\.15fr\)/);
    expectDeclaration('.log-sheet-body', 'grid-template-columns', '1fr', '(max-width: 1024px)');
  });

  it('keeps the logging rating control contained within its form column', () => {
    expectDeclaration('.log-sheet .rating-input', 'grid-template-columns', '1fr', '(max-width: 1024px)');
    expectDeclaration(
      '.log-sheet .rating-segments',
      'grid-template-columns',
      'repeat(5, minmax(0, 1fr))',
      '(max-width: 1024px)'
    );
    expectDeclaration('.log-sheet .rating-none', 'width', '100%', '(max-width: 1024px)');
  });

  it('keeps navigation and filter migration on explicit product breakpoints', () => {
    expectDeclaration('.archive-spine', 'display', 'none', '(max-width: 900px)');
    expectDeclaration('.mobile-nav', 'display', 'grid', '(max-width: 900px)');
    expectDeclaration('.filter-toolbar', 'display', 'none', '(max-width: 1024px)');
    expectDeclaration('.filter-sheet-trigger', 'display', 'inline-flex', '(max-width: 1024px)');
  });

  it('shows the selected Library inspector at standard desktop widths', () => {
    expectDeclaration(
      '.library-workspace-selected',
      'grid-template-columns',
      'minmax(0, 1fr) 280px',
      '(min-width: 1180px)'
    );
    expectDeclaration('.library-inspector', 'display', 'grid', '(min-width: 1180px)');
  });

  it('puts dossier artwork first and removes the blurred backdrop on phones', () => {
    expectDeclaration('.dossier-identity > .dossier-poster-col', 'order', '0', '(max-width: 700px)');
    expectDeclaration('.dossier-identity > .dossier-poster-col', 'width', 'min(64vw, 240px)', '(max-width: 700px)');
    expectDeclaration('.dossier-identity > .dossier-copy', 'order', '1', '(max-width: 700px)');
    expectDeclaration('.dossier-backdrop', 'display', 'none', '(max-width: 700px)');
  });

  it('shows three poster columns on wider phones and two on narrower phones', () => {
    expectDeclaration(
      '.movie-grid',
      'grid-template-columns',
      'repeat(3, minmax(0, 1fr))',
      '(min-width: 520px) and (max-width: 700px)'
    );
    expectDeclaration('.movie-grid', 'grid-template-columns', 'repeat(2, minmax(0, 1fr))', '(max-width: 700px)');
  });

  it('keeps all major interactive surfaces at comfortable target sizes', () => {
    expectDeclaration('.view-switcher button', 'min-height', '46px');
    expectDeclaration('.dossier-actions button', 'min-height', '44px');
    expectDeclaration('.rating-segment', 'min-height', '44px');
    expectDeclaration('.filter-field select', 'min-height', '48px');
    expectDeclaration('.status-banner button', 'min-height', '44px');
    expectDeclaration('.watched-folder-list article > button', 'min-height', '44px');
    expectDeclaration('.filter-chip', 'min-height', '44px');
    expectDeclaration('.selected-film-clear', 'width', '44px');
    expectDeclaration('.sheet-close', 'width', '44px');
  });

  it('makes checked ratings and keyboard focus visually unambiguous', () => {
    expectDeclaration('.rating-segment:has(input:focus-visible)', 'outline', '2px solid var(--text)');
    expectDeclaration('.rating-segment input:checked ~ .rating-segment-mark', 'box-shadow', /var\(--accent-soft\)/);
    expectDeclaration('.rating-segment input:checked ~ .rating-segment-readout', 'font-weight', '800');
  });

  it('defines a complete shared palette, spacing, shadow, and motion system', () => {
    const requiredTokens = [
      '--bg:',
      '--panel:',
      '--text:',
      '--accent:',
      '--accent-2:',
      '--accent-3:',
      '--space-1:',
      '--space-4:',
      '--space-7:',
      '--shadow-sm:',
      '--shadow-lg:',
      '--motion-fast:',
      '--motion:'
    ];

    for (const token of requiredTokens) {
      expect(stylesheet).toContain(token);
    }
  });

  it('contains none of the obsolete style families removed from the current renderer', () => {
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
      expect(stylesheet).not.toContain(`.${family}`);
    }
  });

  it('gives catalog failures a designed and readable alert state', () => {
    expectDeclaration('.catalog-error', 'min-height', '96px');
    expectDeclaration('.catalog-error', 'border-left', '4px solid var(--accent)');
    expectDeclaration('.catalog-error', 'background', /255, 248, 249/);
  });

  it('lays out a real 53-week by 7-day activity grid inside its own scroller', () => {
    expectDeclaration('.activity-grid', 'grid-template-columns', 'repeat(53, 10px)');
    expectDeclaration('.activity-grid', 'grid-template-rows', 'repeat(7, 10px)');
    expectDeclaration('.activity-calendar', 'overflow-x', 'auto');
  });

  it('keeps form actions in flow and reserves importance overrides for reduced motion', () => {
    expectDeclaration('.entry-form-footer', 'position', 'static');
    expectDeclaration('.sheet-close', 'flex', '0 0 44px');

    const invalidImportance: string[] = [];
    root.walkDecls((declaration) => {
      if (!declaration.important) {
        return;
      }

      let parent = declaration.parent?.parent;
      let insideReducedMotion = false;

      while (parent) {
        if (
          parent.type === 'atrule' &&
          (parent as AtRule).name === 'media' &&
          (parent as AtRule).params === '(prefers-reduced-motion: reduce)'
        ) {
          insideReducedMotion = true;
          break;
        }

        parent = parent.parent;
      }

      if (!insideReducedMotion) {
        invalidImportance.push(`${declaration.prop}: ${declaration.value}`);
      }
    });

    expect(invalidImportance).toEqual([]);
  });

  it('provides functional motion with a complete reduced-motion fallback', () => {
    expect(stylesheet).toContain('@keyframes dossier-arrive');
    expect(stylesheet).toContain('@keyframes sheet-reveal');
    expect(stylesheet).toContain('@keyframes sheet-rise');
    expectDeclaration('.movie-dossier', 'animation', 'dossier-arrive var(--motion)');
    expectDeclaration('*', 'animation-duration', '0.01ms', '(prefers-reduced-motion: reduce)');
    expectDeclaration('*', 'transition-duration', '0.01ms', '(prefers-reduced-motion: reduce)');
  });

  it('keeps selected cards visible without adding an obscuring selected-state overlay', () => {
    expectDeclaration('.movie-card-selected .movie-card-face', 'border-color', /141, 164, 255/);
    expect(stylesheet).not.toContain('.movie-card-selected .card-annotation');
  });
});

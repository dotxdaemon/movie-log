// ABOUTME: Verifies that the main Movie Log surfaces avoid expensive backdrop blur effects.
// ABOUTME: Keeps renderer compositing cost low enough for responsive desktop interactions.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

describe('styles.css', () => {
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

    expect(styles).toMatch(/\.dossier-stage\s*\{[^}]*background:\s*var\(--canvas\)/s);
    expect(styles).toMatch(/\.diary-body\s*\{[^}]*background:\s*var\(--surface\)/s);
    expect(styles).not.toMatch(/\.tailored-room\s*\{/s);
    expect(styles).not.toMatch(/\.command-bar\s*\{/s);
    expect(styles).not.toMatch(/\.ledger-surface\s*\{/s);
    expect(styles).not.toMatch(/\.records-frame\s*\{[^}]*border:/s);
  });

  it('gives row titles a compact menu instead of a persistent action column', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.record-menu\s*\{/);
    expect(styles).toMatch(/\.record-menu-panel\s*\{/);
    expect(styles).not.toMatch(/\.record-actions\s*\{/);
  });

  it('keeps the phone search input at a non-zooming size above the safe mobile action bar', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const phoneStyles = styles.split('@media (max-width: 700px)')[1] ?? '';

    expect(phoneStyles).toMatch(/\.dossier-search input\s*\{[^}]*font-size:\s*1rem/s);
    expect(phoneStyles).toMatch(/\.mobile-nav\s*\{[^}]*safe-area-inset-bottom/s);
    expect(phoneStyles).toMatch(/\.mobile-nav-action\s*\{[^}]*min-height:\s*48px/s);
  });
});

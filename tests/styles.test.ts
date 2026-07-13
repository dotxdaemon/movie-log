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
    expect(styles).toMatch(/\.current-contents-list button > span\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
    expect(styles).toMatch(/\.dossier-identity h2\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  });

  it('keeps the phone search input at a non-zooming size above the safe mobile action bar', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    const phoneStyles = styles.split('@media (max-width: 700px)')[1] ?? '';

    expect(phoneStyles).toMatch(/\.archive-search input\s*\{[^}]*font-size:\s*1rem/s);
    expect(phoneStyles).toMatch(/\.mobile-nav\s*\{[^}]*safe-area-inset-bottom/s);
    expect(phoneStyles).toMatch(/\.mobile-nav-item\s*\{[^}]*min-height:\s*64px/s);
  });

  it('gives ledger and grid diary modes distinct working geometries', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toMatch(/\.diary-ledger \.diary-entry\s*\{/);
    expect(styles).toMatch(/\.diary-grid \.diary-list\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.diary-grid \.entry-poster\s*\{/);
  });
});

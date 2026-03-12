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
});

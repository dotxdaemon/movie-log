// ABOUTME: Verifies that the Electron shell permits a narrow window for responsive renderer checks.
// ABOUTME: Keeps mobile-width validation from drifting behind renderer CSS support.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mainPath = fileURLToPath(new URL('../electron/main-window.ts', import.meta.url));

describe('main window sizing', () => {
  it('allows the Movie Log window to open at mobile width', async () => {
    const mainSource = await readFile(mainPath, 'utf8');

    expect(mainSource).toMatch(/minWidth:\s*390\b/);
  });

  it('lets lifecycle intent create a hidden window for inactive tray recreation', async () => {
    const mainSource = await readFile(mainPath, 'utf8');

    expect(mainSource).toContain('show: options.activation ===');
    expect(mainSource).toContain("'active'");
  });
});

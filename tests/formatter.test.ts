// ABOUTME: Verifies project formatting is available without rewriting unrelated repository files.
// ABOUTME: Pins changed-file write and check commands backed by a development-only formatter.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('project formatter', () => {
  it('formats and checks only changed supported files', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const formatterScript = await readFile(new URL('../scripts/format-changed.mjs', import.meta.url), 'utf8');

    expect(packageJson.scripts.format).toBe('node ./scripts/format-changed.mjs --write');
    expect(packageJson.scripts['format:check']).toBe('node ./scripts/format-changed.mjs --check');
    expect(packageJson.devDependencies.prettier).toBeTruthy();
    expect(packageJson.dependencies.prettier).toBeUndefined();
    expect(formatterScript).toContain("readGitPaths(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'])");
    expect(formatterScript).toContain("readGitPaths(['ls-files', '--others', '--exclude-standard'])");
  });
});

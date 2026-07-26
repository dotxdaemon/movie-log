// ABOUTME: Verifies that repo instructions point at the actual Movie Log workspace paths on Sean's machine.
// ABOUTME: Prevents instruction regressions that send tools or humans to a non-existent repo root.
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const agentsPath = join(repoRoot, 'AGENTS.md');
const journalPath = join(repoRoot, 'journal.md');

describe('repo instruction paths', () => {
  it('points at the journal inside the current checkout without a stale absolute root', async () => {
    const agentsSource = await readFile(agentsPath, 'utf8');

    await expect(access(journalPath)).resolves.toBeUndefined();
    expect(agentsSource).toContain('Use `journal.md` as the repo journal.');
    expect(agentsSource).toContain('Write journal entries to `journal.md`.');
    expect(agentsSource).not.toContain('/Users/seankim/code/movie log');
    expect(agentsSource).not.toContain('/Users/seankim/movie log/journal.md');
  });
});

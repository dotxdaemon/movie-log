// ABOUTME: Verifies that repo instructions point at the actual Movie Log workspace paths on Sean's machine.
// ABOUTME: Prevents instruction regressions that send tools or humans to a non-existent repo root.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const agentsPath = join(repoRoot, 'AGENTS.md');
const journalPath = join(repoRoot, 'journal.md');

describe('repo instruction paths', () => {
  it('points instruction-only absolute paths at the actual repo journal', async () => {
    const agentsSource = await readFile(agentsPath, 'utf8');

    expect(agentsSource).toContain(`Use \`${journalPath}\` as the repo journal.`);
    expect(agentsSource).toContain(`Write these entries to \`${journalPath}\`.`);
    expect(agentsSource).not.toContain('/Users/seankim/movie log/journal.md');
  });
});

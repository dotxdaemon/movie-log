// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the approved workspace shell.
// ABOUTME: Prevents future UI work from drifting back toward rejected dashboard or poster variants.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned old-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('ember crown');
    expect(referenceContract).toContain('figure sheet');
    expect(referenceContract).toContain('archive shard');
    expect(referenceContract).toContain('blade field');
    expect(referenceContract).toContain('editorial spine');
    expect(referenceContract).toContain('warm accent family');
    expect(referenceContract).toContain('portrait-stage');
    expect(referenceContract).toContain('focus-sheet');
    expect(referenceContract).toContain('signal-cluster');
    expect(referenceContract).toContain('echo-archive');
    expect(referenceContract).toContain('ceiling-lattice');
  });
});

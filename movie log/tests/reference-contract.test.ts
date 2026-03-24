// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the approved workspace shell.
// ABOUTME: Prevents future UI work from drifting back toward rejected dashboard or poster variants.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned old-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('control rail');
    expect(referenceContract).toContain('signal canopy');
    expect(referenceContract).toContain('ledger');
    expect(referenceContract).toContain('archive inspector');
    expect(referenceContract).toContain('warm accent family');
    expect(referenceContract).toContain('control-slab');
    expect(referenceContract).toContain('poster-stage');
    expect(referenceContract).toContain('view-switcher');
  });
});

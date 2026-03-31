// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the approved workspace shell.
// ABOUTME: Prevents future UI work from drifting back toward rejected dashboard or poster variants.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned old-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('subject-led poster');
    expect(referenceContract).toContain('clear focal hierarchy');
    expect(referenceContract).toContain('poster column');
    expect(referenceContract).toContain('fractured crown');
    expect(referenceContract).toContain('anatomical figure readability');
    expect(referenceContract).toContain('figure headpiece');
    expect(referenceContract).toContain('figure torso');
    expect(referenceContract).toContain('figure sleeves');
    expect(referenceContract).toContain('figure waist');
    expect(referenceContract).toContain('route talisman');
    expect(referenceContract).toContain('archive satchel');
    expect(referenceContract).toContain('asymmetry and tension');
    expect(referenceContract).toContain('internal texture and debris');
    expect(referenceContract).toContain('specific pale forms');
    expect(referenceContract).toContain('violent crown detail');
    expect(referenceContract).toContain('subordinate editorial marks');
    expect(referenceContract).toContain('illustration-first surface');
    expect(referenceContract).toContain('figure-body');
    expect(referenceContract).toContain('figure-halo');
    expect(referenceContract).toContain('figure-sheet');
    expect(referenceContract).toContain('archive-shard');
    expect(referenceContract).toContain('route-rig');
    expect(referenceContract).toContain('battle-layout');
    expect(referenceContract).toContain('route-stack');
  });
});

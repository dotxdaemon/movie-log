// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the approved workspace shell.
// ABOUTME: Prevents future UI work from drifting back toward rejected dashboard or poster variants.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned old-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('monochrome field');
    expect(referenceContract).toContain('minimal stage');
    expect(referenceContract).toContain('history-first main surface');
    expect(referenceContract).toContain('simple archive panel');
    expect(referenceContract).toContain('simple routes rail');
    expect(referenceContract).toContain('flat chrome');
    expect(referenceContract).toContain('restrained copy');
    expect(referenceContract).toContain('readable real content');
    expect(referenceContract).toContain('responsive stack');
    expect(referenceContract).toContain('grayscale controls');
    expect(referenceContract).toContain('poster-stage');
    expect(referenceContract).toContain('crown-fracture');
    expect(referenceContract).toContain('editorial-spine');
    expect(referenceContract).toContain('figure-headpiece');
    expect(referenceContract).toContain('figure-sleeve-left');
    expect(referenceContract).toContain('figure-sleeve-right');
    expect(referenceContract).toContain('figure-waist');
    expect(referenceContract).toContain('satchel-strap');
    expect(referenceContract).toContain('talisman-strap');
  });
});

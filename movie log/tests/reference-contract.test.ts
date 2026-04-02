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
    expect(referenceContract).toContain('dominant history surface');
    expect(referenceContract).toContain('embedded routes utility block');
    expect(referenceContract).toContain('collapsed archive detail block');
    expect(referenceContract).toContain('compact header band');
    expect(referenceContract).toContain('reduced row hierarchy');
    expect(referenceContract).toContain('flat control family');
    expect(referenceContract).toContain('unified contrast system');
    expect(referenceContract).toContain('flat chrome');
    expect(referenceContract).toContain('restrained copy');
    expect(referenceContract).toContain('readable real content');
    expect(referenceContract).toContain('responsive stack');
    expect(referenceContract).toContain('secondary plumbing');
    expect(referenceContract).toContain('three-pane first-screen layout');
    expect(referenceContract).toContain('separate right archive sidebar');
    expect(referenceContract).toContain('standalone left routes column');
    expect(referenceContract).toContain('permanent archive list as a peer content column');
    expect(referenceContract).toContain('peer inspector modes for internal file plumbing');
    expect(referenceContract).toContain('Ledger');
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

// ABOUTME: Verifies that Movie Log keeps one explicit contract for the character-sheet dossier workspace.
// ABOUTME: Separates required markers from banned traits so visual drift cannot pass by wording alone.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the character-sheet dossier markers separately from the rejected tailored-ledger shell', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');
    const requiredMarkers = referenceContract.split('## Required Markers')[1]?.split('## Disallowed Markers')[0] ?? '';
    const disallowedMarkers = referenceContract.split('## Disallowed Markers')[1] ?? '';

    expect(referenceContract).toContain('/Users/seankim/Desktop/Screenshot 2026-07-12 at 4.37.01');
    expect(requiredMarkers).toContain('70 to 80 percent pale field');
    expect(requiredMarkers).toContain('icy lavender');
    expect(requiredMarkers).toContain('graphite structural spine');
    expect(requiredMarkers).toContain('rare burgundy seam');
    expect(requiredMarkers).toContain('poster-led Library focal body');
    expect(requiredMarkers).toContain('asymmetrical annotation studies');
    expect(requiredMarkers).toContain('exposed seam lines');
    expect(requiredMarkers).toContain('narrow silhouettes');
    expect(requiredMarkers).toContain('disciplined negative space');
    expect(requiredMarkers).toContain('working-surface-first mapping');
    expect(requiredMarkers).toContain('original interface');
    expect(requiredMarkers).toContain('does not copy the character');
    expect(requiredMarkers).not.toContain('warm porcelain');
    expect(requiredMarkers).not.toContain('lamp accent');
    expect(requiredMarkers).not.toContain('tailored-room');

    expect(disallowedMarkers).toContain('warm porcelain');
    expect(disallowedMarkers).toContain('lamp accent');
    expect(disallowedMarkers).toContain('tailored-room');
    expect(disallowedMarkers).toContain('pill-shaped controls');
    expect(disallowedMarkers).toContain('dashboard cards');
    expect(disallowedMarkers).toContain('rail + slab + inspector');
  });
});

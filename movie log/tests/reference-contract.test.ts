// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the tailored ledger workspace.
// ABOUTME: Prevents future UI work from drifting back toward rejected utility shells or unrelated cover systems.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned utility-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('quiet gray field');
    expect(referenceContract).toContain('tailored black workspace');
    expect(referenceContract).toContain('integrated command bar');
    expect(referenceContract).toContain('single ledger surface');
    expect(referenceContract).toContain('row action menu');
    expect(referenceContract).toContain('material edge glints');
    expect(referenceContract).toContain('compact masthead');
    expect(referenceContract).toContain('minimal first viewport');
    expect(referenceContract).toContain('quiet utility controls');
    expect(referenceContract).toContain('readable arrivals list');
    expect(referenceContract).toContain('responsive stack');
    expect(referenceContract).toContain('tailored-stage');
    expect(referenceContract).toContain('workspace-head');
    expect(referenceContract).toContain('entry-count');
    expect(referenceContract).toContain('command-bar');
    expect(referenceContract).toContain('ledger-surface');
    expect(referenceContract).toContain('coat-field');
    expect(referenceContract).toContain('coat-wing');
    expect(referenceContract).toContain('random prisms');
    expect(referenceContract).toContain('route-tools');
    expect(referenceContract).toContain('olive room field');
    expect(referenceContract).toContain('acid-red masthead');
    expect(referenceContract).toContain('framed wall gallery');
    expect(referenceContract).toContain('botanical edge');
    expect(referenceContract).toContain('history-layout');
    expect(referenceContract).toContain('history-panel');
    expect(referenceContract).toContain('routes-block');
    expect(referenceContract).toContain('equal split utility grid');
    expect(referenceContract).toContain('always-visible row action column');
  });
});

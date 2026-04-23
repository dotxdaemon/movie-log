// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the couture ledger workspace.
// ABOUTME: Prevents future UI work from drifting back toward rejected utility shells or unrelated cover systems.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned utility-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('mist paper field');
    expect(referenceContract).toContain('tailored black coat');
    expect(referenceContract).toContain('integrated command strip');
    expect(referenceContract).toContain('translucent coat planes');
    expect(referenceContract).toContain('prismatic edge glints');
    expect(referenceContract).toContain('quiet masthead');
    expect(referenceContract).toContain('minimal first viewport');
    expect(referenceContract).toContain('quiet utility controls');
    expect(referenceContract).toContain('readable arrivals list');
    expect(referenceContract).toContain('responsive stack');
    expect(referenceContract).toContain('couture-stage');
    expect(referenceContract).toContain('atelier-head');
    expect(referenceContract).toContain('figure-count');
    expect(referenceContract).toContain('coat-field');
    expect(referenceContract).toContain('command-strip');
    expect(referenceContract).toContain('coat-panel');
    expect(referenceContract).toContain('route-tools');
    expect(referenceContract).toContain('olive room field');
    expect(referenceContract).toContain('acid-red masthead');
    expect(referenceContract).toContain('framed wall gallery');
    expect(referenceContract).toContain('botanical edge');
    expect(referenceContract).toContain('history-layout');
    expect(referenceContract).toContain('history-panel');
    expect(referenceContract).toContain('routes-block');
    expect(referenceContract).toContain('equal split utility grid');
  });
});

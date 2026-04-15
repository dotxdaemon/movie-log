// ABOUTME: Verifies that Movie Log keeps one explicit reference contract for the approved cover-driven workspace.
// ABOUTME: Prevents future UI work from drifting back toward the rejected monochrome worktable shell.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the required markers and banned old-shell traits for the current workspace', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');

    expect(referenceContract).toContain('olive room field');
    expect(referenceContract).toContain('acid-red masthead');
    expect(referenceContract).toContain('oversized issue mark');
    expect(referenceContract).toContain('framed wall gallery');
    expect(referenceContract).toContain('diagonal light');
    expect(referenceContract).toContain('pale focal seat');
    expect(referenceContract).toContain('botanical edge');
    expect(referenceContract).toContain('poster-led first viewport');
    expect(referenceContract).toContain('quiet utility controls');
    expect(referenceContract).toContain('readable arrivals list');
    expect(referenceContract).toContain('responsive stack');
    expect(referenceContract).toContain('poster-stage');
    expect(referenceContract).toContain('masthead-banner');
    expect(referenceContract).toContain('issue-mark');
    expect(referenceContract).toContain('sunbeam-field');
    expect(referenceContract).toContain('wall-gallery');
    expect(referenceContract).toContain('routes-frame');
    expect(referenceContract).toContain('focal-seat');
    expect(referenceContract).toContain('monochrome field');
    expect(referenceContract).toContain('minimal stage');
    expect(referenceContract).toContain('flat chrome');
    expect(referenceContract).toContain('history-layout');
    expect(referenceContract).toContain('history-panel');
    expect(referenceContract).toContain('routes-block');
    expect(referenceContract).toContain('equal split utility grid');
  });
});

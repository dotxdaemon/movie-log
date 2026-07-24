// ABOUTME: Locks the primary character-sheet evidence to a durable repository asset.
// ABOUTME: Prevents visual-fidelity claims from depending on a missing Desktop screenshot again.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const reference = readFileSync(new URL('../docs/reference/movie-log-character-sheet.png', import.meta.url));
const workspaceReference = readFileSync(new URL('../docs/workspace-reference.md', import.meta.url), 'utf8');

describe('workspace visual reference', () => {
  it('preserves the exact primary character sheet and its evidence record', () => {
    const hash = createHash('sha256').update(reference).digest('hex');

    expect(hash).toBe('527248ec84e9dc7baf4d3495138adf2e7b4da2bc5a6ce37496f83c6d47b4e422');
    expect(workspaceReference).toContain('docs/reference/movie-log-character-sheet.png');
    expect(workspaceReference).toContain('388×527 PNG');
  });
});

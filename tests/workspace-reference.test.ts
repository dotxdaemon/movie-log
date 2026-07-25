// ABOUTME: Locks the supplied pastel fashion image to a durable repository asset.
// ABOUTME: Prevents visual-fidelity claims from depending on an unavailable conversation attachment.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const reference = readFileSync(new URL('../docs/reference/movie-log-pastel-fashion-grid.png', import.meta.url));
const workspaceReference = readFileSync(new URL('../docs/workspace-reference.md', import.meta.url), 'utf8');

describe('workspace visual reference', () => {
  it('preserves the exact supplied reference and its evidence record', () => {
    const hash = createHash('sha256').update(reference).digest('hex');

    expect(hash).toBe('3daa458e544ce6f962fa56032d13d5217445b504b1d62754d57a05171724745c');
    expect(workspaceReference).toContain('docs/reference/movie-log-pastel-fashion-grid.png');
    expect(workspaceReference).toContain('1542×2048 PNG');
  });
});

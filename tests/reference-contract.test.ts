// ABOUTME: Verifies that Movie Log keeps one explicit contract for the supplied pastel fashion reference.
// ABOUTME: Separates required product traits from guardrails so visual drift cannot pass by vague wording.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const referenceContractPath = fileURLToPath(new URL('../docs/workspace-reference.md', import.meta.url));

describe('workspace reference contract', () => {
  it('records the supplied image evidence and the translated interface language', async () => {
    const referenceContract = await readFile(referenceContractPath, 'utf8');
    const requiredMarkers = referenceContract.split('## Required Markers')[1]?.split('## Surface Map')[0] ?? '';
    const guardrails = referenceContract.split('## Guardrails')[1] ?? '';

    expect(referenceContract).toContain('docs/reference/movie-log-pastel-fashion-grid.png');
    expect(referenceContract).toContain('1542×2048 PNG');
    expect(referenceContract).toContain('3daa458e544ce6f962fa56032d13d5217445b504b1d62754d57a05171724745c');
    expect(requiredMarkers).toContain('Soft gray-pink canvas');
    expect(requiredMarkers).toContain('Graphite navigation');
    expect(requiredMarkers).toContain('Coral primary accent');
    expect(requiredMarkers).toContain('powder-blue secondary accent');
    expect(requiredMarkers).toContain('Rounded optical geometry');
    expect(requiredMarkers).toContain('Repeated content rows and cards kept blur-free');
    expect(requiredMarkers).toContain('Strong keyboard focus');
    expect(requiredMarkers).toContain('900 pixels');
    expect(requiredMarkers).toContain('1024 pixels');
    expect(guardrails).toContain('No fake routes');
    expect(guardrails).toContain('No copied character artwork');
    expect(guardrails).toContain('No repeated backdrop blur');
    expect(guardrails).toContain('No hover motion');
    expect(guardrails).toContain('No text below twelve pixels');
    expect(guardrails).toContain('No screenshot selector breakpoint');
  });
});

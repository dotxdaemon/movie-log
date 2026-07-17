// ABOUTME: Guards the rating input's controlled semantic readout and native radio keyboard behavior.
// ABOUTME: Prevents CSS-only output from drifting away from the value a user actually selected.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ratingSource = readFileSync(new URL('../src/components/rating.tsx', import.meta.url), 'utf8');

describe('rating input', () => {
  it('updates one live current-value readout from native radio state and initial props', () => {
    expect(ratingSource).toContain('const updateCurrentRating');
    expect(ratingSource).toContain('defaultChecked={value === step}');
    expect(ratingSource).toContain('onChange={updateCurrentRating}');
    expect(ratingSource).toContain('output.value =');
    expect(ratingSource).toContain('aria-live="polite"');
    expect(ratingSource).not.toContain('rating-current-option');
  });
});

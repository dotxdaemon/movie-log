// ABOUTME: Verifies responsive poster URLs and the low-resolution fallback boundary.
// ABOUTME: Keeps cards crisp without changing the catalog identity or poster aspect ratio.
import { describe, expect, it } from 'vitest';
import { buildPosterSourceSet, hasSufficientPosterResolution, readPosterSizes } from '../src/poster-image.js';

describe('poster image sources', () => {
  it('keeps Wikimedia originals measurable instead of requesting CDN upscales', () => {
    const sourceSet = buildPosterSourceSet('https://upload.wikimedia.org/wikipedia/en/3/37/Theringpostere.jpg', 'card');

    expect(sourceSet).toBeUndefined();
    expect(readPosterSizes('card')).toBe(
      '(max-width: 520px) 45vw, (max-width: 700px) 30vw, (max-width: 900px) 26vw, (max-width: 1179px) 220px, 190px'
    );
  });

  it('builds responsive IMDb image variants without changing the title identity', () => {
    const sourceSet = buildPosterSourceSet('https://m.media-amazon.com/images/M/MV5Babc@._V1_.jpg', 'dossier');

    expect(sourceSet).toContain('MV5Babc@._V1_SX330.jpg 330w');
    expect(sourceSet).toContain('MV5Babc@._V1_SX960.jpg 960w');
    expect(readPosterSizes('dossier')).toContain('400px');
  });

  it('uses the plate when a non-responsive poster cannot cover the rendered density', () => {
    expect(
      hasSufficientPosterResolution({
        devicePixelRatio: 2,
        naturalWidth: 320,
        renderedWidth: 200,
        responsive: false
      })
    ).toBe(false);
    expect(
      hasSufficientPosterResolution({
        devicePixelRatio: 2,
        naturalWidth: 200,
        renderedWidth: 200,
        responsive: true
      })
    ).toBe(true);
  });
});

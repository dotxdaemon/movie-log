// ABOUTME: Verifies truncated help can be revealed and associated without a mouse.
// ABOUTME: Keeps native title-only hints out of keyboard-critical Movie Log controls.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccessibleTooltip } from '../src/components/accessible-tooltip.js';

describe('accessible tooltip', () => {
  it('associates a keyboard-focusable trigger with a real tooltip', () => {
    const markup = renderToStaticMarkup(
      createElement(AccessibleTooltip, {
        children: createElement('span', { tabIndex: 0 }, 'A very long movie path.mkv'),
        id: 'long-path-help',
        text: '/Volumes/Archive/A very long movie path.mkv'
      })
    );
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(describedBy).toBe('long-path-help');
    expect(markup).toContain('id="long-path-help"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('/Volumes/Archive/A very long movie path.mkv');
  });
});

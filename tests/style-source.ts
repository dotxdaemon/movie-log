// ABOUTME: Reads every ordered CSS ownership file behind the Movie Log stylesheet manifest.
// ABOUTME: Lets style regressions keep inspecting the complete cascade after the monolith was split.
import { readFileSync } from 'node:fs';

const styleUrls = [
  new URL('../src/styles/foundation.css', import.meta.url),
  new URL('../src/styles/components.css', import.meta.url),
  new URL('../src/styles/responsive-foundation.css', import.meta.url),
  new URL('../src/styles/view-refinements.css', import.meta.url),
  new URL('../src/styles/motion.css', import.meta.url),
  new URL('../src/styles/responsive.css', import.meta.url)
];

export function readStyles(): string {
  return styleUrls.map((url) => readFileSync(url, 'utf8')).join('\n');
}

// ABOUTME: Verifies generated Electron output is cleaned and contains no source-less modules before packaging.
// ABOUTME: Pins the stale scan-interval artifact failure at both script and filesystem boundaries.
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findUnreferencedGeneratedModules } from '../scripts/generated-output.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('generated output hygiene', () => {
  it('detects a generated module that has no matching source module', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'movie-log-generated-'));
    temporaryDirectories.push(directory);
    const sourceDirectory = join(directory, 'electron');
    const outputDirectory = join(directory, 'dist-electron', 'electron');
    await mkdir(sourceDirectory, { recursive: true });
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(sourceDirectory, 'main.ts'), 'export {};\n');
    await writeFile(join(outputDirectory, 'main.js'), 'export {};\n');
    await writeFile(join(outputDirectory, 'scan-interval.js'), 'export {};\n');

    await expect(findUnreferencedGeneratedModules(sourceDirectory, outputDirectory)).resolves.toEqual([
      'scan-interval.js'
    ]);
  });

  it('cleans generated trees before build and audits them before packaging', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const packageScript = await readFile(new URL('../scripts/package-mac.mjs', import.meta.url), 'utf8');

    expect(packageJson.scripts.clean).toBe('node ./scripts/clean.mjs');
    expect(packageJson.scripts.build).toMatch(/^npm run clean && /);
    expect(packageScript).toContain('assertGeneratedOutput');
  });
});

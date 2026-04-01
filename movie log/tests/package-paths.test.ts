// ABOUTME: Verifies that packaging finds the Electron app template without requiring a nested node_modules symlink.
// ABOUTME: Uses real temporary directories so the packaging path resolution stays aligned with the repo layout.
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { resolveElectronAppTemplatePath } = require('../scripts/package-paths.mjs') as {
  resolveElectronAppTemplatePath(projectDirectory: string): Promise<string>;
};

const temporaryDirectories: string[] = [];

async function createTemporaryProjectDirectory(): Promise<string> {
  const workspaceDirectory = await mkdtemp(join(tmpdir(), 'movie-log-package-paths-'));
  temporaryDirectories.push(workspaceDirectory);
  const projectDirectory = join(workspaceDirectory, 'movie log');
  await mkdir(projectDirectory, { recursive: true });
  return projectDirectory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('resolveElectronAppTemplatePath', () => {
  it('falls back to the workspace root electron app template when the nested project has no local electron install', async () => {
    const projectDirectory = await createTemporaryProjectDirectory();
    const workspaceDirectory = dirname(projectDirectory);
    const rootElectronTemplatePath = join(workspaceDirectory, 'node_modules', 'electron', 'dist', 'Electron.app');

    await mkdir(rootElectronTemplatePath, { recursive: true });

    await expect(resolveElectronAppTemplatePath(projectDirectory)).resolves.toBe(rootElectronTemplatePath);
  });

  it('prefers the nested project electron app template when it exists', async () => {
    const projectDirectory = await createTemporaryProjectDirectory();
    const workspaceDirectory = dirname(projectDirectory);
    const rootElectronTemplatePath = join(workspaceDirectory, 'node_modules', 'electron', 'dist', 'Electron.app');
    const nestedElectronTemplatePath = join(projectDirectory, 'node_modules', 'electron', 'dist', 'Electron.app');

    await mkdir(rootElectronTemplatePath, { recursive: true });
    await mkdir(nestedElectronTemplatePath, { recursive: true });

    await expect(resolveElectronAppTemplatePath(projectDirectory)).resolves.toBe(nestedElectronTemplatePath);
  });

  it('throws a clear error when it cannot find any electron app template', async () => {
    const projectDirectory = await createTemporaryProjectDirectory();

    await expect(resolveElectronAppTemplatePath(projectDirectory)).rejects.toThrow(
      `Could not find Electron.app from ${projectDirectory}`
    );
  });
});

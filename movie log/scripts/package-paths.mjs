// ABOUTME: Resolves filesystem paths that the packaging scripts need across the nested project and workspace root.
// ABOUTME: Finds the nearest installed Electron app template so packaging works without local symlink workarounds.
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveElectronAppTemplatePath(projectDirectory) {
  let currentDirectory = projectDirectory;

  while (true) {
    const electronAppTemplatePath = join(currentDirectory, 'node_modules', 'electron', 'dist', 'Electron.app');

    if (await pathExists(electronAppTemplatePath)) {
      return electronAppTemplatePath;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      throw new Error(`Could not find Electron.app from ${projectDirectory}`);
    }

    currentDirectory = parentDirectory;
  }
}

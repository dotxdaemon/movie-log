// ABOUTME: Resolves filesystem paths that the packaging scripts need across the nested project, workspace root, and installed app.
// ABOUTME: Finds the nearest installed Electron app template and the canonical Movie Log app bundle locations.
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const appName = 'Movie Log';

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveInstalledAppPath() {
  return join('/Applications', `${appName}.app`);
}

export function resolveReleaseAppPath(projectDirectory) {
  return join(projectDirectory, 'release', 'mac', `${appName}.app`);
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

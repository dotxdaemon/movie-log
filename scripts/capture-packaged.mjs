// ABOUTME: Launches the packaged macOS Movie Log app and captures a proof screenshot from the normal local Movie Log data.
// ABOUTME: Verifies the installed /Applications Movie Log app bundle works without the Vite dev server or source Electron entrypoint.
import { rm, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { resolveInstalledAppPath } from './package-paths.mjs';

const capturePath = process.env.MOVIE_LOG_CAPTURE_PATH ?? join(homedir(), '.codex-artifacts', 'movie-log-packaged.png');
const captureWidth = process.env.MOVIE_LOG_CAPTURE_WIDTH ?? '1180';
const captureHeight = process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? '788';
const packagedAppPath = join(resolveInstalledAppPath(), 'Contents', 'MacOS', 'Electron');
const packagedAppProcessPattern = `${resolveInstalledAppPath()}/Contents/MacOS/Electron`;
const captureStartedAt = Date.now();

spawnSync('pkill', ['-f', packagedAppProcessPattern], {
  stdio: 'ignore'
});

await rm(capturePath, { force: true });

await new Promise((resolve, reject) => {
  const packagedApp = spawn(packagedAppPath, [], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      MOVIE_LOG_CAPTURE_HEIGHT: captureHeight,
      MOVIE_LOG_CAPTURE_PATH: capturePath,
      MOVIE_LOG_CAPTURE_WIDTH: captureWidth
    }
  });

  packagedApp.once('exit', (code) => {
    if (code === 0) {
      resolve(undefined);
      return;
    }

    reject(new Error(`Packaged app capture exited with code ${code ?? 'null'}`));
  });

  packagedApp.once('error', reject);
});

const captureStats = await stat(capturePath);

if (captureStats.mtimeMs < captureStartedAt) {
  throw new Error(`Packaged app capture did not write a fresh screenshot: ${capturePath}`);
}

process.stdout.write(`${capturePath}\n`);

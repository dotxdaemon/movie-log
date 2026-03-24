// ABOUTME: Launches the packaged macOS Movie Log app and captures a proof screenshot from the normal local Movie Log data.
// ABOUTME: Verifies the installed-style app bundle works without the Vite dev server or source Electron entrypoint.
import { rm, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const capturePath = join(homedir(), '.codex-artifacts', 'movie-log-packaged.png');
const packagedAppPath = join(process.cwd(), 'release', 'mac', 'Movie Log.app', 'Contents', 'MacOS', 'Electron');
const captureStartedAt = Date.now();

spawnSync('pkill', ['-f', packagedAppPath], {
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
      MOVIE_LOG_CAPTURE_PATH: capturePath
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

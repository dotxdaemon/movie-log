// ABOUTME: Launches the packaged macOS Movie Log app and captures a proof screenshot from the normal local Movie Log data.
// ABOUTME: Verifies the installed-style app bundle works without the Vite dev server or source Electron entrypoint.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const capturePath = join(homedir(), '.codex-artifacts', 'movie-log-packaged.png');
const packagedAppPath = join(process.cwd(), 'release', 'mac', 'Movie Log.app', 'Contents', 'MacOS', 'Electron');

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

process.stdout.write(`${capturePath}\n`);

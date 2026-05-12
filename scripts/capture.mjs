// ABOUTME: Launches the Electron app and captures a proof screenshot from the normal local Movie Log data.
// ABOUTME: Uses the same dev-time renderer flow as the desktop app so the artifact matches the real app state.
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const capturePath = join(homedir(), '.codex-artifacts', 'movie-log-desktop.png');
const devServerUrl = 'http://127.0.0.1:4173';

function spawnChild(command, args, extraEnv = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...extraEnv }
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const viteServer = spawnChild('npm', ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort']);

try {
  await waitForServer(devServerUrl);
  await mkdir(dirname(capturePath), { recursive: true });

  await new Promise((resolve, reject) => {
    const electron = spawnChild('npm', ['exec', 'electron', '--', 'electron/main.ts'], {
      MOVIE_LOG_CAPTURE_PATH: capturePath,
      NODE_OPTIONS: '--import tsx',
      VITE_DEV_SERVER_URL: devServerUrl
    });

    electron.once('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`Electron capture exited with code ${code ?? 'null'}`));
    });

    electron.once('error', reject);
  });

  process.stdout.write(`${capturePath}\n`);
} finally {
  viteServer.kill('SIGTERM');
}

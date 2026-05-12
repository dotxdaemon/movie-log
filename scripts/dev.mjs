// ABOUTME: Starts the Vite renderer and Electron shell together for local desktop development.
// ABOUTME: Waits for the renderer port before launching Electron so the app window loads cleanly.
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const children = [];
const devServerUrl = 'http://127.0.0.1:5173';

function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...extraEnv }
  });

  children.push(child);
  return child;
}

async function waitForPort(url) {
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

function stopChildren() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(143);
});

spawnChild('npm', ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '5173']);

await waitForPort(devServerUrl);

const electron = spawnChild('npm', ['exec', 'electron', '--', 'electron/main.ts'], {
  NODE_OPTIONS: '--import tsx',
  VITE_DEV_SERVER_URL: devServerUrl
});

electron.on('exit', (code) => {
  stopChildren();
  process.exit(code ?? 0);
});

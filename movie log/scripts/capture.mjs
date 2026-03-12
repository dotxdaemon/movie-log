// ABOUTME: Launches the Electron app with seeded local data and captures a proof screenshot.
// ABOUTME: Uses the same dev-time renderer flow as the desktop app so the artifact matches the running UI.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const capturePath = join(homedir(), '.codex-artifacts', 'movie-log-desktop.png');
const devServerUrl = 'http://127.0.0.1:4173';
const temporaryDataDirectory = await mkdtemp(join(tmpdir(), 'movie-log-capture-'));

const seededState = {
  history: [
    {
      id: '2026-03-12T09:00:00.000Z:/Users/seankim/Media Inbox/Severance',
      source: 'drop',
      sourceKind: 'directory',
      sourcePath: '/Users/seankim/Media Inbox/Severance',
      title: 'Severance',
      watchedAt: '2026-03-12T09:00:00.000Z'
    },
    {
      id: '2026-03-12T08:15:00.000Z:/Users/seankim/Media Inbox/The Brutalist.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Users/seankim/Media Inbox/The Brutalist.mkv',
      title: 'The Brutalist',
      watchedAt: '2026-03-12T08:15:00.000Z'
    }
  ],
  knownPathsByFolder: {
    '/Users/seankim/Media Inbox': ['/Users/seankim/Media Inbox/The Brutalist.mkv']
  },
  watchedFolders: [
    {
      id: '/Users/seankim/Media Inbox',
      addedAt: '2026-03-12T07:45:00.000Z',
      name: 'Media Inbox',
      path: '/Users/seankim/Media Inbox'
    }
  ]
};

await mkdir(temporaryDataDirectory, { recursive: true });
await writeFile(join(temporaryDataDirectory, 'movie-log.json'), `${JSON.stringify(seededState, null, 2)}\n`, 'utf8');

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
      MOVIE_LOG_DATA_DIR: temporaryDataDirectory,
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
  await rm(temporaryDataDirectory, { recursive: true, force: true });
}

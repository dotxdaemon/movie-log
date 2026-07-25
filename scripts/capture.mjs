// ABOUTME: Launches the Electron app and captures a proof screenshot from the normal local Movie Log data.
// ABOUTME: Uses the same dev-time renderer flow as the desktop app so the artifact matches the real app state.
import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  assertAbsolutePathOutsideApplicationSupport,
  captureSnapshotMarkerName,
  createRealCaptureSnapshot,
  readProductionApplicationSupportDirectory,
  readProductionDataDirectory
} from './capture-data-safety.mjs';

const productionApplicationSupportDirectory = readProductionApplicationSupportDirectory();
const productionDataDirectory = readProductionDataDirectory();
const capturePath = await assertAbsolutePathOutsideApplicationSupport(
  join(homedir(), '.codex-artifacts', 'movie-log-desktop.png'),
  productionApplicationSupportDirectory,
  'Capture output path'
);
const persistenceProofPath =
  process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH === undefined
    ? undefined
    : await assertAbsolutePathOutsideApplicationSupport(
        process.env.MOVIE_LOG_PERSISTENCE_PROOF_PATH,
        productionApplicationSupportDirectory,
        'Persistence proof output path'
      );
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

const snapshot = await createRealCaptureSnapshot(productionDataDirectory);
const viteServer = spawnChild('npm', ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort']);

try {
  await waitForServer(devServerUrl);
  await mkdir(dirname(capturePath), { recursive: true });

  await new Promise((resolve, reject) => {
    const electron = spawnChild('npm', ['exec', 'electron', '--', 'electron/main.ts'], {
      [captureSnapshotMarkerName]: snapshot.dataDirectory,
      MOVIE_LOG_CAPTURE_DATA_MODE: 'real',
      MOVIE_LOG_CAPTURE_PATH: capturePath,
      MOVIE_LOG_CAPTURE_STARTED_AT: String(Date.now()),
      MOVIE_LOG_DATA_DIR: snapshot.dataDirectory,
      ...(persistenceProofPath === undefined ? {} : { MOVIE_LOG_PERSISTENCE_PROOF_PATH: persistenceProofPath }),
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
  await rm(snapshot.rootDirectory, { force: true, recursive: true });
}

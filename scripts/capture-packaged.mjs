// ABOUTME: Launches the installed macOS Movie Log app and fails closed on stale, hung, or malformed proof captures.
// ABOUTME: Enforces an overall timeout, process-tree cleanup, stage logging, freshness, and exact PNG dimensions.
import { readFile, rm, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { resolveInstalledAppPath } from './package-paths.mjs';

const capturePath = process.env.MOVIE_LOG_CAPTURE_PATH ?? join(homedir(), '.codex-artifacts', 'movie-log-packaged.png');
const captureWidth = Number(process.env.MOVIE_LOG_CAPTURE_WIDTH ?? '1180');
const captureHeight = Number(process.env.MOVIE_LOG_CAPTURE_HEIGHT ?? '788');
const overallTimeoutMs = Number(process.env.MOVIE_LOG_CAPTURE_TIMEOUT_MS ?? '45000');
const installedAppPath = resolveInstalledAppPath();
const packagedAppPath = join(installedAppPath, 'Contents', 'MacOS', 'Electron');
const packagedAppProcessPattern = `${installedAppPath}/Contents/MacOS/Electron`;
const captureStartedAt = Date.now();
const captureDataMode = process.env.MOVIE_LOG_CAPTURE_DATA_MODE ?? 'real';

function logStage(stage) {
  process.stdout.write(`capture stage: ${stage}\n`);
}

function terminateProcessTree(child) {
  if (!child.pid) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  spawnSync('pkill', ['-TERM', '-P', String(child.pid)], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', packagedAppProcessPattern], { stdio: 'ignore' });
}

function readPngDimensions(buffer) {
  const pngSignature = '89504e470d0a1a0a';

  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`Packaged app capture is not a valid PNG: ${capturePath}`);
  }

  return { height: buffer.readUInt32BE(20), width: buffer.readUInt32BE(16) };
}

if (!Number.isInteger(overallTimeoutMs) || overallTimeoutMs < 1000) {
  throw new Error(`Capture timeout must be a whole number of at least 1000ms. Received ${overallTimeoutMs}.`);
}

if (!['real', 'scratch'].includes(captureDataMode)) {
  throw new Error(`Capture data mode must be real or scratch. Received ${captureDataMode}.`);
}

logStage(`data-${captureDataMode}`);
logStage('stop-resident-app');
spawnSync('pkill', ['-f', packagedAppProcessPattern], { stdio: 'ignore' });

logStage('remove-stale-file');
await rm(capturePath, { force: true });

logStage('launch-installed-app');
const packagedApp = spawn(packagedAppPath, [], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    MOVIE_LOG_CAPTURE_HEIGHT: String(captureHeight),
    MOVIE_LOG_CAPTURE_PATH: capturePath,
    MOVIE_LOG_CAPTURE_WIDTH: String(captureWidth)
  }
});

await new Promise((resolve, reject) => {
  let settled = false;
  let timeout;
  const finish = (error) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeout);

    if (error) {
      terminateProcessTree(packagedApp);
      reject(error);
    } else {
      resolve(undefined);
    }
  };
  timeout = setTimeout(() => {
    finish(new Error(`Packaged app capture timed out after ${overallTimeoutMs}ms.`));
  }, overallTimeoutMs);

  packagedApp.once('exit', (code) => {
    if (code === 0) {
      finish();
      return;
    }

    finish(new Error(`Packaged app capture exited with code ${code ?? 'null'}.`));
  });
  packagedApp.once('error', finish);
});

logStage('verify-fresh-file');
const captureStats = await stat(capturePath);

if (captureStats.mtimeMs < captureStartedAt || captureStats.size < 24) {
  throw new Error(`Packaged app capture did not write a fresh screenshot: ${capturePath}`);
}

logStage('verify-png-dimensions');
const dimensions = readPngDimensions(await readFile(capturePath));

if (dimensions.width !== captureWidth || dimensions.height !== captureHeight) {
  throw new Error(
    `Packaged app capture dimensions ${dimensions.width}x${dimensions.height} did not match ${captureWidth}x${captureHeight}.`
  );
}

logStage('complete');
process.stdout.write(`${capturePath}\n`);

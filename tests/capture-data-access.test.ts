// ABOUTME: Locks installed capture runs to explicit data modes and a real-data write barrier.
// ABOUTME: Prevents visual acceptance tooling from changing the production diary or metadata cache.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertCaptureWritable, resolveCaptureDataMode } from '../electron/capture.js';
import {
  assertAbsolutePathOutsideApplicationSupport as assertRuntimeArtifactPath,
  canonicalizeCapturePath as canonicalizeRuntimePath,
  isSamePathOrDescendant as isRuntimePathInside,
  validateCaptureRuntimePaths
} from '../electron/capture-data-safety.js';
import {
  assertAbsolutePathOutsideApplicationSupport as assertScriptArtifactPath,
  createRealCaptureSnapshot,
  isSamePathOrDescendant as isScriptPathInside
} from '../scripts/capture-data-safety.mjs';

const ipcSource = readFileSync(new URL('../electron/ipc-handlers.ts', import.meta.url), 'utf8');
const mainWindowSource = readFileSync(new URL('../electron/main-window.ts', import.meta.url), 'utf8');

describe('installed capture data access', () => {
  it('requires an explicit real or scratch mode whenever capture automation is active', () => {
    expect(resolveCaptureDataMode(false, undefined)).toBeNull();
    expect(resolveCaptureDataMode(true, 'real')).toBe('real');
    expect(resolveCaptureDataMode(true, 'scratch')).toBe('scratch');
    expect(() => resolveCaptureDataMode(true, undefined)).toThrow(/require.*real or scratch/i);
    expect(() => resolveCaptureDataMode(true, 'production')).toThrow(/require.*real or scratch/i);
  });

  it('makes real-data captures read-only while leaving normal and scratch runs writable', () => {
    expect(() => assertCaptureWritable('real', 'update entry')).toThrow(/scratch.*read-only/i);
    expect(() => assertCaptureWritable('scratch', 'update entry')).not.toThrow();
    expect(() => assertCaptureWritable(null, 'update entry')).not.toThrow();
  });

  it('blocks background enrichment and every mutating IPC family in real-data capture mode', () => {
    expect(mainWindowSource).toContain('if (!capture.isReadOnly)');

    for (const operation of [
      'add watched folders',
      'log paths',
      'log film',
      'match film',
      'update entry',
      'scan watched folders',
      'remove watched folder',
      'retry film enrichment'
    ]) {
      expect(ipcSource).toContain(`capture.assertWritable('${operation}')`);
    }
  });

  it('requires a marked isolated snapshot for real-data captures at runtime', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-runtime-snapshot-'));
    const productionDirectory = join(temporaryDirectory, 'Library', 'Application Support', 'Movie Log');
    const snapshotDirectory = join(temporaryDirectory, 'capture-snapshot');
    const capturePath = join(temporaryDirectory, 'capture.png');
    mkdirSync(productionDirectory, { recursive: true });
    mkdirSync(snapshotDirectory);

    try {
      expect(() =>
        validateCaptureRuntimePaths({
          captureDataMode: 'real',
          capturePath,
          dataDirectory: snapshotDirectory,
          persistenceProofPath: undefined,
          productionApplicationSupportDirectory: productionDirectory,
          snapshotDirectory: undefined
        })
      ).toThrow(/isolated snapshot marker/i);

      expect(() =>
        validateCaptureRuntimePaths({
          captureDataMode: 'real',
          capturePath,
          dataDirectory: snapshotDirectory,
          persistenceProofPath: undefined,
          productionApplicationSupportDirectory: productionDirectory,
          snapshotDirectory: join(temporaryDirectory, 'different-snapshot')
        })
      ).toThrow(/must read the isolated directory/i);

      expect(
        validateCaptureRuntimePaths({
          captureDataMode: 'real',
          capturePath,
          dataDirectory: snapshotDirectory,
          persistenceProofPath: join(temporaryDirectory, 'proof.json'),
          productionApplicationSupportDirectory: productionDirectory,
          snapshotDirectory
        })
      ).toMatchObject({
        capturePath: canonicalizeRuntimePath(capturePath),
        dataDirectory: canonicalizeRuntimePath(snapshotDirectory),
        persistenceProofPath: canonicalizeRuntimePath(join(temporaryDirectory, 'proof.json'))
      });
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('rejects production aliases and artifact outputs before the runtime can write them', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-runtime-paths-'));
    const productionDirectory = join(temporaryDirectory, 'Library', 'Application Support', 'Movie Log');
    const productionDataDirectory = join(productionDirectory, 'movie-log');
    const productionAlias = join(temporaryDirectory, 'production-alias');
    mkdirSync(productionDataDirectory, { recursive: true });
    symlinkSync(productionDirectory, productionAlias);

    try {
      for (const unsafePath of [
        productionDirectory,
        join(productionDataDirectory, 'movie-log.json'),
        `${productionDataDirectory}/missing/..`,
        join(productionAlias, 'movie-log'),
        productionDirectory.toUpperCase()
      ]) {
        expect(isRuntimePathInside(unsafePath, productionDirectory), unsafePath).toBe(true);
        await expect(isScriptPathInside(unsafePath, productionDirectory), unsafePath).resolves.toBe(true);
      }

      expect(() =>
        assertRuntimeArtifactPath(
          join(productionDataDirectory, 'movie-log.json'),
          productionDirectory,
          'Capture output path'
        )
      ).toThrow(/outside Movie Log Application Support/);
      await expect(
        assertScriptArtifactPath(
          join(productionDataDirectory, 'movie-log-note.md'),
          productionDirectory,
          'Persistence proof output path'
        )
      ).rejects.toThrow(/outside Movie Log Application Support/);
      expect(() =>
        validateCaptureRuntimePaths({
          captureDataMode: 'scratch',
          capturePath: join(productionDataDirectory, 'movie-log-films.json'),
          dataDirectory: join(temporaryDirectory, 'scratch'),
          persistenceProofPath: undefined,
          productionApplicationSupportDirectory: productionDirectory,
          snapshotDirectory: undefined
        })
      ).toThrow(/Capture output path/);
      expect(() =>
        validateCaptureRuntimePaths({
          captureDataMode: 'scratch',
          capturePath: join(temporaryDirectory, 'capture.png'),
          dataDirectory: join(temporaryDirectory, 'scratch'),
          persistenceProofPath: join(productionDataDirectory, 'movie-log.json'),
          productionApplicationSupportDirectory: productionDirectory,
          snapshotDirectory: undefined
        })
      ).toThrow(/Persistence proof output path/);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('recognizes the macOS Data-volume firmlink even when the protected host path is absent', async () => {
    const protectedPath = '/Users/movie-log-clean-host/Library/Application Support/Movie Log';
    const dataVolumeAlias = `/System/Volumes/Data${protectedPath}/movie-log`;

    expect(isRuntimePathInside(dataVolumeAlias, protectedPath)).toBe(true);
    await expect(isScriptPathInside(dataVolumeAlias, protectedPath)).resolves.toBe(true);
  });

  it('resolves a dangling symlink to an absent production directory on a clean host', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-clean-host-alias-'));
    const absentProductionDirectory = join(
      temporaryDirectory,
      'missing-home',
      'Library',
      'Application Support',
      'Movie Log'
    );
    const productionAlias = join(temporaryDirectory, 'movie-log-production');
    const aliasedDataDirectory = join(productionAlias, 'movie-log');
    symlinkSync(absentProductionDirectory, productionAlias);

    try {
      expect(isRuntimePathInside(aliasedDataDirectory, absentProductionDirectory)).toBe(true);
      await expect(isScriptPathInside(aliasedDataDirectory, absentProductionDirectory)).resolves.toBe(true);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('copies real data into a disposable snapshot and keeps a clean host clean', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'movie-log-script-snapshot-'));
    const productionDataDirectory = join(temporaryDirectory, 'production', 'movie-log');
    mkdirSync(productionDataDirectory, { recursive: true });
    writeFileSync(join(productionDataDirectory, 'movie-log.json'), '{"history":[1]}\\n');
    writeFileSync(join(productionDataDirectory, 'movie-log-note.md'), '# Movie Log\\n');
    writeFileSync(join(productionDataDirectory, 'movie-log-films.json'), '{"films":{}}\\n');
    const snapshot = await createRealCaptureSnapshot(productionDataDirectory);

    try {
      expect(readFileSync(join(snapshot.dataDirectory, 'movie-log.json'), 'utf8')).toBe('{"history":[1]}\\n');
      writeFileSync(join(snapshot.dataDirectory, 'movie-log.json'), '{"history":[1,2]}\\n');
      expect(readFileSync(join(productionDataDirectory, 'movie-log.json'), 'utf8')).toBe('{"history":[1]}\\n');
    } finally {
      rmSync(snapshot.rootDirectory, { force: true, recursive: true });
    }

    const absentProductionDirectory = join(temporaryDirectory, 'clean-host', 'movie-log');
    const emptySnapshot = await createRealCaptureSnapshot(absentProductionDirectory);

    try {
      expect(existsSync(absentProductionDirectory)).toBe(false);
      expect(existsSync(emptySnapshot.dataDirectory)).toBe(true);
      expect(readFileSync(join(productionDataDirectory, 'movie-log-note.md'), 'utf8')).toBe('# Movie Log\\n');
    } finally {
      rmSync(emptySnapshot.rootDirectory, { force: true, recursive: true });
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

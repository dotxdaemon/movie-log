// ABOUTME: Independently validates capture data and artifact paths inside the Electron runtime.
// ABOUTME: Prevents direct launches from bypassing snapshot markers or writing into production Application Support.
import { lstatSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

export const captureSnapshotMarkerName = 'MOVIE_LOG_CAPTURE_SNAPSHOT_DIR';

type CaptureDataMode = 'real' | 'scratch' | null;

interface CaptureRuntimePathOptions {
  captureDataMode: CaptureDataMode;
  capturePath: string | undefined;
  dataDirectory: string;
  persistenceProofPath: string | undefined;
  productionApplicationSupportDirectory?: string;
  snapshotDirectory: string | undefined;
}

interface CaptureRuntimePaths {
  capturePath: string | null;
  dataDirectory: string;
  persistenceProofPath: string | null;
}

export function readProductionApplicationSupportDirectory(homeDirectory = homedir()): string {
  return join(homeDirectory, 'Library', 'Application Support', 'Movie Log');
}

export function canonicalizeCapturePath(targetPath: string, symlinkDepth = 0): string {
  let existingPath = resolve(targetPath);
  const missingSegments: string[] = [];

  while (true) {
    try {
      return resolve(realpathSync(existingPath), ...missingSegments.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw error;
      }

      try {
        const existingStats = lstatSync(existingPath);

        if (existingStats.isSymbolicLink()) {
          if (symlinkDepth >= 40) {
            throw new Error(`Capture path contains too many symbolic links: ${targetPath}`);
          }

          const linkTarget = readlinkSync(existingPath);
          return canonicalizeCapturePath(
            resolve(dirname(existingPath), linkTarget, ...missingSegments.reverse()),
            symlinkDepth + 1
          );
        }
      } catch (lstatError) {
        const lstatCode = (lstatError as NodeJS.ErrnoException).code;

        if (lstatCode !== 'ENOENT' && lstatCode !== 'ENOTDIR') {
          throw lstatError;
        }
      }

      const parentPath = dirname(existingPath);

      if (parentPath === existingPath) {
        throw error;
      }

      missingSegments.push(basename(existingPath));
      existingPath = parentPath;
    }
  }
}

function normalizeMacDataVolumeAlias(targetPath: string): string {
  const normalizedPath = targetPath.normalize('NFC');
  const dataVolumePrefix = '/System/Volumes/Data';
  const normalizedLowerPath = normalizedPath.toLowerCase();
  const normalizedLowerPrefix = dataVolumePrefix.toLowerCase();

  if (
    normalizedLowerPath === normalizedLowerPrefix ||
    normalizedLowerPath.startsWith(`${normalizedLowerPrefix}${sep}`)
  ) {
    return normalizedPath.slice(dataVolumePrefix.length) || sep;
  }

  return normalizedPath;
}

function normalizePathForComparison(targetPath: string): string {
  return normalizeMacDataVolumeAlias(targetPath).normalize('NFC').toLowerCase();
}

function readIdentity(targetPath: string): string | null {
  try {
    const targetStats = statSync(targetPath);
    return `${targetStats.dev}:${targetStats.ino}`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return null;
    }

    throw error;
  }
}

function hasProtectedAncestor(targetPath: string, protectedPath: string): boolean {
  const protectedIdentity = readIdentity(protectedPath);

  if (!protectedIdentity) {
    return false;
  }

  let currentPath = targetPath;

  while (true) {
    if (readIdentity(currentPath) === protectedIdentity) {
      return true;
    }

    const parentPath = dirname(currentPath);

    if (parentPath === currentPath) {
      return false;
    }

    currentPath = parentPath;
  }
}

export function isSamePathOrDescendant(targetPath: string, parentPath: string): boolean {
  const canonicalTargetPath = canonicalizeCapturePath(targetPath);
  const canonicalParentPath = canonicalizeCapturePath(parentPath);
  const normalizedTargetPath = normalizePathForComparison(canonicalTargetPath);
  const normalizedParentPath = normalizePathForComparison(canonicalParentPath);

  if (
    normalizedTargetPath === normalizedParentPath ||
    normalizedTargetPath.startsWith(`${normalizedParentPath}${sep}`)
  ) {
    return true;
  }

  return hasProtectedAncestor(canonicalTargetPath, canonicalParentPath);
}

function pathsAreEquivalent(leftPath: string, rightPath: string): boolean {
  const canonicalLeftPath = canonicalizeCapturePath(leftPath);
  const canonicalRightPath = canonicalizeCapturePath(rightPath);

  if (normalizePathForComparison(canonicalLeftPath) === normalizePathForComparison(canonicalRightPath)) {
    return true;
  }

  const leftIdentity = readIdentity(canonicalLeftPath);
  return leftIdentity !== null && leftIdentity === readIdentity(canonicalRightPath);
}

export function assertAbsolutePathOutsideApplicationSupport(
  targetPath: string | undefined,
  productionApplicationSupportDirectory: string,
  description: string
): string {
  if (!targetPath || !isAbsolute(targetPath)) {
    throw new Error(`${description} must be an absolute path outside Movie Log Application Support.`);
  }

  const canonicalTargetPath = canonicalizeCapturePath(targetPath);

  if (isSamePathOrDescendant(canonicalTargetPath, productionApplicationSupportDirectory)) {
    throw new Error(`${description} must be an absolute path outside Movie Log Application Support.`);
  }

  return canonicalTargetPath;
}

export function validateCaptureRuntimePaths({
  captureDataMode,
  capturePath,
  dataDirectory,
  persistenceProofPath,
  productionApplicationSupportDirectory = readProductionApplicationSupportDirectory(),
  snapshotDirectory
}: CaptureRuntimePathOptions): CaptureRuntimePaths {
  if (captureDataMode === null) {
    return {
      capturePath: null,
      dataDirectory,
      persistenceProofPath: null
    };
  }

  const safeCapturePath = assertAbsolutePathOutsideApplicationSupport(
    capturePath,
    productionApplicationSupportDirectory,
    'Capture output path'
  );
  const safeProofPath =
    persistenceProofPath === undefined
      ? null
      : assertAbsolutePathOutsideApplicationSupport(
          persistenceProofPath,
          productionApplicationSupportDirectory,
          'Persistence proof output path'
        );
  const safeDataDirectory = assertAbsolutePathOutsideApplicationSupport(
    dataDirectory,
    productionApplicationSupportDirectory,
    `${captureDataMode === 'real' ? 'Real capture snapshot' : 'Scratch capture data directory'}`
  );

  if (captureDataMode === 'real') {
    if (!snapshotDirectory || !isAbsolute(snapshotDirectory)) {
      throw new Error('Real-data captures require an isolated snapshot marker.');
    }

    const safeSnapshotDirectory = assertAbsolutePathOutsideApplicationSupport(
      snapshotDirectory,
      productionApplicationSupportDirectory,
      'Real capture snapshot'
    );

    if (!pathsAreEquivalent(safeDataDirectory, safeSnapshotDirectory)) {
      throw new Error('Real-data captures must read the isolated directory named by the snapshot marker.');
    }
  }

  return {
    capturePath: safeCapturePath,
    dataDirectory: safeDataDirectory,
    persistenceProofPath: safeProofPath
  };
}

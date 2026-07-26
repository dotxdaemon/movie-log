// ABOUTME: Isolates capture data and rejects artifact paths that could overwrite Movie Log production files.
// ABOUTME: Handles symlinks, missing descendants, case aliases, and the macOS Data-volume firmlink.
import { cp, lstat, mkdir, mkdtemp, readlink, realpath, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

export const captureSnapshotMarkerName = 'MOVIE_LOG_CAPTURE_SNAPSHOT_DIR';

export function readProductionApplicationSupportDirectory(homeDirectory = homedir()) {
  return join(homeDirectory, 'Library', 'Application Support', 'Movie Log');
}

export function readProductionDataDirectory(homeDirectory = homedir()) {
  return join(readProductionApplicationSupportDirectory(homeDirectory), 'movie-log');
}

export async function canonicalizeCapturePath(targetPath, symlinkDepth = 0) {
  let existingPath = resolve(targetPath);
  const missingSegments = [];

  while (true) {
    try {
      const canonicalExistingPath = await realpath(existingPath);
      return resolve(canonicalExistingPath, ...missingSegments.reverse());
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
        throw error;
      }

      try {
        const existingStats = await lstat(existingPath);

        if (existingStats.isSymbolicLink()) {
          if (symlinkDepth >= 40) {
            throw new Error(`Capture path contains too many symbolic links: ${targetPath}`, { cause: error });
          }

          const linkTarget = await readlink(existingPath);
          return canonicalizeCapturePath(
            resolve(dirname(existingPath), linkTarget, ...missingSegments.reverse()),
            symlinkDepth + 1
          );
        }
      } catch (lstatError) {
        if (lstatError?.code !== 'ENOENT' && lstatError?.code !== 'ENOTDIR') {
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

function normalizeMacDataVolumeAlias(targetPath) {
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

function normalizePathForComparison(targetPath) {
  return normalizeMacDataVolumeAlias(targetPath).normalize('NFC').toLowerCase();
}

async function readIdentity(targetPath) {
  try {
    const targetStats = await stat(targetPath);
    return `${targetStats.dev}:${targetStats.ino}`;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return null;
    }

    throw error;
  }
}

async function hasProtectedAncestor(targetPath, protectedPath) {
  const protectedIdentity = await readIdentity(protectedPath);

  if (!protectedIdentity) {
    return false;
  }

  let currentPath = targetPath;

  while (true) {
    const identity = await readIdentity(currentPath);

    if (identity === protectedIdentity) {
      return true;
    }

    const parentPath = dirname(currentPath);

    if (parentPath === currentPath) {
      return false;
    }

    currentPath = parentPath;
  }
}

export async function isSamePathOrDescendant(targetPath, parentPath) {
  const canonicalTargetPath = await canonicalizeCapturePath(targetPath);
  const canonicalParentPath = await canonicalizeCapturePath(parentPath);
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

export async function assertAbsolutePathOutsideApplicationSupport(
  targetPath,
  productionApplicationSupportDirectory,
  description
) {
  if (!targetPath || !isAbsolute(targetPath)) {
    throw new Error(`${description} must be an absolute path outside Movie Log Application Support.`);
  }

  const canonicalTargetPath = await canonicalizeCapturePath(targetPath);

  if (await isSamePathOrDescendant(canonicalTargetPath, productionApplicationSupportDirectory)) {
    throw new Error(`${description} must be an absolute path outside Movie Log Application Support.`);
  }

  return canonicalTargetPath;
}

export async function createRealCaptureSnapshot(productionDataDirectory) {
  const snapshotRoot = await mkdtemp(join(tmpdir(), 'movie-log-capture-snapshot-'));
  const snapshotDataDirectory = join(snapshotRoot, 'movie-log');

  try {
    await cp(productionDataDirectory, snapshotDataDirectory, {
      dereference: true,
      preserveTimestamps: true,
      recursive: true
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      await rm(snapshotRoot, { force: true, recursive: true });
      throw error;
    }

    await mkdir(snapshotDataDirectory, { recursive: true });
  }

  return {
    dataDirectory: await canonicalizeCapturePath(snapshotDataDirectory),
    rootDirectory: snapshotRoot
  };
}

// ABOUTME: Describes the capture data-safety helpers used by TypeScript behavioral tests.
// ABOUTME: Keeps capture script tests type-safe without compiling the JavaScript launcher helpers.
export const captureSnapshotMarkerName: 'MOVIE_LOG_CAPTURE_SNAPSHOT_DIR';

export function readProductionApplicationSupportDirectory(homeDirectory?: string): string;
export function readProductionDataDirectory(homeDirectory?: string): string;
export function canonicalizeCapturePath(targetPath: string): Promise<string>;
export function isSamePathOrDescendant(targetPath: string, parentPath: string): Promise<boolean>;
export function assertAbsolutePathOutsideApplicationSupport(
  targetPath: string,
  productionApplicationSupportDirectory: string,
  description: string
): Promise<string>;
export function createRealCaptureSnapshot(
  productionDataDirectory: string
): Promise<{ dataDirectory: string; rootDirectory: string }>;

// ABOUTME: Scans a chosen folder and returns the current top-level media items that should populate the app.
// ABOUTME: Keeps folder population deterministic for startup scans, manual adds, and scheduled refreshes.
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createEntryFromPath } from '../shared/history.js';
import { isTrackableMediaItem } from '../shared/media-items.js';
import type { EntryKind } from '../shared/types.js';

const execFileAsync = promisify(execFile);
const finderAddedAtScript = `
use framework "Foundation"
on run argv
  set formatter to current application's NSDateFormatter's new()
  formatter's setDateFormat:"yyyy-MM-dd HH:mm:ss.SSS Z"
  set outputLines to {}
  repeat with currentPath in argv
    set fileURL to current application's |NSURL|'s fileURLWithPath:(currentPath as text)
    set {ok, addedDate} to fileURL's getResourceValue:(reference) forKey:(current application's NSURLAddedToDirectoryDateKey) |error|:(missing value)
    if ok then
      set end of outputLines to ((formatter's stringFromDate:addedDate) as text)
    else
      set end of outputLines to "(null)"
    end if
  end repeat
  set previousTextItemDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to linefeed
  set outputText to outputLines as text
  set AppleScript's text item delimiters to previousTextItemDelimiters
  return outputText
end run
`.trim();

export interface ScannedFolderItem {
  addedAt?: string;
  itemKey: string;
  sourceKind: EntryKind;
  sourcePath: string;
  title: string;
}

function readFilesystemAddedAt(itemStats: Awaited<ReturnType<typeof stat>>): string {
  if (itemStats.birthtimeMs > 0) {
    return itemStats.birthtime.toISOString();
  }

  return itemStats.mtime.toISOString();
}

export function resolveAddedAt(addedAtValue: string | null | undefined, fallbackAddedAt: string): string {
  const normalizedValue = addedAtValue?.trim();

  if (!normalizedValue || normalizedValue === '(null)') {
    return fallbackAddedAt;
  }

  const parsedAddedAt = new Date(normalizedValue);

  if (Number.isNaN(parsedAddedAt.valueOf())) {
    return fallbackAddedAt;
  }

  return parsedAddedAt.toISOString();
}

export function parseAddedAtValues(sourcePaths: string[], output: string): Map<string, string | null> {
  const lines = output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());
  const addedAtValues = new Map<string, string | null>();

  sourcePaths.forEach((sourcePath, index) => {
    const addedAtValue = lines[index];
    addedAtValues.set(sourcePath, !addedAtValue || addedAtValue === '(null)' ? null : addedAtValue);
  });

  return addedAtValues;
}

async function readAddedAtValues(sourcePaths: string[]): Promise<Map<string, string | null>> {
  if (sourcePaths.length === 0) {
    return new Map();
  }

  try {
    const { stdout } = await execFileAsync('osascript', ['-l', 'AppleScript', '-e', finderAddedAtScript, ...sourcePaths]);
    return parseAddedAtValues(sourcePaths, stdout);
  } catch {
    return new Map(sourcePaths.map((sourcePath) => [sourcePath, null]));
  }
}

async function readScannedItem(
  sourcePath: string,
  addedAtValue: string | null
): Promise<Pick<ScannedFolderItem, 'addedAt' | 'itemKey'> | null> {
  try {
    const itemStats = await stat(sourcePath);
    const fallbackAddedAt = readFilesystemAddedAt(itemStats);

    return {
      addedAt: resolveAddedAt(addedAtValue, fallbackAddedAt),
      itemKey: `${itemStats.dev}:${itemStats.ino}`
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function scanFolderContents(folderPath: string): Promise<ScannedFolderItem[]> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const trackableEntries = entries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => {
        const sourcePath = join(folderPath, entry.name);
        const sourceKind: EntryKind = entry.isDirectory() ? 'directory' : 'file';

        return {
          sourceKind,
          sourcePath
        };
      })
      .filter(({ sourceKind, sourcePath }) => isTrackableMediaItem(sourcePath, sourceKind));
    const addedAtValues = await readAddedAtValues(trackableEntries.map((entry) => entry.sourcePath));
    const scannedItems = await Promise.all(
      trackableEntries.map(async ({ sourceKind, sourcePath }): Promise<ScannedFolderItem | null> => {
        const scannedItem = await readScannedItem(sourcePath, addedAtValues.get(sourcePath) ?? null);

        if (!scannedItem) {
          return null;
        }

        const watchEntry = createEntryFromPath(sourcePath, 'watch', '1970-01-01T00:00:00.000Z', sourceKind);

        const nextItem: ScannedFolderItem = {
          addedAt: scannedItem.addedAt,
          itemKey: scannedItem.itemKey,
          sourceKind,
          sourcePath,
          title: watchEntry.title
        };

        return nextItem;
      })
    );

    return scannedItems
      .filter((item): item is ScannedFolderItem => item !== null)
      .sort((left, right) => left.title.localeCompare(right.title) || left.sourcePath.localeCompare(right.sourcePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

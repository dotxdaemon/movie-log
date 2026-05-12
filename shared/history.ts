// ABOUTME: Creates normalized watch-history entries from dropped files and watched-folder discoveries.
// ABOUTME: Keeps filename-based titles and newest-first ordering deterministic across the desktop app.
import type { EntryKind, EntrySource, WatchEntry } from './types.js';

export function readPathName(sourcePath: string): string {
  const trimmedPath = sourcePath.replace(/\/+$/, '');
  const slashIndex = trimmedPath.lastIndexOf('/');
  return slashIndex === -1 ? trimmedPath : trimmedPath.slice(slashIndex + 1);
}

function readExtension(pathName: string): string {
  const dotIndex = pathName.lastIndexOf('.');
  return dotIndex > 0 ? pathName.slice(dotIndex) : '';
}

function inferKindFromPath(sourcePath: string): EntryKind {
  return readExtension(readPathName(sourcePath)) ? 'file' : 'directory';
}

export function readTitleFromPath(sourcePath: string, sourceKind: EntryKind = inferKindFromPath(sourcePath)): string {
  const name = readPathName(sourcePath);

  if (sourceKind === 'file') {
    const extension = readExtension(name);
    return extension ? name.slice(0, -extension.length) : name;
  }

  return name;
}

export function createEntryFromPath(
  sourcePath: string,
  source: EntrySource,
  watchedAt = new Date().toISOString(),
  sourceKind = inferKindFromPath(sourcePath)
): WatchEntry {
  return {
    id: `${watchedAt}:${sourcePath}`,
    source,
    sourceKind,
    sourcePath,
    title: readTitleFromPath(sourcePath, sourceKind),
    watchedAt
  };
}

export function sortEntriesByWatchedAt(entries: WatchEntry[]): WatchEntry[] {
  return [...entries].sort((left, right) => right.watchedAt.localeCompare(left.watchedAt));
}

export function readVisibleHistory(entries: WatchEntry[]): WatchEntry[] {
  const watchEntriesByPath = new Map<string, WatchEntry>();
  const manualEntries: WatchEntry[] = [];

  for (const entry of entries) {
    if (entry.source !== 'watch') {
      manualEntries.push(entry);
      continue;
    }

    const existing = watchEntriesByPath.get(entry.sourcePath);

    if (!existing || entry.watchedAt < existing.watchedAt) {
      watchEntriesByPath.set(entry.sourcePath, entry);
    }
  }

  return sortEntriesByWatchedAt([...manualEntries, ...watchEntriesByPath.values()]);
}

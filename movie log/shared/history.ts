// ABOUTME: Creates normalized watch-history entries from dropped files and watched-folder discoveries.
// ABOUTME: Keeps title cleanup and arrival ordering deterministic across the desktop app.
import { basename, extname } from 'node:path';
import type { EntryKind, EntrySource, WatchEntry } from './types.js';

function inferKindFromPath(sourcePath: string): EntryKind {
  return extname(sourcePath) ? 'file' : 'directory';
}

function titleFromPath(sourcePath: string, sourceKind: EntryKind): string {
  const name = basename(sourcePath);

  if (sourceKind === 'file') {
    const extension = extname(name);
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
    title: titleFromPath(sourcePath, sourceKind),
    watchedAt
  };
}

export function sortEntriesByWatchedAt(entries: WatchEntry[]): WatchEntry[] {
  return [...entries].sort((left, right) => left.watchedAt.localeCompare(right.watchedAt));
}

// ABOUTME: Defines which filesystem paths count as trackable media items in the desktop media log.
// ABOUTME: Keeps hidden files and non-media files out of scans, history, and watcher discoveries.
import { basename, extname } from 'node:path';
import type { EntryKind } from './types.js';

const trackableFileExtensions = new Set([
  '.aac',
  '.avi',
  '.flac',
  '.m2ts',
  '.m4a',
  '.m4v',
  '.mkv',
  '.mov',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.mp3',
  '.mts',
  '.ogg',
  '.opus',
  '.ts',
  '.wav',
  '.webm',
  '.wmv'
]);

export function isTrackableMediaItem(sourcePath: string, sourceKind: EntryKind): boolean {
  const name = basename(sourcePath);

  if (name.startsWith('.')) {
    return false;
  }

  if (sourceKind === 'directory') {
    return true;
  }

  return trackableFileExtensions.has(extname(name).toLowerCase());
}

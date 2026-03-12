// ABOUTME: Defines the shared data contracts used by the Electron process and React renderer.
// ABOUTME: Keeps persisted history records, watched folders, and preload APIs in sync.
export type EntrySource = 'drop' | 'watch';
export type EntryKind = 'file' | 'directory';

export interface WatchEntry {
  id: string;
  title: string;
  watchedAt: string;
  source: EntrySource;
  sourceKind: EntryKind;
  sourcePath: string;
}

export interface WatchedFolder {
  id: string;
  addedAt: string;
  name: string;
  path: string;
}

export interface MovieLogState {
  history: WatchEntry[];
  watchedFolders: WatchedFolder[];
}

export interface MovieLogApi {
  getState(): Promise<MovieLogState>;
  logPaths(paths: string[]): Promise<WatchEntry[]>;
  pickWatchedFolder(): Promise<WatchedFolder | null>;
  removeWatchedFolder(id: string): Promise<void>;
  pathForFile(file: unknown): string;
  subscribe(listener: (state: MovieLogState) => void): () => void;
}

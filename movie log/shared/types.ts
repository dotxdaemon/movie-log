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
  lastScannedAt: string | null;
  name: string;
  path: string;
}

export interface FolderContentsItem {
  sourceKind: EntryKind;
  sourcePath: string;
  title: string;
}

export interface LibraryItem extends FolderContentsItem {
  id: string;
  firstSeenAt: string;
  folderId: string;
  folderPath: string;
  lastSeenAt: string;
}

export interface MovieLogState {
  history: WatchEntry[];
  libraryItems: LibraryItem[];
  watchedFolders: WatchedFolder[];
}

export interface MovieLogApi {
  getState(): Promise<MovieLogState>;
  getDataFilePath(): Promise<string>;
  getNoteFilePath(): Promise<string>;
  logPaths(paths: string[]): Promise<WatchEntry[]>;
  addWatchedFolders(): Promise<WatchedFolder[]>;
  removeWatchedFolder(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  copyPath(path: string): Promise<void>;
  openInFinder(path: string): Promise<void>;
  openItem(path: string): Promise<void>;
  scanNow(): Promise<void>;
  pathForFile(file: unknown): string;
  subscribe(listener: (state: MovieLogState) => void): () => void;
}

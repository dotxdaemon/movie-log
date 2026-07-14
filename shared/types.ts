// ABOUTME: Defines the shared data contracts used by the Electron process and React renderer.
// ABOUTME: Keeps persisted history records, watched folders, and preload APIs in sync.
export type EntrySource = 'drop' | 'watch';
export type EntryKind = 'file' | 'directory';

export interface WatchEntry {
  castNotes?: string;
  favorite?: boolean;
  id: string;
  location?: string;
  rating?: number | null;
  review?: string;
  rewatch?: boolean;
  title: string;
  tags?: string[];
  watchedAt: string;
  viewingFormat?: string;
  source: EntrySource;
  sourceKind: EntryKind;
  sourcePath: string;
}

export interface EntryDetails {
  castNotes?: string;
  favorite?: boolean;
  location?: string;
  rating?: number | null;
  review?: string;
  rewatch?: boolean;
  tags?: string[];
  viewingFormat?: string;
}

export interface LogEntryDetails extends EntryDetails {
  watchedAt?: string;
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

export type FilmStatus = 'matched' | 'unmatched';

export interface FilmDetails {
  cast: string[];
  country: string[];
  director: string[];
  genres: string[];
  language: string[];
  pageId: number;
  posterUrl: string | null;
  runtimeMinutes: number | null;
  wikipediaUrl: string | null;
  year: number | null;
}

export interface FilmRecord {
  cast: string[];
  country: string[];
  director: string[];
  fetchedAt: string;
  genres: string[];
  key: string;
  language: string[];
  pageId: number | null;
  posterUrl: string | null;
  runtimeMinutes: number | null;
  status: FilmStatus;
  title: string;
  wikipediaUrl: string | null;
  year: number | null;
}

export interface CatalogSearchResult {
  description: string;
  director?: string[];
  pageId: number;
  posterUrl: string | null;
  title: string;
  year: number | null;
}

export interface MovieLogState {
  films?: Record<string, FilmRecord>;
  history: WatchEntry[];
  libraryItems: LibraryItem[];
  watchedFolders: WatchedFolder[];
}

export interface LogPathsResult {
  addedCount: number;
  skippedPaths: string[];
}

export interface LogFilmRequest {
  pageId: number;
  title: string;
  year: number | null;
}

export interface MovieLogApi {
  chooseLogPaths(): Promise<string[]>;
  getState(): Promise<MovieLogState>;
  getDataFilePath(): Promise<string>;
  getNoteFilePath(): Promise<string>;
  logFilm(film: LogFilmRequest, details?: LogEntryDetails): Promise<void>;
  logPaths(paths: string[], details?: LogEntryDetails): Promise<LogPathsResult>;
  matchFilm(filmKey: string, film: { title: string; year: number | null }, pageId: number | null): Promise<void>;
  searchCatalog(query: string): Promise<CatalogSearchResult[]>;
  updateEntry(entryId: string, details: EntryDetails): Promise<WatchEntry | null>;
  addWatchedFolders(): Promise<WatchedFolder[]>;
  removeWatchedFolder(id: string): Promise<void>;
  copyPath(path: string): Promise<void>;
  openInFinder(path: string): Promise<void>;
  openItem(path: string): Promise<void>;
  scanNow(): Promise<void>;
  pathForFile(file: unknown): string;
  subscribe(listener: (state: MovieLogState) => void): () => void;
}

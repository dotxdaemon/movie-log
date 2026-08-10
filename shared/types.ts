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

export type FilmStatus = 'failed' | 'matched' | 'pending' | 'retry-scheduled' | 'unmatched';
export type CatalogSource = 'imdb' | 'wikipedia';

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
  attempts?: number;
  cast: string[];
  catalogId?: string;
  catalogSource?: CatalogSource;
  country: string[];
  detailsComplete?: boolean;
  director: string[];
  failureCount?: number;
  fetchedAt: string;
  failureReason?: 'temporary';
  genres: string[];
  key: string;
  matchVersion?: number;
  mediaType?: 'film' | 'series';
  language: string[];
  pageId: number | null;
  nextRetryAt?: string;
  posterFailureCount?: number;
  posterLookupVersion?: number;
  posterUrl: string | null;
  posterWidth?: number;
  runtimeMinutes: number | null;
  status: FilmStatus;
  title: string;
  wikipediaUrl: string | null;
  year: number | null;
}

export interface CatalogSearchResult {
  catalogId?: string;
  catalogSource?: CatalogSource;
  catalogRank?: number;
  description: string;
  director?: string[];
  mediaType?: 'film' | 'series';
  pageId: number;
  posterLookupComplete?: boolean;
  posterUrl: string | null;
  posterWidth?: number;
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
  entryStatus: 'failed' | 'saved';
  metadataStatus: 'attached' | 'not-requested' | 'pending';
  skippedPaths: string[];
}

export interface LogFilmRequest {
  catalogId?: string;
  catalogSource?: CatalogSource;
  director?: string[];
  mediaType?: 'film' | 'series';
  pageId: number;
  posterLookupComplete?: boolean;
  posterUrl?: string | null;
  posterWidth?: number;
  title: string;
  year: number | null;
}

export interface MovieLogApi {
  chooseLogPaths(): Promise<string[]>;
  deleteEntry(entryId: string): Promise<WatchEntry | null>;
  getState(): Promise<MovieLogState>;
  getDataFilePath(): Promise<string>;
  getNoteFilePath(): Promise<string>;
  logFilm(film: LogFilmRequest, details?: LogEntryDetails): Promise<LogPathsResult>;
  logPaths(paths: string[], details?: LogEntryDetails, film?: LogFilmRequest): Promise<LogPathsResult>;
  matchFilm(
    filmKey: string,
    film: { title: string; year: number | null },
    selection: CatalogSearchResult | null
  ): Promise<void>;
  searchCatalog(query: string): Promise<CatalogSearchResult[]>;
  updateEntry(entryId: string, details: LogEntryDetails): Promise<WatchEntry | null>;
  addWatchedFolders(): Promise<WatchedFolder[]>;
  removeWatchedFolder(id: string): Promise<void>;
  retryFilmEnrichment(): Promise<void>;
  copyPath(path: string): Promise<void>;
  openInFinder(path: string): Promise<void>;
  openItem(path: string): Promise<void>;
  scanNow(): Promise<void>;
  pathForFile(file: unknown): string;
  subscribe(listener: (state: MovieLogState) => void): () => void;
}

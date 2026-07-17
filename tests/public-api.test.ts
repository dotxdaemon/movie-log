// ABOUTME: Verifies that the shared Movie Log API contract no longer exposes removed desktop actions.
// ABOUTME: Keeps the preload bridge and shared types aligned around the append-only history policy.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));

describe('Movie Log public API', () => {
  it('does not expose clearHistory in the preload bridge or shared types', async () => {
    const preloadSource = await readFile(join(rootDirectory, 'electron', 'preload.cjs'), 'utf8');
    const sharedTypesSource = await readFile(join(rootDirectory, 'shared', 'types.ts'), 'utf8');

    expect(preloadSource).not.toContain('clearHistory');
    expect(preloadSource).not.toContain('movie-log:clear-history');
    expect(sharedTypesSource).not.toContain('clearHistory');
  });

  it('keeps the dropped-path result contract aligned across shared types, preload, and the renderer', async () => {
    const preloadSource = await readFile(join(rootDirectory, 'electron', 'preload.cjs'), 'utf8');
    const sharedTypesSource = await readFile(join(rootDirectory, 'shared', 'types.ts'), 'utf8');
    const appSource = await readFile(join(rootDirectory, 'src', 'App.tsx'), 'utf8');

    expect(sharedTypesSource).toContain('export interface LogPathsResult');
    expect(sharedTypesSource).toContain(
      'logPaths(paths: string[], details?: LogEntryDetails, film?: LogFilmRequest): Promise<LogPathsResult>;'
    );
    expect(preloadSource).toContain(
      "logPaths: (paths, details, film) => ipcRenderer.invoke('movie-log:log-paths', paths, details, film)"
    );
    expect(appSource).toContain('outcome.addedCount');
    expect(appSource).toContain('outcome.skippedPaths');
  });

  it('exposes native media selection and persistent entry annotation actions', async () => {
    const preloadSource = await readFile(join(rootDirectory, 'electron', 'preload.cjs'), 'utf8');
    const sharedTypesSource = await readFile(join(rootDirectory, 'shared', 'types.ts'), 'utf8');

    expect(sharedTypesSource).toContain('chooseLogPaths(): Promise<string[]>;');
    expect(sharedTypesSource).toContain(
      'updateEntry(entryId: string, details: EntryDetails): Promise<WatchEntry | null>;'
    );
    expect(sharedTypesSource).toContain(
      'logPaths(paths: string[], details?: LogEntryDetails, film?: LogFilmRequest): Promise<LogPathsResult>;'
    );
    expect(preloadSource).toContain("chooseLogPaths: () => ipcRenderer.invoke('movie-log:choose-log-paths')");
    expect(preloadSource).toContain(
      "updateEntry: (entryId, details) => ipcRenderer.invoke('movie-log:update-entry', entryId, details)"
    );
    expect(preloadSource).toContain("retryFilmEnrichment: () => ipcRenderer.invoke('movie-log:retry-film-enrichment')");
  });

  it('refreshes the transactional filter draft only when the filter sheet opens', async () => {
    const appSource = await readFile(join(rootDirectory, 'src', 'App.tsx'), 'utf8');
    const logHandler = appSource.slice(
      appSource.indexOf('const handleLogPanelOpenChange'),
      appSource.indexOf('const handleFilterSheetOpenChange')
    );
    const filterHandler = appSource.slice(
      appSource.indexOf('const handleFilterSheetOpenChange'),
      appSource.indexOf('const handleAddWatchedFolders')
    );

    expect(logHandler).not.toContain('setFilterDraft(filters)');
    expect(filterHandler).toContain('setFilterDraft(filters)');
  });
});

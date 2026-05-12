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
    expect(sharedTypesSource).toContain('logPaths(paths: string[]): Promise<LogPathsResult>;');
    expect(preloadSource).toContain("logPaths: (paths) => ipcRenderer.invoke('movie-log:log-paths', paths)");
    expect(appSource).toContain('loggedPaths.addedCount');
    expect(appSource).toContain('loggedPaths.skippedPaths');
  });
});

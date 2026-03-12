// ABOUTME: Verifies that the app can scan an existing folder and turn its current contents into library items.
// ABOUTME: Uses the real filesystem so initial population matches the actual desktop scanning behavior.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanFolderContents } from '../electron/folder-scan.js';

describe('scanFolderContents', () => {
  let rootDirectory = '';

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'movie-log-scan-'));
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('lists visible top-level folders and allowed media files for initial population', async () => {
    const moviesPath = join(rootDirectory, 'Movies');
    await mkdir(moviesPath);
    await mkdir(join(moviesPath, 'Severance'));
    await writeFile(join(moviesPath, '.DS_Store'), 'junk');
    await writeFile(join(moviesPath, 'Poster.jpg'), 'poster');
    await writeFile(join(moviesPath, 'The Brutalist.mkv'), 'movie');
    await writeFile(join(moviesPath, 'Flow.mp4'), 'movie');
    await writeFile(join(moviesPath, 'Clair de Lune.flac'), 'audio');

    const items = await scanFolderContents(moviesPath);

    expect(items.map(({ sourceKind, sourcePath, title }) => ({ sourceKind, sourcePath, title }))).toEqual([
      {
        sourceKind: 'file',
        sourcePath: join(moviesPath, 'Clair de Lune.flac'),
        title: 'Clair de Lune'
      },
      {
        sourceKind: 'file',
        sourcePath: join(moviesPath, 'Flow.mp4'),
        title: 'Flow'
      },
      {
        sourceKind: 'directory',
        sourcePath: join(moviesPath, 'Severance'),
        title: 'Severance'
      },
      {
        sourceKind: 'file',
        sourcePath: join(moviesPath, 'The Brutalist.mkv'),
        title: 'The Brutalist'
      }
    ]);
    expect(items.every((item) => item.itemKey.length > 0)).toBe(true);
  });
});

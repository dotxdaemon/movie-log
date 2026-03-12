// ABOUTME: Verifies that watched folders only emit newly added top-level items after startup.
// ABOUTME: Uses the real filesystem so the monitor logic matches how the desktop app discovers media.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFolderMonitor } from '../electron/folder-monitor.js';

async function waitForDiscovery(paths: string[]) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (paths.length > 0) {
      return;
    }

    await delay(50);
  }

  throw new Error('Timed out waiting for a watched-folder discovery');
}

describe('createFolderMonitor', () => {
  let rootDirectory = '';

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'movie-log-watch-'));
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('ignores existing items and emits newly added top-level folders', async () => {
    const inboxPath = join(rootDirectory, 'Media Inbox');
    await mkdir(inboxPath);
    await mkdir(join(inboxPath, 'Already There'));

    const seenPaths: string[] = [];
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onDiscover: async (itemPath) => {
        seenPaths.push(itemPath);
      },
      settleMs: 25
    });

    await monitor.watchFolder(inboxPath);
    await mkdir(join(inboxPath, 'Just Added'));
    await waitForDiscovery(seenPaths);
    await monitor.dispose();

    expect(seenPaths).toEqual([join(inboxPath, 'Just Added')]);
  });

  it('does not throw when a watched folder is missing', async () => {
    const knownByFolder = new Map<string, string[]>();
    const monitor = createFolderMonitor({
      loadKnownPaths: async (folderPath) => knownByFolder.get(folderPath) ?? [],
      saveKnownPaths: async (folderPath, knownPaths) => {
        knownByFolder.set(folderPath, knownPaths);
      },
      onDiscover: async () => {}
    });

    await expect(monitor.watchFolder(join(rootDirectory, 'Missing Folder'))).resolves.toBeUndefined();
    await monitor.dispose();
  });
});

// ABOUTME: Removes generated renderer and Electron output before each production build.
// ABOUTME: Prevents deleted source modules from surviving into the packaged application.
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

await Promise.all([
  rm(join(process.cwd(), 'dist'), { force: true, recursive: true }),
  rm(join(process.cwd(), 'dist-electron'), { force: true, recursive: true })
]);

// ABOUTME: Compares generated Electron JavaScript with source modules before app packaging.
// ABOUTME: Rejects source-less artifacts so stale files cannot enter the installed bundle.
import { access, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

async function readGeneratedModules(directory) {
  const modules = [];

  async function visit(currentDirectory) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.name.endsWith('.js')) {
        modules.push(relative(directory, entryPath));
      }
    }
  }

  await visit(directory);
  return modules.sort();
}

export async function findUnreferencedGeneratedModules(sourceDirectory, outputDirectory) {
  const generatedModules = await readGeneratedModules(outputDirectory);
  const unreferenced = [];

  for (const generatedModule of generatedModules) {
    const sourceModule = join(sourceDirectory, generatedModule.replace(/\.js$/, '.ts'));

    try {
      await access(sourceModule);
    } catch {
      unreferenced.push(generatedModule);
    }
  }

  return unreferenced;
}

export async function assertGeneratedOutput(projectDirectory = process.cwd()) {
  const roots = ['electron', 'shared'];
  const failures = [];

  for (const root of roots) {
    const unreferenced = await findUnreferencedGeneratedModules(
      join(projectDirectory, root),
      join(projectDirectory, 'dist-electron', root)
    );
    failures.push(...unreferenced.map((modulePath) => `${root}/${modulePath}`));
  }

  if (failures.length > 0) {
    throw new Error(`Generated output has no matching source module: ${failures.join(', ')}`);
  }
}

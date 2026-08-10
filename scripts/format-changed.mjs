// ABOUTME: Formats or checks only supported project files changed in the current working tree.
// ABOUTME: Keeps formatter enforcement focused without rewriting unrelated history or artifacts.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

const mode = process.argv[2];

if (mode !== '--write' && mode !== '--check') {
  throw new Error('Use --write or --check.');
}

function readGitPaths(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map((filePath) => filePath.trim())
    .filter(Boolean);
}

const changedPaths = readGitPaths(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
const untrackedPaths = readGitPaths(['ls-files', '--others', '--exclude-standard']);
const supportedPath =
  /^(?:AGENTS\.md|package\.json|(?:src|tests|scripts|electron|shared)\/.*\.(?:css|cjs|js|json|mjs|mts|ts|tsx))$/;
const paths = [...new Set([...changedPaths, ...untrackedPaths])].filter((filePath) => supportedPath.test(filePath));

if (paths.length > 0) {
  const prettierPath = require.resolve('prettier/bin/prettier.cjs');
  execFileSync(process.execPath, [prettierPath, mode, ...paths], {
    stdio: 'inherit'
  });
} else {
  process.stdout.write('No changed supported files to format.\n');
}

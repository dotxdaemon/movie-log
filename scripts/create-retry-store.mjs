// ABOUTME: Copies a complete Movie Log store and schedules one deterministic metadata retry for installed acceptance.
// ABOUTME: Refuses production destinations so retry and catalog writes can never mutate the canonical archive.
import { cp, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import process from 'node:process';
import {
  assertAbsolutePathOutsideApplicationSupport,
  canonicalizeCapturePath,
  isSamePathOrDescendant,
  readProductionApplicationSupportDirectory
} from './capture-data-safety.mjs';

const sourceDirectory = process.argv[2];
const requestedOutputDirectory = process.argv[3];

if (
  !sourceDirectory ||
  !isAbsolute(sourceDirectory) ||
  !requestedOutputDirectory ||
  !isAbsolute(requestedOutputDirectory)
) {
  throw new Error('Provide absolute source and isolated output data directories.');
}

const canonicalSourceDirectory = await canonicalizeCapturePath(sourceDirectory);
const outputDirectory = await assertAbsolutePathOutsideApplicationSupport(
  requestedOutputDirectory,
  readProductionApplicationSupportDirectory(),
  'Retry fixture output directory'
);

if (
  (await isSamePathOrDescendant(outputDirectory, canonicalSourceDirectory)) ||
  (await isSamePathOrDescendant(canonicalSourceDirectory, outputDirectory))
) {
  throw new Error('Retry fixture source and output directories must not overlap.');
}

await cp(canonicalSourceDirectory, outputDirectory, {
  dereference: true,
  errorOnExist: true,
  force: false,
  preserveTimestamps: true,
  recursive: true
});

const filmsPath = join(outputDirectory, 'movie-log-films.json');
const persisted = JSON.parse(await readFile(filmsPath, 'utf8'));
const key = 'the ring::2002';
const record = persisted.films?.[key];

if (!record) {
  throw new Error(`Retry fixture source does not contain ${key}.`);
}

persisted.films[key] = {
  ...record,
  attempts: 2,
  detailsComplete: false,
  failureCount: 1,
  failureReason: 'temporary',
  fetchedAt: '2026-08-09T12:00:00.000Z',
  nextRetryAt: '2030-08-09T12:00:00.000Z',
  status: 'retry-scheduled'
};

await writeFile(filmsPath, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
process.stdout.write(`${outputDirectory}\n`);

// ABOUTME: Creates an isolated, deterministic Movie Log data set for large-library installed-app acceptance.
// ABOUTME: Refuses the production Application Support directory and pre-seeds unmatched metadata to prevent network work.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const outputDirectory = process.argv[2] ? resolve(process.argv[2]) : '';
const itemCount = Number(process.argv[3] ?? '1000');
const productionFragment = '/Library/Application Support/Movie Log/';

if (!outputDirectory || outputDirectory.includes(productionFragment)) {
  throw new Error('Provide an isolated output directory outside Movie Log Application Support.');
}

if (!Number.isInteger(itemCount) || itemCount < 1_000 || itemCount > 10_000) {
  throw new Error(`Stress item count must be a whole number from 1000 through 10000. Received ${itemCount}.`);
}

const watchedAt = '2026-07-24T12:00:00.000Z';
const folderPath = '/Movie Log Acceptance/Large Library';
const history = [];
const libraryItems = [];
const films = {};

for (let index = 0; index < itemCount; index += 1) {
  const sequence = String(index + 1).padStart(4, '0');
  const year = 1980 + (index % 46);
  const title = `Stress Film ${sequence} (${year})`;
  const sourcePath = `${folderPath}/${title}.mkv`;
  const key = `stress film ${sequence}::${year}`;
  const timestamp = new Date(Date.parse(watchedAt) - index * 60_000).toISOString();

  history.push({
    id: `${timestamp}:${sourcePath}`,
    source: 'watch',
    sourceKind: 'file',
    sourcePath,
    title,
    watchedAt: timestamp
  });
  libraryItems.push({
    firstSeenAt: timestamp,
    folderId: 'acceptance-large-library',
    folderPath,
    id: `acceptance-large-library:${sourcePath}`,
    lastSeenAt: timestamp,
    sourceKind: 'file',
    sourcePath,
    title
  });
  films[key] = {
    attempts: 1,
    cast: [],
    country: [],
    detailsComplete: false,
    director: [],
    fetchedAt: watchedAt,
    genres: [],
    key,
    language: [],
    matchVersion: 3,
    mediaType: 'film',
    pageId: null,
    posterUrl: null,
    runtimeMinutes: null,
    status: 'unmatched',
    title: `Stress Film ${sequence}`,
    wikipediaUrl: null,
    year
  };
}

const state = {
  history,
  historyPolicy: 'append-only',
  knownPathsByFolder: { [folderPath]: libraryItems.map((item) => item.sourcePath) },
  libraryItems,
  seenKeysByFolder: { [folderPath]: libraryItems.map((item) => item.sourcePath) },
  watchedFolders: []
};
const note = [
  '# Movie Log',
  '',
  '## History',
  '',
  ...history.map((entry) => `- ${entry.watchedAt} | ${entry.title} | File | Watched Folder | ${entry.sourcePath}`),
  '',
  '## Watched Folders',
  '',
  '- Nothing watched yet.',
  ''
].join('\n');

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(`${outputDirectory}/movie-log.json`, `${JSON.stringify(state, null, 2)}\n`, 'utf8'),
  writeFile(`${outputDirectory}/movie-log-films.json`, `${JSON.stringify({ films }, null, 2)}\n`, 'utf8'),
  writeFile(`${outputDirectory}/movie-log-note.md`, note, 'utf8')
]);
process.stdout.write(`${outputDirectory}\n`);

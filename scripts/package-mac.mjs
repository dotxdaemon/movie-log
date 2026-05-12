// ABOUTME: Builds a local macOS app bundle for Movie Log from the production renderer and Electron files.
// ABOUTME: Copies the built app code into Electron.app, applies sane bundle metadata, and generates a placeholder icon.
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { resolveElectronAppTemplatePath, resolveInstalledAppPath, resolveReleaseAppPath } from './package-paths.mjs';

const execFileAsync = promisify(execFile);
const appName = 'Movie Log';
const appIdentifier = 'com.seankim.movielog';
const iconBaseName = 'movie-log';
const projectDirectory = process.cwd();
const releaseDirectory = join(projectDirectory, 'release', 'mac');
const bundlePath = resolveReleaseAppPath(projectDirectory);
const installedAppPath = resolveInstalledAppPath();
const bundleResourcesPath = join(bundlePath, 'Contents', 'Resources');
const bundleAppPath = join(bundleResourcesPath, 'app');
const electronAppTemplatePath = await resolveElectronAppTemplatePath(projectDirectory);
const packageJson = JSON.parse(await readFile(join(projectDirectory, 'package.json'), 'utf8'));
const bundlePackage = {
  name: 'movie-log',
  productName: appName,
  type: 'module',
  version: packageJson.version,
  main: 'electron/main.js'
};

function replacePlistValue(plistContents, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
  return plistContents.replace(pattern, `$1${value}$3`);
}

async function runCommand(command, args) {
  await execFileAsync(command, args);
}

async function createIconFile(iconPath) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'movie-log-icon-'));
  const previewDirectory = join(temporaryDirectory, 'preview');
  const iconsetDirectory = join(temporaryDirectory, `${iconBaseName}.iconset`);

  try {
    await mkdir(previewDirectory, { recursive: true });
    await mkdir(iconsetDirectory, { recursive: true });

    await runCommand('qlmanage', [
      '-t',
      '-s',
      '1024',
      '-o',
      previewDirectory,
      join(projectDirectory, 'assets', 'movie-log-icon.svg')
    ]);

    const previewFiles = await readdir(previewDirectory);
    const previewFileName = previewFiles.find((fileName) => fileName.endsWith('.png'));

    if (!previewFileName) {
      throw new Error('qlmanage did not produce a PNG preview for the app icon.');
    }

    const previewPath = join(previewDirectory, previewFileName);
    const iconSizes = [16, 32, 128, 256, 512];

    for (const iconSize of iconSizes) {
      await runCommand('sips', ['-z', `${iconSize}`, `${iconSize}`, previewPath, '--out', join(iconsetDirectory, `icon_${iconSize}x${iconSize}.png`)]);
      await runCommand('sips', [
        '-z',
        `${iconSize * 2}`,
        `${iconSize * 2}`,
        previewPath,
        '--out',
        join(iconsetDirectory, `icon_${iconSize}x${iconSize}@2x.png`)
      ]);
    }

    await runCommand('iconutil', ['-c', 'icns', iconsetDirectory, '-o', iconPath]);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await rm(bundlePath, { recursive: true, force: true });
await mkdir(releaseDirectory, { recursive: true });
await runCommand('ditto', [electronAppTemplatePath, bundlePath]);

const infoPlistPath = join(bundlePath, 'Contents', 'Info.plist');
const infoPlist = await readFile(infoPlistPath, 'utf8');
const nextInfoPlist = [
  ['CFBundleDisplayName', appName],
  ['CFBundleIconFile', iconBaseName],
  ['CFBundleIdentifier', appIdentifier],
  ['CFBundleName', appName],
  ['CFBundleShortVersionString', bundlePackage.version],
  ['CFBundleVersion', bundlePackage.version]
].reduce((contents, [key, value]) => replacePlistValue(contents, key, value), infoPlist);

await writeFile(infoPlistPath, nextInfoPlist, 'utf8');
await createIconFile(join(bundleResourcesPath, `${iconBaseName}.icns`));

await mkdir(bundleAppPath, { recursive: true });
await cp(join(projectDirectory, 'dist'), join(bundleAppPath, 'dist'), { recursive: true });
await cp(join(projectDirectory, 'dist-electron', 'electron'), join(bundleAppPath, 'electron'), { recursive: true });
await cp(join(projectDirectory, 'dist-electron', 'shared'), join(bundleAppPath, 'shared'), { recursive: true });
await cp(join(projectDirectory, 'electron', 'preload.cjs'), join(bundleAppPath, 'electron', 'preload.cjs'), { recursive: false });
await writeFile(join(bundleAppPath, 'package.json'), `${JSON.stringify(bundlePackage, null, 2)}\n`, 'utf8');

await rm(installedAppPath, { recursive: true, force: true });
await mkdir(dirname(installedAppPath), { recursive: true });
await runCommand('ditto', [bundlePath, installedAppPath]);

process.stdout.write(`${installedAppPath}\n`);

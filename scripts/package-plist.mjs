// ABOUTME: Rewrites Electron's template Info.plist into the release metadata Movie Log actually owns.
// ABOUTME: Removes unused privacy declarations so macOS never advertises capabilities the archive does not use.

const unusedPermissionKeys = [
  'NSAudioCaptureUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription'
];

function escapeXmlText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function replacePlistString(contents, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);

  if (!pattern.test(contents)) {
    throw new Error(`Electron Info.plist is missing required string key ${key}.`);
  }

  return contents.replace(pattern, `$1${escapeXmlText(value)}$3`);
}

function removePlistString(contents, key) {
  const pattern = new RegExp(`\\s*<key>${key}</key>\\s*<string>[^<]*</string>`, 'g');
  return contents.replace(pattern, '');
}

function upsertPlistString(contents, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);

  if (pattern.test(contents)) {
    return contents.replace(pattern, `$1${escapeXmlText(value)}$3`);
  }

  const dictionaryEnd = contents.lastIndexOf('</dict>');

  if (dictionaryEnd < 0) {
    throw new Error('Info.plist is missing its root dictionary.');
  }

  return `${contents.slice(0, dictionaryEnd)}  <key>${key}</key>\n  <string>${escapeXmlText(value)}</string>\n${contents.slice(dictionaryEnd)}`;
}

export function rewriteMovieLogInfoPlist(contents, { appIdentifier, appName, iconBaseName, version }) {
  const values = [
    ['CFBundleDisplayName', appName],
    ['CFBundleIconFile', iconBaseName],
    ['CFBundleIdentifier', appIdentifier],
    ['CFBundleName', appName],
    ['CFBundleShortVersionString', version],
    ['CFBundleVersion', version],
    ['LSApplicationCategoryType', 'public.app-category.entertainment']
  ];
  const identified = values.reduce(
    (nextContents, [key, value]) => replacePlistString(nextContents, key, value),
    contents
  );

  const withRemovableVolumePurpose = upsertPlistString(
    identified,
    'NSRemovableVolumesUsageDescription',
    'Movie Log watches folders you choose on removable volumes for new media.'
  );

  return unusedPermissionKeys.reduce(
    (nextContents, key) => removePlistString(nextContents, key),
    withRemovableVolumePurpose
  );
}

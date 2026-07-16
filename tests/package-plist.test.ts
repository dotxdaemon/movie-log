// ABOUTME: Verifies the packaged Movie Log bundle declares only the macOS metadata and permissions it actually uses.
// ABOUTME: Prevents Electron template defaults from leaking developer-tool categorization or unused privacy prompts.
import { describe, expect, it } from 'vitest';
import { rewriteMovieLogInfoPlist } from '../scripts/package-plist.mjs';

const electronTemplatePlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Electron</string>
  <key>CFBundleIconFile</key>
  <string>electron.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.github.Electron</string>
  <key>CFBundleName</key>
  <string>Electron</string>
  <key>CFBundleShortVersionString</key>
  <string>41.0.0</string>
  <key>CFBundleVersion</key>
  <string>41.0.0</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSAudioCaptureUsageDescription</key>
  <string>This app needs access to audio capture</string>
  <key>NSBluetoothAlwaysUsageDescription</key>
  <string>This app needs access to Bluetooth</string>
  <key>NSBluetoothPeripheralUsageDescription</key>
  <string>This app needs access to Bluetooth</string>
  <key>NSCameraUsageDescription</key>
  <string>This app needs access to the camera</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>This app needs access to the microphone</string>
</dict>
</plist>`;

describe('rewriteMovieLogInfoPlist', () => {
  it('uses an entertainment category while preserving the bundle identity, icon, and macOS floor', () => {
    const plist = rewriteMovieLogInfoPlist(electronTemplatePlist, {
      appIdentifier: 'com.seankim.movielog',
      appName: 'Movie Log',
      iconBaseName: 'movie-log',
      version: '1.2.3'
    });

    expect(plist).toContain('<string>public.app-category.entertainment</string>');
    expect(plist).toContain('<string>com.seankim.movielog</string>');
    expect(plist).toContain('<string>movie-log</string>');
    expect(plist).toContain('<string>12.0</string>');
    expect(plist.match(/<string>Movie Log<\/string>/g)).toHaveLength(2);
    expect(plist.match(/<string>1\.2\.3<\/string>/g)).toHaveLength(2);
  });

  it.each([
    'NSAudioCaptureUsageDescription',
    'NSBluetoothAlwaysUsageDescription',
    'NSBluetoothPeripheralUsageDescription',
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription'
  ])('removes the unused %s permission declaration', (key) => {
    expect(
      rewriteMovieLogInfoPlist(electronTemplatePlist, {
        appIdentifier: 'com.seankim.movielog',
        appName: 'Movie Log',
        iconBaseName: 'movie-log',
        version: '1.2.3'
      })
    ).not.toContain(`<key>${key}</key>`);
  });
});

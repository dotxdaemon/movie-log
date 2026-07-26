// ABOUTME: Verifies local packaging signs the fully assembled Movie Log bundle before installation.
// ABOUTME: Prevents a runnable but structurally invalid Electron template signature from being shipped.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageScriptPath = fileURLToPath(new URL('../scripts/package-mac.mjs', import.meta.url));
const releaseWorkflowPath = fileURLToPath(new URL('../.github/workflows/release-main-build.yml', import.meta.url));

describe('macOS package signing', () => {
  it('signs and strictly verifies both the release and installed bundles', async () => {
    const source = await readFile(packageScriptPath, 'utf8');

    expect(source).toContain("'codesign'");
    expect(source).toContain("'--sign', '-'");
    expect(source).toContain("'--verify', '--deep', '--strict'");
    expect(source.indexOf("'--sign', '-'")).toBeGreaterThan(
      source.indexOf("await writeFile(join(bundleAppPath, 'package.json')")
    );
    expect(source.lastIndexOf("'--verify', '--deep', '--strict'")).toBeGreaterThan(
      source.indexOf("await runCommand('ditto', [bundlePath, installedAppPath])")
    );
  });

  it('publishes with Node 24 action runtimes and accurate signing notes', async () => {
    const workflow = await readFile(releaseWorkflowPath, 'utf8');

    expect(workflow).toContain('uses: actions/checkout@v5');
    expect(workflow).toContain('uses: actions/setup-node@v6');
    expect(workflow).toContain('This macOS app is ad hoc signed for bundle integrity.');
    expect(workflow).not.toContain('This macOS app is unsigned.');
  });
});

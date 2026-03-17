// ABOUTME: Verifies the GitHub Actions release workflow publishes the packaged macOS app on each main push.
// ABOUTME: Keeps the workflow aligned with the agreed trigger, verification, archive, and rolling-release rules.
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectDirectory = fileURLToPath(new URL('..', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../..', import.meta.url));
const workflowPath = join(repositoryDirectory, '.github', 'workflows', 'release-main-build.yml');
const misplacedWorkflowPath = join(projectDirectory, '.github', 'workflows', 'release-main-build.yml');

describe('release main build workflow', () => {
  it('publishes a rolling macOS prerelease from main', async () => {
    const workflowSource = await readFile(workflowPath, 'utf8');

    expect(workflowSource).toContain('push:');
    expect(workflowSource).toContain('workflow_dispatch:');
    expect(workflowSource).toContain('- main');
    expect(workflowSource).toContain('macos-latest');
    expect(workflowSource).toContain('contents: write');
    expect(workflowSource).toContain('main-build');
    expect(workflowSource).toContain('Latest main build');
    expect(workflowSource).toContain('Movie-Log-macOS.zip');
    expect(workflowSource).toContain('cache-dependency-path: movie log/package-lock.json');
    expect(workflowSource).toContain('ditto -c -k --sequesterRsrc --keepParent');
    expect(workflowSource).toContain('git tag -f main-build');
    expect(workflowSource).toContain('gh release create');
    expect(workflowSource).toContain('gh release edit');
    expect(workflowSource).toContain('gh release delete-asset');
    expect(workflowSource).toContain('gh release upload');
    expect(workflowSource).toContain('working-directory: movie log');
    expect(workflowSource).toContain("package_version=$(node --input-type=module -e '");
    expect(workflowSource).toContain('echo "PACKAGE_VERSION=${package_version}" >> "$GITHUB_ENV"');

    const verificationCommands = [
      'npm ci',
      'npm test',
      'npm run lint',
      'npm run typecheck',
      'npm run package:mac'
    ];

    let previousCommandIndex = -1;

    for (const command of verificationCommands) {
      const commandIndex = workflowSource.indexOf(command);
      expect(commandIndex).toBeGreaterThan(previousCommandIndex);
      previousCommandIndex = commandIndex;
    }

    await expect(access(misplacedWorkflowPath)).rejects.toThrow();
  });
});

// ABOUTME: Locks Movie Log's desktop navigation contract to honest in-memory views.
// ABOUTME: Prevents fake browser routes from replacing the tested origin-aware back and focus behavior.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../docs/navigation-contract.md', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('desktop navigation contract', () => {
  it('documents in-memory Electron views without claiming URL history or deep links', () => {
    expect(contract).toContain('in-memory application views');
    expect(contract).toContain('URL history, refresh restoration, and browser-style deep links are not supported');
    expect(contract).toContain('returns focus');
    expect(manifest.dependencies).not.toHaveProperty('react-router');
    expect(manifest.dependencies).not.toHaveProperty('react-router-dom');
  });

  it('keeps application-owned view and dossier-origin state in the renderer', () => {
    expect(appSource).toContain("useState<ArchiveView>('diary')");
    expect(appSource).toContain('const [dossierReturnView, setDossierReturnView] = useState');
    expect(appSource).toContain('setDossierReturnView(activeView)');
    expect(appSource).toContain('handleDossierBack');
    expect(appSource).toContain('focusDossierReturnTarget');
  });
});

// ABOUTME: Centralizes Movie Log window show and last-window-close policy behind explicit lifecycle actions.
// ABOUTME: Keeps tray-only, reopen, and quit behavior testable without importing the full Electron runtime.
interface ShowMovieLogActionOptions {
  hasWindow: boolean;
}

interface ShowMovieLogOptions extends ShowMovieLogActionOptions {
  createWindow(): Promise<void>;
  revealWindow(): void;
  startBackgroundWork(): Promise<void>;
}

interface MovieLogWindowsClosedOptions {
  closeMovieLog(): Promise<void>;
  hasStatusItem: boolean;
  isQuitting: boolean;
  pauseBackgroundWork(): Promise<void>;
}

export function readShowMovieLogAction({ hasWindow }: ShowMovieLogActionOptions): 'create-window' | 'reveal-window' {
  return hasWindow ? 'reveal-window' : 'create-window';
}

export async function showMovieLog({
  createWindow,
  hasWindow,
  revealWindow,
  startBackgroundWork
}: ShowMovieLogOptions): Promise<void> {
  await startBackgroundWork();

  if (readShowMovieLogAction({ hasWindow }) === 'create-window') {
    await createWindow();
    return;
  }

  revealWindow();
}

export async function handleMovieLogWindowsClosed({
  closeMovieLog,
  hasStatusItem,
  isQuitting,
  pauseBackgroundWork
}: MovieLogWindowsClosedOptions): Promise<void> {
  if (isQuitting || !hasStatusItem) {
    await closeMovieLog();
    return;
  }

  await pauseBackgroundWork();
}

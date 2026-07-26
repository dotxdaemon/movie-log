// ABOUTME: Centralizes Movie Log window show and last-window-close policy behind explicit lifecycle actions.
// ABOUTME: Keeps tray-only, reopen, and quit behavior testable without importing the full Electron runtime.
interface ShowMovieLogActionOptions {
  hasWindow: boolean;
}

export type WindowActivation = 'active' | 'inactive';

interface ShowMovieLogOptions extends ShowMovieLogActionOptions {
  activation: WindowActivation;
  createWindow(activation: WindowActivation): Promise<void>;
  revealWindow(activation: WindowActivation): void;
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
  activation,
  createWindow,
  hasWindow,
  revealWindow,
  startBackgroundWork
}: ShowMovieLogOptions): Promise<void> {
  await startBackgroundWork();

  if (readShowMovieLogAction({ hasWindow }) === 'create-window') {
    await createWindow(activation);
    return;
  }

  revealWindow(activation);
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

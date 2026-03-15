// ABOUTME: Decides how Movie Log handles window closing and app shutdown.
// ABOUTME: Keeps the macOS close policy testable without importing the Electron app into unit tests.
interface CloseMovieLogOptions {
  disposeFolderMonitor(): Promise<void>;
  quitApp(): void;
  stopScanLoop(): void;
}

interface WindowCloseRequestOptions {
  closeWindow(): void;
  hideWindow(): void;
  isCaptureRun: boolean;
  isQuitting: boolean;
  preventDefault(): void;
}

interface WindowsClosedOptions {
  hasStatusItem: boolean;
  isQuitting: boolean;
}

interface WindowsClosedRequestOptions extends WindowsClosedOptions {
  closeMovieLog(): Promise<void>;
  pauseBackgroundWork(): Promise<void>;
}

export function handleWindowCloseRequest(options: WindowCloseRequestOptions): void {
  if (options.isQuitting || options.isCaptureRun) {
    return;
  }

  options.preventDefault();
  options.closeWindow();
}

export function shouldEndAppAfterWindowsClose({
  hasStatusItem,
  isQuitting
}: WindowsClosedOptions): boolean {
  return isQuitting || !hasStatusItem;
}

export async function handleWindowsClosed({
  closeMovieLog,
  hasStatusItem,
  isQuitting,
  pauseBackgroundWork
}: WindowsClosedRequestOptions): Promise<void> {
  if (shouldEndAppAfterWindowsClose({ hasStatusItem, isQuitting })) {
    await closeMovieLog();
    return;
  }

  await pauseBackgroundWork();
}

export async function closeMovieLog({
  disposeFolderMonitor,
  quitApp,
  stopScanLoop
}: CloseMovieLogOptions): Promise<void> {
  stopScanLoop();
  await disposeFolderMonitor();
  quitApp();
}

// ABOUTME: Stops Movie Log background work when the last desktop window closes.
// ABOUTME: Keeps quitting behavior testable without importing the Electron app into unit tests.
interface CloseMovieLogOptions {
  disposeFolderMonitor(): Promise<void>;
  quitApp(): void;
  stopScanLoop(): void;
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

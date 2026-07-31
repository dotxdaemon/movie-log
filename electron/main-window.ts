// ABOUTME: Creates and loads the single Movie Log BrowserWindow with capture-safe close and failure behavior.
// ABOUTME: Keeps window sizing, renderer loading, and lifecycle hooks out of the Electron app coordinator.
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { CaptureController } from './capture.js';
import { handleWindowCloseRequest } from './window-close.js';
import type { WindowActivation } from './app-lifecycle.js';

interface CreateMovieLogWindowOptions {
  activation: WindowActivation;
  broadcastState(): Promise<void>;
  capture: CaptureController;
  currentDirectory: string;
  enrichCatalog(): Promise<void>;
  exitWithFailure(): void;
  isQuitting(): boolean;
  onClosed(): void;
  onCreated(window: BrowserWindow): void;
}

export async function createMovieLogWindow(options: CreateMovieLogWindowOptions): Promise<BrowserWindow> {
  const { capture, currentDirectory } = options;
  const mainWindow = new BrowserWindow({
    width: capture.isRequested ? capture.width : 1180,
    height: capture.isRequested ? capture.height : 820,
    minWidth: capture.isRequested ? 320 : 390,
    minHeight: 640,
    useContentSize: capture.isRequested,
    backgroundColor: '#f5f3f6',
    show: options.activation === 'active',
    title: 'Movie Log',
    webPreferences: { preload: join(currentDirectory, 'preload.cjs') }
  });
  options.onCreated(mainWindow);

  if (capture.isRequested) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.error(`renderer: ${message}`);
    });
    mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error(`preload-error: ${preloadPath} ${error.message}`);
    });
  }

  mainWindow.webContents.once('did-finish-load', () => {
    void options.broadcastState();
    if (!capture.isReadOnly) {
      void options.enrichCatalog();
    }
    void capture.captureIfRequested(mainWindow).catch((error) => {
      console.error(error);
      options.exitWithFailure();
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const rendererUrl = new URL(process.env.VITE_DEV_SERVER_URL);

    if (capture.isRequested) {
      rendererUrl.searchParams.set('capture', capture.rendererQuery);
    }

    await mainWindow.loadURL(rendererUrl.toString());
  } else {
    await mainWindow.loadFile(
      join(currentDirectory, '../dist/index.html'),
      capture.isRequested ? { query: { capture: capture.rendererQuery } } : undefined
    );
  }

  mainWindow.on('close', (event) => {
    handleWindowCloseRequest({
      closeWindow: () => mainWindow.destroy(),
      hideWindow: () => mainWindow.hide(),
      isCaptureRun: capture.isRequested,
      isQuitting: options.isQuitting(),
      preventDefault: () => event.preventDefault()
    });
  });
  mainWindow.on('closed', options.onClosed);
  return mainWindow;
}

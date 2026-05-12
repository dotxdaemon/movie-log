// ABOUTME: Extends the browser window with the preload bridge used by the Electron renderer.
// ABOUTME: Makes the renderer aware of the IPC methods available at runtime.
import type { MovieLogApi } from '../shared/types.js';

declare global {
  interface Window {
    movieLog: MovieLogApi;
  }
}

export {};

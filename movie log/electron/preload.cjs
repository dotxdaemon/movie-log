// ABOUTME: Exposes the Electron IPC bridge that the React renderer uses for local desktop actions.
// ABOUTME: Keeps file-path lookup, watched-folder actions, and live state updates inside a safe preload API.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('movieLog', {
  addWatchedFolders: () => ipcRenderer.invoke('movie-log:add-watched-folders'),
  clearHistory: () => ipcRenderer.invoke('movie-log:clear-history'),
  copyPath: (itemPath) => ipcRenderer.invoke('movie-log:copy-path', itemPath),
  getDataFilePath: () => ipcRenderer.invoke('movie-log:get-data-file-path'),
  getNoteFilePath: () => ipcRenderer.invoke('movie-log:get-note-file-path'),
  getState: () => ipcRenderer.invoke('movie-log:get-state'),
  logPaths: (paths) => ipcRenderer.invoke('movie-log:log-paths', paths),
  openInFinder: (itemPath) => ipcRenderer.invoke('movie-log:open-in-finder', itemPath),
  openItem: (itemPath) => ipcRenderer.invoke('movie-log:open-item', itemPath),
  pathForFile: (file) => webUtils.getPathForFile(file),
  removeWatchedFolder: (id) => ipcRenderer.invoke('movie-log:remove-watched-folder', id),
  scanNow: () => ipcRenderer.invoke('movie-log:scan-now'),
  subscribe: (listener) => {
    const wrappedListener = (_event, state) => {
      listener(state);
    };

    ipcRenderer.on('movie-log:state-changed', wrappedListener);

    return () => {
      ipcRenderer.removeListener('movie-log:state-changed', wrappedListener);
    };
  }
});

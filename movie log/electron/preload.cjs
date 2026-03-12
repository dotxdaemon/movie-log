// ABOUTME: Exposes the Electron IPC bridge that the React renderer uses for local desktop actions.
// ABOUTME: Keeps file-path lookup, watched-folder actions, and live state updates inside a safe preload API.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('movieLog', {
  getState: () => ipcRenderer.invoke('movie-log:get-state'),
  logPaths: (paths) => ipcRenderer.invoke('movie-log:log-paths', paths),
  pathForFile: (file) => webUtils.getPathForFile(file),
  pickWatchedFolder: () => ipcRenderer.invoke('movie-log:pick-watched-folder'),
  removeWatchedFolder: (id) => ipcRenderer.invoke('movie-log:remove-watched-folder', id),
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

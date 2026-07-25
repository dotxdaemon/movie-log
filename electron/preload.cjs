// ABOUTME: Exposes the Electron IPC bridge that the React renderer uses for local desktop actions.
// ABOUTME: Keeps file-path lookup, watched-folder actions, and live state updates inside a safe preload API.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('movieLog', {
  addWatchedFolders: () => ipcRenderer.invoke('movie-log:add-watched-folders'),
  chooseLogPaths: () => ipcRenderer.invoke('movie-log:choose-log-paths'),
  copyPath: (itemPath) => ipcRenderer.invoke('movie-log:copy-path', itemPath),
  getDataFilePath: () => ipcRenderer.invoke('movie-log:get-data-file-path'),
  getNoteFilePath: () => ipcRenderer.invoke('movie-log:get-note-file-path'),
  getState: () => ipcRenderer.invoke('movie-log:get-state'),
  logFilm: (film, details) => ipcRenderer.invoke('movie-log:log-film', film, details),
  logPaths: (paths, details, film) => ipcRenderer.invoke('movie-log:log-paths', paths, details, film),
  matchFilm: (filmKey, film, selection) => ipcRenderer.invoke('movie-log:match-film', filmKey, film, selection),
  searchCatalog: (query) => ipcRenderer.invoke('movie-log:search-catalog', query),
  openInFinder: (itemPath) => ipcRenderer.invoke('movie-log:open-in-finder', itemPath),
  openItem: (itemPath) => ipcRenderer.invoke('movie-log:open-item', itemPath),
  pathForFile: (file) => webUtils.getPathForFile(file),
  removeWatchedFolder: (id) => ipcRenderer.invoke('movie-log:remove-watched-folder', id),
  retryFilmEnrichment: () => ipcRenderer.invoke('movie-log:retry-film-enrichment'),
  scanNow: () => ipcRenderer.invoke('movie-log:scan-now'),
  updateEntry: (entryId, details) => ipcRenderer.invoke('movie-log:update-entry', entryId, details),
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

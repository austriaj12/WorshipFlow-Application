const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  notifyAppReady: () => ipcRenderer.send('app-ready'),
  // Slide Synchronization Control
  sendSlideUpdate: (slideData) => {
    ipcRenderer.send('slide-update-send', slideData);
  },
  
  onSlideRender: (callback) => {
    ipcRenderer.removeAllListeners('slide-update-receive');
    ipcRenderer.on('slide-update-receive', (event, slideData) => {
      callback(slideData);
    });
  },

  // SQLite Database Layer Operations
  getAllSongs: () => ipcRenderer.invoke('db:get-all-songs'),
  
  searchSongs: (query) => ipcRenderer.invoke('db:search-songs', query),
  
  getSong: (songId) => ipcRenderer.invoke('db:get-song', songId),
  
  saveSong: (songData) => ipcRenderer.invoke('db:save-song', songData), // { id, title, author, key, tempo, contentJson }
  
  deleteSong: (songId) => ipcRenderer.invoke('db:delete-song', songId),
  
  queryBible: (translation, bookName, chapter, startVerse, endVerse) => 
    ipcRenderer.invoke('db:query-bible', { translation, bookName, chapter, startVerse, endVerse }),

  // Bible Menu API
  getBibleTranslations: () => ipcRenderer.invoke('bible:get-translations'),
  getBibleBooks: (translation) => ipcRenderer.invoke('bible:get-books', translation),
  getBibleChapters: (translation, bookName) => ipcRenderer.invoke('bible:get-chapters', translation, bookName),
  getBibleVerses: (translation, bookName, chapter) => ipcRenderer.invoke('bible:get-verses', translation, bookName, chapter),
  searchBibleText: (translation, keyword) => ipcRenderer.invoke('bible:search-text', translation, keyword),
  addBibleFavorite: (translation, bookName, chapter, startVerse, endVerse, label) => 
    ipcRenderer.invoke('bible:add-favorite', translation, bookName, chapter, startVerse, endVerse, label),
  removeBibleFavorite: (id) => ipcRenderer.invoke('bible:remove-favorite', id),
  getBibleFavorites: () => ipcRenderer.invoke('bible:get-favorites'),
  addBibleHistory: (translation, bookName, chapter, startVerse, endVerse) => 
    ipcRenderer.invoke('bible:add-history', translation, bookName, chapter, startVerse, endVerse),
  getBibleHistory: (limit) => ipcRenderer.invoke('bible:get-history', limit),
  clearBibleHistory: () => ipcRenderer.invoke('bible:clear-history'),

  // Media Library & File Picker operations
  getMedia: () => ipcRenderer.invoke('db:get-media'),
  createMedia: (mediaData) => ipcRenderer.invoke('db:create-media', mediaData),
  deleteMedia: (mediaId) => ipcRenderer.invoke('db:delete-media', mediaId),
  selectLocalFile: () => ipcRenderer.invoke('media:select-file'),
  getFileSize: (filepath) => ipcRenderer.invoke('media:get-size', filepath),
  selectDirectory: () => ipcRenderer.invoke('media:select-directory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('media:read-directory', dirPath),

  // Song creation convenience (used by operator for blank slides/scripture)
  createSong: (songData) => ipcRenderer.invoke('app:create-song', songData),

  // Projector Window Controls
  toggleProjector: (displayIndex) => ipcRenderer.invoke('window:toggle-projector', displayIndex),
  getProjectorStatus: () => ipcRenderer.invoke('window:get-projector-status'),
  // Stage Display Window Controls
  openStage: (displayIndex) => ipcRenderer.invoke('window:open-stage', displayIndex),
  closeStage: () => ipcRenderer.invoke('window:close-stage'),
  getStageStatus: () => ipcRenderer.invoke('window:get-stage-status'),
  getDisplays: () => ipcRenderer.invoke('system:get-displays'),

  // Playlist / Service Flow Operations
  getPlaylist: () => ipcRenderer.invoke('db:get-playlist'),
  
  addToPlaylist: (playlistData) => ipcRenderer.invoke('db:playlist-add', playlistData),
  
  removeFromPlaylist: (playlistId) => ipcRenderer.invoke('db:playlist-remove', playlistId),
  
  reorderPlaylist: (items) => ipcRenderer.invoke('db:playlist-reorder', items),
  clearPlaylist: () => ipcRenderer.invoke('db:playlist-clear'),
  importPlaylist: (items) => ipcRenderer.invoke('db:playlist-import', items),
  
  // Custom Window Title bar customization
  updateTitleBar: (config) => ipcRenderer.send('window:update-titlebar', config),

  // File Presentation Open / Save Operations
  savePresentation: (playlistData, filePath) => ipcRenderer.invoke('media:save-presentation', { playlistData, filePath }),
  openPresentation: () => ipcRenderer.invoke('media:open-presentation'),
  
  // PPTX and PDF imports
  importPowerPoint: () => ipcRenderer.invoke('media:import-powerpoint'),
  importPDF: () => ipcRenderer.invoke('media:import-pdf'),
  savePdfPages: (data) => ipcRenderer.invoke('media:save-pdf-pages', data),

  // Stage update channel (send from operator -> main -> stage window)
  sendStageUpdate: (slideData) => ipcRenderer.send('stage-update-send', slideData),
  onStageRender: (callback) => {
    ipcRenderer.removeAllListeners('stage-update-receive');
    ipcRenderer.on('stage-update-receive', (event, slideData) => callback(slideData));
  },
  onProjectorStatusChange: (callback) => ipcRenderer.on('window:projector-status-change', (event, status) => callback(status)),
  onRemoteCommand: (callback) => {
    ipcRenderer.removeAllListeners('remote-command');
    ipcRenderer.on('remote-command', (event, data) => callback(data));
  },
  onDisplaysChanged: (callback) => {
    ipcRenderer.removeAllListeners('displays-changed');
    ipcRenderer.on('displays-changed', () => callback());
  },

  // Updates & Auto-updater API
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkUpdate: () => ipcRenderer.invoke('system:check-update'),
  installUpdate: (url, fileName) => ipcRenderer.invoke('system:install-update', { downloadUrl: url, fileName }),
  onUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
  },

  // Song Library Export / Import (for USB transfer between computers)
  exportSongs: () => ipcRenderer.invoke('db:export-songs'),
  importSongs: () => ipcRenderer.invoke('db:import-songs'),

  // Native dialog box
  showMessageBox: (options) => ipcRenderer.invoke('dialog:show-message-box', options),
});

// Server controls for Stage Display and Mobile Remotes
contextBridge.exposeInMainWorld('stageServer', {
  start: (port) => ipcRenderer.invoke('server:start-stage-server', port),
  stop: () => ipcRenderer.invoke('server:stop-stage-server'),
  getUrl: () => ipcRenderer.invoke('server:get-stage-server-url'),
  getRemoteUrl: () => ipcRenderer.invoke('server:get-remote-url')
});

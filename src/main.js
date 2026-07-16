const { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database');

// Ensure video/audio items can autoplay immediately and unmute without blocking
// Enable Chromium Hardware Acceleration & GPU Optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let splashWindow = null;
let operatorWindow = null;
let projectorWindow = null;
let stageWindow = null;
let lastSlideData = null;
let lastStageData = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Create the Splash Screen Window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 580,
    height: 360,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

// Create the Operator Panel Control Window
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minimizable: true,
    maximizable: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1C1C1C',
      symbolColor: '#E2E8F0',
      height: 48
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    title: "WorshipFlow",
    backgroundColor: "#121212",
    show: false
  });

  if (isDev) {
    operatorWindow.loadURL('http://localhost:5173');
    operatorWindow.webContents.openDevTools();
  } else {
    operatorWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  ipcMain.once('app-ready', () => {
    // Keep splash screen visible for a minimum of 5 seconds to pre-load assets in the background
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      setTimeout(() => {
        if (operatorWindow && !operatorWindow.isDestroyed()) {
          operatorWindow.show();
          operatorWindow.maximize();
        }
      }, 350);
    }, 5000);
  });

  operatorWindow.on('close', (e) => {
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(operatorWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Exit Confirmation',
      message: 'Are you sure you want to close WorshipFlow?',
      defaultId: 1,
      cancelId: 1
    });

    if (choice === 0) {
      operatorWindow.destroy(); // bypass the interceptor to close cleanly
    }
  });

  operatorWindow.on('closed', () => {
    operatorWindow = null;
    // Terminate application and close all other windows
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.destroy();
      projectorWindow = null;
    }
    if (stageWindow && !stageWindow.isDestroyed()) {
      stageWindow.destroy();
      stageWindow = null;
    }
    app.quit();
  });
}

// Create the Projector Window on demand (does not open automatically)
function createProjectorWindow(displayIndex) {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const idx = typeof displayIndex === 'number' ? displayIndex : parseInt(displayIndex, 10);
  
  let targetDisplay = null;
  if (!isNaN(idx) && idx >= 0 && idx < displays.length) {
    targetDisplay = displays[idx];
  } else {
    targetDisplay = displays.find((display) => {
      return display.bounds.x !== 0 || display.bounds.y !== 0;
    }) || displays[0];
  }

  const bounds = targetDisplay ? targetDisplay.bounds : { x: 0, y: 0, width: 1920, height: 1080 };
  const isMultiDisplay = displays.length > 1;

  projectorWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    fullscreen: false,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    skipTaskbar: false,
    resizable: false,
    movable: false,
    alwaysOnTop: false, // Ensure Alt-Tabbing is never blocked under any configuration
    minimizeOnFocusLoss: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    title: "WorshipFlow - Projector Screen",
    backgroundColor: "#000000"
  });

  // Explicitly set bounds and set fullscreen to force correct monitor target
  projectorWindow.setBounds(bounds);
  projectorWindow.setFullScreen(true);

  if (operatorWindow && !operatorWindow.isDestroyed()) {
    operatorWindow.webContents.send('window:projector-status-change', true);
  }

  if (isDev) {
    projectorWindow.loadURL('http://localhost:5173/projector.html');
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/projector.html'));
  }

  projectorWindow.webContents.on('did-finish-load', () => {
    if (lastSlideData) {
      projectorWindow.webContents.send('slide-update-receive', lastSlideData);
    }
  });

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    if (operatorWindow && !operatorWindow.isDestroyed()) {
      operatorWindow.webContents.send('window:projector-status-change', false);
    }
  });
}

// Create the Stage Display Window (separate from audience projector)
function createStageWindow(displayIndex) {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const idx = typeof displayIndex === 'number' ? displayIndex : parseInt(displayIndex, 10);
  
  let targetDisplay = null;
  if (!isNaN(idx) && idx >= 0 && idx < displays.length) {
    targetDisplay = displays[idx];
  } else {
    targetDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];
  }

  const bounds = targetDisplay ? targetDisplay.bounds : { x: 0, y: 0, width: 1920, height: 1080 };

  stageWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    fullscreen: false,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'logo.png'),
    skipTaskbar: false,
    resizable: false,
    movable: false,
    alwaysOnTop: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    title: "WorshipFlow - Stage Display",
    backgroundColor: "#000000"
  });

  // Explicitly set bounds and set fullscreen to force correct monitor target
  stageWindow.setBounds(bounds);
  stageWindow.setFullScreen(true);

  if (isDev) {
    stageWindow.loadURL('http://localhost:5173/stage.html');
  } else {
    stageWindow.loadFile(path.join(__dirname, '../dist/stage.html'));
  }

  stageWindow.webContents.on('did-finish-load', () => {
    if (lastStageData) {
      stageWindow.webContents.send('stage-update-receive', lastStageData);
    }
  });

  stageWindow.on('closed', () => {
    stageWindow = null;
  });
}

// IPC Window Controls
ipcMain.handle('window:toggle-projector', (event, displayIndex) => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
    projectorWindow = null;
    return false; // Projector is now closed
  } else {
    createProjectorWindow(displayIndex);
    return true; // Projector is now open
  }
});

ipcMain.handle('system:get-displays', () => {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  return displays.map((d, index) => ({
    id: d.id,
    index: index,
    label: d.label || `Display ${index + 1} (${d.bounds.width}x${d.bounds.height})`,
    isPrimary: d.id === primaryId,
    bounds: d.bounds
  }));
});

// Stage Window IPC handlers
ipcMain.handle('window:open-stage', (event, displayIndex) => {
  try {
    createStageWindow(displayIndex);
    return true;
  } catch (err) {
    console.error('Failed to open stage window:', err);
    return false;
  }
});

ipcMain.handle('server:start-stage-server', (event, port) => {
  try {
    const p = startStageServer(port || 5174);
    const ip = getLocalIpAddress();
    return { success: true, url: `http://${ip}:${p}/stage.html` };
  } catch (err) {
    console.error('Failed to start stage server:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:stop-stage-server', () => {
  try {
    stopStageServer();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:get-stage-server-url', () => {
  if (stageServerPort) {
    const ip = getLocalIpAddress();
    return { url: `http://${ip}:${stageServerPort}/stage.html` };
  }
  return { url: null };
});

ipcMain.handle('server:get-remote-url', () => {
  const ip = getLocalIpAddress();
  const port = stageServerPort || 5174;
  return {
    ip,
    port,
    url: `http://${ip}:${port}/remote.html`
  };
});

ipcMain.handle('window:close-stage', () => {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
    stageWindow = null;
    return false;
  }
  return true;
});

ipcMain.handle('window:get-stage-status', () => {
  return !!(stageWindow && !stageWindow.isDestroyed());
});

ipcMain.handle('window:get-projector-status', () => {
  return !!(projectorWindow && !projectorWindow.isDestroyed());
});

// IPC event forwarders for slide states
ipcMain.on('slide-update-send', (event, slideData) => {
  lastSlideData = slideData;
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send('slide-update-receive', slideData);
  }
  broadcastToWss({ type: 'slide-update', payload: slideData });
});

// Forward stage updates
ipcMain.on('stage-update-send', (event, slideData) => {
  lastStageData = slideData;
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.webContents.send('stage-update-receive', slideData);
  }
  broadcastToWss({ type: 'stage-update', payload: slideData });
});

// Update window controls color overlay to match UI themes dynamically
ipcMain.on('window:update-titlebar', (event, { color, symbolColor }) => {
  if (operatorWindow && !operatorWindow.isDestroyed() && operatorWindow.setTitleBarOverlay) {
    operatorWindow.setTitleBarOverlay({ color, symbolColor });
  }
});

// Phase 2: Asynchronous IPC Database Handlers (ipcMain.handle)

// Native message/dialog box for Save prompts etc.
ipcMain.handle('dialog:show-message-box', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(win, options);
  return result.response; // 0 = first button, 1 = second, etc.
});

ipcMain.handle('db:get-all-songs', async () => {
  return await db.getAllSongs();
});

ipcMain.handle('db:search-songs', async (event, query) => {
  return await db.searchSongs(query);
});

ipcMain.handle('db:get-song', async (event, songId) => {
  return await db.getSongWithContent(songId);
});

ipcMain.handle('db:save-song', async (event, { id, title, author, key, tempo, contentJson }) => {
  return await db.saveSong(id, title, author, key, tempo, contentJson);
});

ipcMain.handle('db:delete-song', async (event, songId) => {
  return await db.deleteSong(songId);
});

ipcMain.handle('db:query-bible', async (event, { translation, bookName, chapter, startVerse, endVerse }) => {
  return await db.queryBible(translation, bookName, chapter, startVerse, endVerse);
});

ipcMain.handle('bible:get-translations', async () => {
  return await db.getAvailableTranslations();
});

ipcMain.handle('bible:get-books', async (event, translation) => {
  return await db.getBibleBooks(translation);
});

ipcMain.handle('bible:get-chapters', async (event, translation, bookName) => {
  return await db.getBibleChapters(translation, bookName);
});

ipcMain.handle('bible:get-verses', async (event, translation, bookName, chapter) => {
  return await db.getBibleVerses(translation, bookName, chapter);
});

ipcMain.handle('bible:search-text', async (event, translation, keyword) => {
  return await db.searchBibleText(translation, keyword);
});

ipcMain.handle('bible:add-favorite', async (event, translation, bookName, chapter, startVerse, endVerse, label) => {
  return await db.addBibleFavorite(translation, bookName, chapter, startVerse, endVerse, label);
});

ipcMain.handle('bible:remove-favorite', async (event, id) => {
  return await db.removeBibleFavorite(id);
});

ipcMain.handle('bible:get-favorites', async () => {
  return await db.getBibleFavorites();
});

ipcMain.handle('bible:add-history', async (event, translation, bookName, chapter, startVerse, endVerse) => {
  return await db.addBibleHistory(translation, bookName, chapter, startVerse, endVerse);
});

ipcMain.handle('bible:get-history', async (event, limit) => {
  return await db.getBibleHistory(limit);
});

ipcMain.handle('bible:clear-history', async () => {
  return await db.clearBibleHistory();
});

ipcMain.handle('db:get-playlist', async () => {
  return await db.getPlaylist();
});

ipcMain.handle('db:playlist-add', async (event, { name, type, songId }) => {
  return await db.addToPlaylist(name, type, songId);
});

ipcMain.handle('db:playlist-remove', async (event, playlistId) => {
  return await db.removeFromPlaylist(playlistId);
});

ipcMain.handle('db:playlist-clear', async () => {
  return await db.clearPlaylist();
});

ipcMain.handle('db:playlist-import', async (event, items) => {
  return await db.importPlaylist(items);
});

ipcMain.handle('db:playlist-reorder', async (event, items) => {
  return await db.updatePlaylistOrder(items);
});

// Song Library Export: save all songs to a .wfl-songs JSON file chosen by user
ipcMain.handle('db:export-songs', async () => {
  try {
    const songs = await db.getAllSongs();
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Song Library',
      defaultPath: `WorshipFlow-Songs-${new Date().toISOString().slice(0,10)}.wfl-songs`,
      filters: [{ name: 'WorshipFlow Song Library', extensions: ['wfl-songs'] }, { name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    await fs.promises.writeFile(filePath, JSON.stringify({ version: 1, songs }, null, 2), 'utf8');
    return { success: true, filePath, count: songs.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Song Library Import: load songs from a .wfl-songs JSON file, merge with existing library
ipcMain.handle('db:import-songs', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Song Library',
      filters: [{ name: 'WorshipFlow Song Library', extensions: ['wfl-songs', 'json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return { success: false, canceled: true };
    const raw = await fs.promises.readFile(filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    const songs = Array.isArray(data) ? data : (data.songs || []);
    let imported = 0;
    for (const song of songs) {
      try {
        await db.saveSong(null, song.title, song.author || '', song.key || '', song.tempo || '', song.content_json || '[]');
        imported++;
      } catch (e) { /* skip duplicates or errors */ }
    }
    return { success: true, count: imported };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Media Library SQLite handlers
ipcMain.handle('db:get-media', async () => {
  return await db.getMedia();
});

ipcMain.handle('db:create-media', async (event, { name, type, filepath }) => {
  return await db.createMedia(name, type, filepath);
});

ipcMain.handle('db:delete-media', async (event, mediaId) => {
  return await db.deleteMedia(mediaId);
});

// Native Windows File Dialog Open handler
ipcMain.handle('media:select-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'WorshipFlow - Select Background Media',
    properties: ['openFile'],
    filters: [
      { name: 'Images & Video loops', extensions: ['jpg', 'png', 'jpeg', 'mp4', 'webm', 'mov', 'avi', 'gif'] }
    ]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0]; // Absolute local path to file
});

ipcMain.handle('media:get-size', async (event, filepath) => {
  const fs = require('fs');
  try {
    const stats = fs.statSync(filepath);
    return stats.size;
  } catch (e) {
    console.error('Failed to get file size:', e);
    return 0;
  }
});

// Native Windows Directory picker
ipcMain.handle('media:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'WorshipFlow - Select Directory',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0]; // Returns path like D:\Alab Worship\assets\backgrounds
});

ipcMain.handle('media:save-presentation', async (event, { playlistData, filePath }) => {
  try {
    let targetPath = filePath;
    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Save WorshipFlow Presentation',
        defaultPath: 'presentation.wflow',
        filters: [
          { name: 'WorshipFlow Presentation', extensions: ['wflow', 'json'] }
        ]
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      targetPath = result.filePath;
    }
    
    await fs.promises.writeFile(targetPath, JSON.stringify(playlistData, null, 2), 'utf8');
    return { success: true, filePath: targetPath };
  } catch (err) {
    console.error('Failed to save presentation file:', err);
    return { success: false, error: err.message };
  }
});

// Convenience handler: create a new song entry from renderer
ipcMain.handle('app:create-song', async (event, { title, author, key, tempo, contentJson }) => {
  try {
    const song = await db.saveSong(null, title, author || 'WorshipFlow', key || '', tempo || '', contentJson || '[]');
    return song;
  } catch (err) {
    console.error('Failed to create song:', err);
    return null;
  }
});

ipcMain.handle('media:open-presentation', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Open WorshipFlow Presentation',
      properties: ['openFile'],
      filters: [
        { name: 'WorshipFlow Presentation', extensions: ['wflow', 'json'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf8');
    const playlistData = JSON.parse(content);
    return { playlistData, filePath, success: true };
  } catch (err) {
    console.error('Failed to open presentation file:', err);
    return { success: false, error: err.message };
  }
});

// Read files and directories inside selected path
ipcMain.handle('media:read-directory', async (event, dirPath) => {
  try {
    let targetPath = dirPath;
    if (!targetPath) {
      targetPath = app.getPath('pictures') || app.getPath('home');
    }
    if (!fs.existsSync(targetPath)) {
      return { currentPath: targetPath, items: [] };
    }
    
    const parentPath = path.dirname(targetPath);
    const isRoot = parentPath === targetPath;
    
    const files = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const items = [];
    
    // Add Go Up item if not at system root
    if (!isRoot) {
      items.push({
        id: '..',
        name: '..',
        type: 'directory',
        filepath: parentPath
      });
    }
    
    const directories = [];
    const mediaFiles = [];
    
    // Filter out system folders and hidden files to save stat operations and look clean
    const visibleFiles = files.filter(file => !file.name.startsWith('.') && !file.name.startsWith('$'));

    await Promise.all(visibleFiles.map(async (file) => {
      const fullPath = path.join(targetPath, file.name);
      let mtime = 0;
      try {
        const stats = await fs.promises.stat(fullPath);
        mtime = stats.mtimeMs;
      } catch (e) {
        // Fallback if stat fails
      }

      if (file.isDirectory()) {
        directories.push({
          id: file.name,
          name: file.name,
          type: 'directory',
          filepath: fullPath,
          mtime
        });
      } else if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
          const isVideo = ['.mp4', '.webm', '.mov', '.avi'].includes(ext);
          mediaFiles.push({
            id: file.name,
            name: file.name,
            type: isVideo ? 'video' : 'image',
            filepath: `file:///${fullPath.replace(/\\/g, '/')}`,
            mtime
          });
        }
      }
    }));
    
    // Sort both groups by modified date (newest first)
    directories.sort((a, b) => b.mtime - a.mtime);
    mediaFiles.sort((a, b) => b.mtime - a.mtime);
    
    // Combine items: "Go Up" item (if exists) -> Sorted Folders -> Sorted Files
    const sortedItems = [...items, ...directories, ...mediaFiles];
    
    return { currentPath: targetPath, items: sortedItems };
  } catch (err) {
    console.error('Failed to read background directory:', err);
    return { currentPath: dirPath, items: [] };
  }
});

// PowerShell runner helper
const { exec } = require('child_process');

// Simple static server for serving stage HTML over local network (production fallback)
let stageServer = null;
let stageServerPort = 0;
const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');
let wss = null;
let wssClients = new Set();

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = '127.0.0.1';
  let candidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /wsl|vethernet|virtual|vbox|vmware|loopback|pseudo/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          if (/wi-fi|wlan|wireless/i.test(name)) {
            return iface.address;
          }
          candidates.push(iface.address);
        } else {
          fallbackIp = iface.address;
        }
      }
    }
  }

  if (candidates.length > 0) {
    return candidates[0];
  }
  return fallbackIp;
}

function broadcastToWss(msg) {
  const data = JSON.stringify(msg);
  for (const client of wssClients) {
    if (client.readyState === 1) { // OPEN
      try { client.send(data); } catch (e) {}
    }
  }
}

function startStageServer(port = 5174) {
  if (stageServer) return stageServerPort;
  const rootDir = isDev ? path.join(__dirname, '..', 'src') : path.join(__dirname, '..', 'dist');
  
  stageServer = http.createServer((req, res) => {
    try {
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/' || urlPath === '') urlPath = '/stage.html';

      // Serve local assets from absolute filesystem paths (useful for mobile clients loading media/slide thumbnails)
      if (urlPath.startsWith('/local-asset/')) {
        let localPath = decodeURIComponent(urlPath.slice('/local-asset/'.length));
        localPath = path.normalize(localPath);
        let resolvedPath = localPath;
        if (!path.isAbsolute(resolvedPath)) {
          resolvedPath = path.join(__dirname, '..', localPath);
        }
        if (fs.existsSync(resolvedPath)) {
          const ext = path.extname(resolvedPath).toLowerCase();
          const contentType = mime[ext] || 'application/octet-stream';
          try {
            const data = fs.readFileSync(resolvedPath);
            res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
            res.end(data);
            return;
          } catch (e) {}
        }
        res.writeHead(404);
        res.end('Local asset not found');
        return;
      }

      if (isDev) {
        // Proxy requests to Vite dev server in development
        const proxyReq = http.request({
          host: '127.0.0.1',
          port: 5173,
          path: req.url,
          method: req.method,
          headers: req.headers
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (err) => {
          // Fall back to pre-built dist folder if Vite dev server is not running
          const distDir = path.join(__dirname, '..', 'dist');
          const filePath = path.join(distDir, decodeURIComponent(urlPath.replace(/^\//, '')));
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mime[ext] || 'application/octet-stream';
            try {
              const data = fs.readFileSync(filePath);
              res.writeHead(200, { 'Content-Type': contentType });
              res.end(data);
              return;
            } catch (e) {}
          }
          res.writeHead(500);
          res.end('Dev server proxy error: ' + err.message);
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      const filePath = path.join(rootDir, decodeURIComponent(urlPath.replace(/^\//, '')));
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mime[ext] || 'application/octet-stream';
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch (err) {
      res.writeHead(500);
      res.end('Server error');
    }
  });

  stageServer.listen(port, '0.0.0.0');
  stageServerPort = port;

  // Initialize WebSocket server attached to the HTTP server
  wss = new WebSocketServer({ server: stageServer });
  wss.on('connection', (ws) => {
    wssClients.add(ws);
    
    // Send current states
    if (lastSlideData) {
      ws.send(JSON.stringify({ type: 'slide-update', payload: lastSlideData }));
    }
    if (lastStageData) {
      ws.send(JSON.stringify({ type: 'stage-update', payload: lastStageData }));
    }
    
    // Send current playlist order
    db.getPlaylist().then(playlist => {
      ws.send(JSON.stringify({ type: 'playlist-update', payload: playlist }));
    }).catch(err => console.error(err));

    ws.on('message', async (messageStr) => {
      try {
        const message = JSON.parse(messageStr);
        
        if (message.type === 'remote-command') {
          if (operatorWindow && !operatorWindow.isDestroyed()) {
            operatorWindow.webContents.send('remote-command', message.payload);
          }
        } 
        else if (message.type === 'remote-bible-search') {
          const query = message.payload.query || '';
          const translation = message.payload.translation || 'KJV';
          
          let results = [];
          const refRegex = /^(\d?\s?[A-Za-z\s]+)\s?(\d+)(?:[:.]?(\d+))?(?:[-–]?(\d+))?$/i;
          const match = query.trim().match(refRegex);
          
          if (match) {
            const bookName = match[1].trim();
            const chapter = parseInt(match[2]);
            const startVerse = match[3] ? parseInt(match[3]) : 1;
            const endVerse = match[4] ? parseInt(match[4]) : (match[3] ? parseInt(match[3]) : 999);
            
            try {
              results = await db.queryBible(translation, bookName, chapter, startVerse, endVerse);
            } catch (err) {
              console.error(err);
            }
          }
          
          if (results.length === 0) {
            try {
              results = await new Promise((resolve, reject) => {
                db.db.all(
                  `SELECT book_name, chapter, verse, text, translation 
                   FROM bibles 
                   WHERE text LIKE ? AND translation = ? 
                   LIMIT 50`,
                  [`%${query}%`, translation],
                  (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                  }
                );
              });
            } catch (err) {
              console.error(err);
            }
          }
          
          ws.send(JSON.stringify({
            type: 'remote-bible-results',
            payload: { query, results }
          }));
        }
        else if (message.type === 'remote-song-search') {
          const query = message.payload.query || '';
          try {
            const allResults = await db.searchSongs(query);
            const results = (allResults || []).filter(s => s.author !== 'Media');
            ws.send(JSON.stringify({
              type: 'remote-song-results',
              payload: { query, results }
            }));
          } catch (err) {
            console.error('Failed to search songs from remote:', err);
          }
        }
        else if (message.type === 'remote-get-bible-books') {
          const translation = message.payload.translation || 'KJV';
          try {
            const books = await db.getBibleBooks(translation);
            ws.send(JSON.stringify({
              type: 'remote-bible-books',
              payload: { books }
            }));
          } catch (err) {
            console.error('Failed to get bible books for remote:', err);
          }
        }
        else if (message.type === 'remote-get-bible-verses') {
          const { translation, bookName, chapter } = message.payload;
          try {
            const verses = await db.getBibleVerses(translation, bookName, chapter);
            ws.send(JSON.stringify({
              type: 'remote-bible-verses',
              payload: { translation, bookName, chapter, verses }
            }));
          } catch (err) {
            console.error('Failed to get bible verses for remote:', err);
          }
        }
        else if (message.type === 'remote-get-bible-chapters') {
          const { translation, bookName } = message.payload;
          try {
            const chapters = await db.getBibleChapters(translation, bookName);
            ws.send(JSON.stringify({
              type: 'remote-bible-chapters',
              payload: { translation, bookName, chapters }
            }));
          } catch (err) {
            console.error('Failed to get bible chapters for remote:', err);
          }
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      wssClients.delete(ws);
    });
  });

  return stageServerPort;
}

function stopStageServer() {
  if (wss) {
    try { wss.close(); } catch (e) {}
    wss = null;
  }
  wssClients.clear();
  if (!stageServer) return;
  try { stageServer.close(); } catch (e) {}
  stageServer = null;
  stageServerPort = 0;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const tempScriptPath = path.join(app.getPath('temp'), `wflow_run_${Date.now()}.ps1`);
    fs.writeFileSync(tempScriptPath, script, 'utf8');
    
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempScriptPath); } catch(e){}
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// PowerPoint presentation file importer
ipcMain.handle('media:import-powerpoint', async () => {
  const result = await dialog.showOpenDialog(operatorWindow, {
    title: 'WorshipFlow - Select PowerPoint Presentation',
    filters: [{ name: 'PowerPoint Files', extensions: ['pptx', 'ppt'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return { success: false };
  const filePath = result.filePaths[0];
  const title = path.basename(filePath, path.extname(filePath));

  const outputDir = path.join(app.getPath('userData'), 'imports', `ppt_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const safeFilePath = filePath.replace(/'/g, "''");
  const safeOutputDir = outputDir.replace(/'/g, "''");

  const psScript = `
$ErrorActionPreference = 'Stop'
try {
    $ppt = New-Object -ComObject PowerPoint.Application
} catch {
    Write-Error "Could not create PowerPoint COM object. Microsoft PowerPoint may not be installed or COM interface is not registered."
    exit 1
}
try {
    # Unblock file to bypass Windows Protected View blocking
    Unblock-File -Path '${safeFilePath}' -ErrorAction SilentlyContinue

    $ppt.DisplayAlerts = 1
    $filePath = '${safeFilePath}'
    $outputDir = '${safeOutputDir}'
    $presentation = $ppt.Presentations.Open($filePath, $true, $false, $false)
    
    # Export slide-by-slide to guarantee PNG creation directly into output directory
    for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
        $slide = $presentation.Slides.Item($i)
        $outPath = Join-Path $outputDir "slide_$i.png"
        $slide.Export($outPath, "PNG")
    }
    
    $presentation.Close()
} catch {
    Write-Error $_.Exception.Message
    exit 1
} finally {
    if ($ppt) {
        $ppt.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }
}
  `;

  try {
    await runPowerShell(psScript);
    
    const files = fs.readdirSync(outputDir)
      .filter(f => f.toLowerCase().endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

    if (files.length === 0) {
      throw new Error("No slide images were generated. Please check if PowerPoint is installed.");
    }

    const slides = files.map((file, idx) => ({
      label: `Slide ${idx + 1}`,
      text: '',
      bgAsset: path.join(outputDir, file)
    }));

    const contentJson = JSON.stringify(slides);
    const song = await db.saveSong(null, title, 'PowerPoint Import', '', '', contentJson);
    return { success: true, song };
  } catch (err) {
    console.error('PowerPoint export failed:', err);
    return { success: false, error: err.message };
  }
});

// PDF document file importer — Step 1: open dialog, return path to renderer for browser-side rendering
ipcMain.handle('media:import-pdf', async () => {
  const result = await dialog.showOpenDialog(operatorWindow, {
    title: 'WorshipFlow - Select PDF Document',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return { success: false };
  const filePath = result.filePaths[0];
  const title = path.basename(filePath, path.extname(filePath));
  const outputDir = path.join(app.getPath('userData'), 'imports', `pdf_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  // Return path + outputDir to renderer — renderer will render pages and send back PNG buffers
  return { success: true, needsRendering: true, filePath, outputDir, title };
});

// PDF import — Step 2: receive rendered page PNG base64 data from renderer, save to disk, store in DB
ipcMain.handle('media:save-pdf-pages', async (event, { title, outputDir, pages }) => {
  try {
    const slides = [];
    for (let i = 0; i < pages.length; i++) {
      const base64 = pages[i].replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const filePath = path.join(outputDir, `page_${String(i + 1).padStart(3, '0')}.png`);
      fs.writeFileSync(filePath, buffer);
      slides.push({ label: `Page ${i + 1}`, text: '', bgAsset: filePath });
    }
    const contentJson = JSON.stringify(slides);
    const song = await db.saveSong(null, title, 'PDF Import', '', '', contentJson);
    return { success: true, song };
  } catch (err) {
    console.error('PDF page save failed:', err);
    return { success: false, error: err.message };
  }
});

// Get current application version
ipcMain.handle('app:get-version', () => app.getVersion());

// Check for updates against GitHub Releases
ipcMain.handle('system:check-update', async () => {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://api.github.com/repos/austriaj12/WorshipFlow-Application/releases/latest',
      headers: {
        'User-Agent': 'WorshipFlow-App'
      }
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            resolve({ success: false, error: `GitHub API returned status ${response.statusCode}` });
            return;
          }
          const release = JSON.parse(data);
          const latestVersion = release.tag_name.replace(/^v/, '');
          const currentVersion = app.getVersion();

          const hasUpdate = isNewerVersion(latestVersion, currentVersion);

          // Find the windows installer (.exe)
          const exeAsset = release.assets.find(asset => asset.name.endsWith('.exe'));
          
          resolve({
            success: true,
            currentVersion,
            latestVersion,
            hasUpdate,
            notes: release.body,
            downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
            fileName: exeAsset ? exeAsset.name : null
          });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.end();
  });
});

// Download and install update installer
ipcMain.handle('system:install-update', async (event, { downloadUrl, fileName }) => {
  return new Promise((resolve) => {
    const tempDir = app.getPath('temp');
    const localFilePath = path.join(tempDir, fileName || 'worshipflow-setup.exe');

    const request = net.request({
      method: 'GET',
      url: downloadUrl,
      headers: {
        'User-Agent': 'WorshipFlow-App'
      }
    });

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        resolve({ success: false, error: `Download failed with status ${response.statusCode}` });
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(localFilePath);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        fileStream.write(chunk);

        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          if (operatorWindow && !operatorWindow.isDestroyed()) {
            operatorWindow.webContents.send('update-download-progress', progress);
          }
        }
      });

      response.on('end', () => {
        fileStream.end();
        
        // Execute the installer asynchronously and quit the app
        setTimeout(() => {
          try {
            const spawn = require('child_process').spawn;
            const child = spawn(localFilePath, [], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            app.quit();
            resolve({ success: true });
          } catch (e) {
            resolve({ success: false, error: `Failed to start installer: ${e.message}` });
          }
        }, 500);
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.end();
  });
});

// Helper function to compare semver versions
function isNewerVersion(latest, current) {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestPart = latestParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  return false;
}

// Register a custom protocol to serve local file assets (PowerPoint/PDF slide images)
protocol.registerSchemesAsPrivileged([
  { scheme: 'worshipflow-asset', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

// Bootstrapping the app
app.whenReady().then(async () => {
  // Register the worshipflow-asset:// protocol handler to serve local image files
  protocol.handle('worshipflow-asset', (request) => {
    // Strip scheme, decode URI encoding, ensure forward slashes for file:// URL
    let filePath = decodeURIComponent(request.url.slice('worshipflow-asset://'.length));
    // Normalize to forward slashes and build proper file URL
    const normalizedPath = filePath.replace(/\\/g, '/');
    return net.fetch(`file:///${normalizedPath}`);
  });

  try {
    // Initialize SQLite worship.db Database & schemas
    await db.initDatabase();
    console.log('worship.db initialized successfully.');
    
    // Auto-start stage & remote control server on launch (Port 5174)
    startStageServer(5174);
    console.log('Stage & Remote control server started automatically on port 5174.');

    // Open the splash screen preloader first
    createSplashWindow();

    // Open only the operator dashboard window on startup (no projector)
    createOperatorWindow();

    // Listen for display changes and notify frontend
    screen.on('display-added', () => {
      if (operatorWindow && !operatorWindow.isDestroyed()) {
        operatorWindow.webContents.send('displays-changed');
      }
    });
    screen.on('display-removed', () => {
      if (operatorWindow && !operatorWindow.isDestroyed()) {
        operatorWindow.webContents.send('displays-changed');
      }
    });
    screen.on('display-metrics-changed', () => {
      if (operatorWindow && !operatorWindow.isDestroyed()) {
        operatorWindow.webContents.send('displays-changed');
      }
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperatorWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

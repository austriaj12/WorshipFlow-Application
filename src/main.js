const { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database');

// Ensure video/audio items can autoplay immediately and unmute without blocking
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let operatorWindow = null;
let projectorWindow = null;
let stageWindow = null;
let lastSlideData = null;
let lastStageData = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    title: "WorshipFlow",
    backgroundColor: "#121212"
  });

  operatorWindow.maximize();

  if (isDev) {
    operatorWindow.loadURL('http://localhost:5173');
    operatorWindow.webContents.openDevTools();
  } else {
    operatorWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

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
  
  // Prefer selected displayIndex if valid, otherwise look for secondary display, fallback to display 0
  let targetDisplay = displays[displayIndex];
  if (!targetDisplay) {
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
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
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
function createStageWindow(displayIndex = 1) {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  // Prefer a different display than the main operator (try displayIndex, fallback to any non-primary)
  let targetDisplay = displays[displayIndex] || displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];

  const bounds = targetDisplay ? targetDisplay.bounds : { x: 0, y: 0, width: 1920, height: 1080 };

  stageWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    fullscreen: false,
    frame: false,
    autoHideMenuBar: true,
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
        const localPath = decodeURIComponent(urlPath.slice('/local-asset/'.length));
        if (fs.existsSync(localPath)) {
          const ext = path.extname(localPath).toLowerCase();
          const contentType = mime[ext] || 'application/octet-stream';
          try {
            const data = fs.readFileSync(localPath);
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
    await dialog.showMessageBox(operatorWindow, {
      type: 'info',
      title: 'WorshipFlow - PowerPoint Import Guide',
      message: 'To import PowerPoint presentations with 100% accurate layout, images, and fonts, please save your PowerPoint file as a PDF (File > Save As > PDF) and use the "PDF" option to import. This ensures perfect projection quality on any computer.',
      buttons: ['OK']
    });
    return { success: false };
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

    // Open only the operator dashboard window on startup (no projector)
    createOperatorWindow();
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

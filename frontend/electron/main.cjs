const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const isDev = require('electron-is-dev');
const fs = require('fs');
const logger = require('./logger.cjs');
const config = require('./config.cjs');
const devtools = isDev ? require('./devtools.cjs') : null;

let mainWindow;
let readyToClose = false;
let flushInProgress = false;
const linkedProjectFolders = new Map();
const projectSaveQueues = new Map();
const allowedReadPaths = new Set();
const allowedWritePaths = new Set();

const userDataPath = app.getPath('userData');
const normalizeFilePath = (filePath) => path.resolve(String(filePath ?? ''));
const isTrustedSender = (event) =>
  Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);

function requireTrustedSender(event) {
  if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender.');
}

function requireAllowedPath(event, filePath, allowedPaths) {
  requireTrustedSender(event);
  const normalized = normalizeFilePath(filePath);
  if (!allowedPaths.has(normalized)) {
    throw new Error('File access was not authorized by a system dialog.');
  }
  return normalized;
}

function loadWindowState() {
  try {
    return config.get('windowState');
  } catch (err) {
    logger.error('Failed to load window state', { error: err.message });
    return { width: 1280, height: 720, x: undefined, y: undefined };
  }
}

function saveWindowState() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
    };
    try {
      config.set('windowState', state);
    } catch (err) {
      logger.error('Failed to save window state', { error: err.message });
    }
  }
}

function createWindow() {
  logger.info('Creating main window');
  readyToClose = false;
  flushInProgress = false;
  linkedProjectFolders.clear();
  ipcMain.removeAllListeners('app:quitReady');
  allowedReadPaths.clear();
  allowedWritePaths.clear();
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  const startUrl = isDev
    ? 'http://localhost:5173'
    : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;

  logger.info('Loading URL', { url: startUrl });
  mainWindow.loadURL(startUrl);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
        const { shell } = require('electron');
        shell.openExternal(url);
      }
    } catch {
      logger.warn('Blocked window.open for invalid URL', { url });
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false;
    try {
      const target = new URL(url);
      const start = new URL(startUrl);
      allowed = isDev
        ? target.origin === start.origin
        : target.protocol === 'file:' && target.pathname === start.pathname;
    } catch {
      allowed = false;
    }
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  mainWindow.on('close', (event) => {
    saveWindowState();
    if (readyToClose) return;

    event.preventDefault();
    if (flushInProgress) return;
    flushInProgress = true;
    logger.info('Flushing pending autosave before close');

    const timeout = setTimeout(async () => {
      logger.warn('Quit flush timed out');
      ipcMain.removeAllListeners('app:quitReady');
      flushInProgress = false;
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Save is taking longer than expected',
        message: 'The presentation has not confirmed that it was saved.',
        buttons: ['Keep Editing', 'Quit Without Saving'],
        defaultId: 0,
        cancelId: 0,
      });
      if (result.response === 1) {
        readyToClose = true;
        mainWindow.close();
      }
    }, 3000);

    ipcMain.once('app:quitReady', async (ipcEvent, result = {}) => {
      if (!isTrustedSender(ipcEvent)) return;
      clearTimeout(timeout);
      if (result.success) {
        readyToClose = true;
        mainWindow.close();
        return;
      }
      flushInProgress = false;
      if (result.cancelled) return;
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Could not save presentation',
        message: result.message || 'The presentation could not be saved. The app will remain open.',
        buttons: ['OK'],
      });
    });

    mainWindow.webContents.send('app:beforeQuit');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('crashed', () => {
    logger.error('Renderer process crashed');
    dialog.showErrorBox('Error', 'The application has crashed. Please restart.');
  });

  mainWindow.webContents.on('will-drop-files', (event, files) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('drop', (event, files) => {
    event.preventDefault();
    if (files.length > 0) {
      const filePath = files[0];
      if (filePath.endsWith('.json')) {
        allowedReadPaths.add(normalizeFilePath(filePath));
        mainWindow.webContents.send('file:dropped', filePath);
      } else {
        dialog.showErrorBox('Invalid file', 'Please drop a .json presentation file');
      }
    }
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Cut', role: 'cut' },
      { label: 'Copy', role: 'copy' },
      { label: 'Paste', role: 'paste' },
    ]);
    contextMenu.popup(mainWindow, params.x, params.y);
  });
}

app.on('ready', () => {
  logger.info('App ready', { version: app.getVersion() });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' http://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' ws://localhost:5173 http://localhost:5173"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });
  if (devtools) {
    devtools.logEnvironmentInfo();
    devtools.checkSetup(app);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  logger.debug('App activated');
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  logger.info('App quitting');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  dialog.showErrorBox('Error', 'An unexpected error occurred: ' + err.message);
});

ipcMain.handle('dialog:openFile', async (event) => {
  requireTrustedSender(event);
  logger.debug('Open file dialog requested');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Presentations', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.filePaths.length > 0) {
    result.filePaths.forEach((filePath) => allowedReadPaths.add(normalizeFilePath(filePath)));
    logger.info('File opened', { path: result.filePaths[0] });
  }
  return result.filePaths;
});

const SAVE_FILTERS = {
  json: [{ name: 'JSON', extensions: ['json'] }],
  html: [{ name: 'HTML', extensions: ['html'] }],
  zip: [{ name: 'ZIP Archive', extensions: ['zip'] }],
};

ipcMain.handle('dialog:saveFile', async (event, defaultName, extension) => {
  requireTrustedSender(event);
  logger.debug('Save file dialog requested', { defaultName, extension });
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'presentation.json',
    filters: SAVE_FILTERS[extension] || SAVE_FILTERS.json,
  });
  if (result.filePath) {
    allowedWritePaths.add(normalizeFilePath(result.filePath));
    logger.info('File save path selected', { path: result.filePath });
  }
  return result.filePath;
});

ipcMain.handle('dialog:showError', async (event, title, message) => {
  requireTrustedSender(event);
  await dialog.showErrorBox(String(title).slice(0, 100), String(message).slice(0, 4000));
});

ipcMain.handle('dialog:showMessage', async (event, title, message) => {
  requireTrustedSender(event);
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: String(title).slice(0, 100),
    message: String(message).slice(0, 4000),
  });
});

ipcMain.handle('dialog:pickLinkTarget', async (event) => {
  requireTrustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Link to file',
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, url: pathToFileURL(filePath).href, name: path.basename(filePath) };
});

ipcMain.handle('shell:openLocalFile', async (event, fileUrl) => {
  requireTrustedSender(event);
  let filePath;
  try {
    filePath = fileURLToPath(String(fileUrl));
  } catch {
    throw new Error('Invalid file link.');
  }
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Open linked file',
    message: `Open this file with its default application?\n\n${filePath}`,
    buttons: ['Open', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });
  if (choice.response !== 0) return false;
  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) {
    await dialog.showErrorBox('Could not open file', errorMessage);
    return false;
  }
  return true;
});

ipcMain.handle('dialog:confirmSaveBeforeQuit', async (event, folderName) => {
  requireTrustedSender(event);
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Unsaved Changes',
    message: folderName
      ? `You have unsaved changes in "${folderName}". Save before closing?`
      : 'You have unsaved changes. Save before closing?',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });
  return ['save', 'discard', 'cancel'][result.response] ?? 'cancel';
});

ipcMain.handle('file:readFile', async (event, filePath) => {
  try {
    const authorizedPath = requireAllowedPath(event, filePath, allowedReadPaths);
    logger.debug('Reading file', { path: authorizedPath });
    const content = await fs.promises.readFile(authorizedPath, 'utf-8');
    allowedReadPaths.delete(authorizedPath);
    logger.info('File read successfully', { path: authorizedPath, size: content.length });
    return content;
  } catch (err) {
    logger.error('Failed to read file', { path: filePath, error: err.message });
    throw new Error(`Failed to read file: ${err.message}`);
  }
});

ipcMain.handle('file:writeFile', async (event, filePath, content) => {
  try {
    const authorizedPath = requireAllowedPath(event, filePath, allowedWritePaths);
    if (typeof content !== 'string' && !ArrayBuffer.isView(content)) {
      throw new Error('Unsupported file content type.');
    }
    logger.debug('Writing file', { path: authorizedPath, size: content.length });
    await fs.promises.writeFile(
      authorizedPath,
      content,
      typeof content === 'string' ? 'utf-8' : undefined,
    );
    allowedWritePaths.delete(authorizedPath);
    logger.info('File written successfully', { path: authorizedPath });
  } catch (err) {
    logger.error('Failed to write file', { path: filePath, error: err.message });
    throw new Error(`Failed to write file: ${err.message}`);
  }
});

function sanitizeFolderName(name) {
  const cleaned = String(name || 'Untitled Presentation')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .trim()
    .slice(0, 100);
  return cleaned || 'Untitled Presentation';
}

const MAX_RECENT_PROJECTS = 10;

function recordRecentProject(projectFolder) {
  const recent = config.get('recentProjects', []).filter((p) => p !== projectFolder);
  recent.unshift(projectFolder);
  config.set('recentProjects', recent.slice(0, MAX_RECENT_PROJECTS));
}

function markPresentationLinked(presentationId) {
  const linked = config.get('linkedPresentationIds', []);
  if (!linked.includes(presentationId)) {
    config.set('linkedPresentationIds', [...linked, presentationId]);
  }
}

async function chooseNewProjectFolder(presentationTitle) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where to save this presentation',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const folderName = sanitizeFolderName(presentationTitle);
  let projectFolder = path.join(result.filePaths[0], folderName);
  let suffix = 1;
  while (fs.existsSync(projectFolder) && (await fs.promises.readdir(projectFolder)).length > 0) {
    projectFolder = path.join(result.filePaths[0], `${folderName} (${suffix})`);
    suffix += 1;
  }

  await fs.promises.mkdir(path.join(projectFolder, 'media', 'image'), { recursive: true });
  await fs.promises.mkdir(path.join(projectFolder, 'media', 'video'), { recursive: true });
  await fs.promises.mkdir(path.join(projectFolder, 'fonts'), { recursive: true });
  return projectFolder;
}

function queueProjectSave(presentationId, task) {
  const previous = projectSaveQueues.get(presentationId) ?? Promise.resolve();
  const next = previous.then(task, task);
  projectSaveQueues.set(presentationId, next.catch(() => {}));
  return next;
}

ipcMain.handle('project:save', async (event, { presentationId, presentationTitle, files, forceNewFolder } = {}) => {
  requireTrustedSender(event);
  if (!presentationId) throw new Error('Missing presentation id.');
  return queueProjectSave(presentationId, async () => {
    try {
      let folder = linkedProjectFolders.get(presentationId);
      if (forceNewFolder || !folder) {
        const chosen = await chooseNewProjectFolder(presentationTitle);
        if (!chosen) return null;
        folder = chosen;
        linkedProjectFolders.set(presentationId, folder);
      }

      const root = path.resolve(folder);
      for (const file of files) {
        if (typeof file.relativePath !== 'string' || file.relativePath.includes('..') || path.isAbsolute(file.relativePath)) {
          throw new Error(`Invalid file path: ${file.relativePath}`);
        }
        const resolved = path.resolve(root, file.relativePath);
        if (!resolved.startsWith(root + path.sep)) {
          throw new Error(`Invalid file path: ${file.relativePath}`);
        }
        await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
        if (file.kind === 'binary') {
          await fs.promises.writeFile(resolved, Buffer.from(file.bytes));
        } else {
          await fs.promises.writeFile(resolved, file.text, 'utf-8');
        }
      }
      recordRecentProject(folder);
      markPresentationLinked(presentationId);
      logger.info('Project files written successfully', { folder, count: files.length });
      return folder;
    } catch (err) {
      logger.error('Failed to save project', { error: err.message });
      throw new Error(`Failed to save presentation: ${err.message}`);
    }
  });
});

ipcMain.handle('project:getRecent', async (event) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []);
  const existing = recent.filter((p) => fs.existsSync(path.join(p, 'presentation.json')));
  if (existing.length !== recent.length) {
    config.set('recentProjects', existing);
  }
  return existing;
});

ipcMain.handle('project:readManifest', async (event, projectFolder) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []);
  if (!recent.includes(projectFolder)) {
    throw new Error('This project is not in the recent list.');
  }
  const manifestPath = path.join(projectFolder, 'presentation.json');
  const [text, stats] = await Promise.all([
    fs.promises.readFile(manifestPath, 'utf-8'),
    fs.promises.stat(manifestPath),
  ]);
  return { text, updatedAt: stats.mtimeMs };
});

ipcMain.handle('project:removeRecent', async (event, projectFolder) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []).filter((p) => p !== projectFolder);
  config.set('recentProjects', recent);
});

ipcMain.handle('project:openRecent', async (event, projectFolder) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []);
  if (!recent.includes(projectFolder)) {
    throw new Error('This project is not in the recent list.');
  }
  const text = await fs.promises.readFile(path.join(projectFolder, 'presentation.json'), 'utf-8');
  recordRecentProject(projectFolder);
  return text;
});

ipcMain.handle('project:readMediaFile', async (event, projectFolder, relativePath) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []);
  if (!recent.includes(projectFolder)) {
    throw new Error('This project is not in the recent list.');
  }
  if (typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }
  const root = path.resolve(projectFolder);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }
  const bytes = await fs.promises.readFile(resolved);
  return new Uint8Array(bytes);
});

ipcMain.handle('project:linkPresentation', async (event, presentationId, projectFolder) => {
  requireTrustedSender(event);
  const recent = config.get('recentProjects', []);
  if (!recent.includes(projectFolder)) {
    throw new Error('This project is not in the recent list.');
  }
  linkedProjectFolders.set(presentationId, projectFolder);
  markPresentationLinked(presentationId);
});

ipcMain.handle('project:getLinkedFolder', async (event, presentationId) => {
  requireTrustedSender(event);
  return linkedProjectFolders.get(presentationId) || null;
});

ipcMain.handle('project:getLinkedIds', async (event) => {
  requireTrustedSender(event);
  return config.get('linkedPresentationIds', []);
});

let storageFolderPromise = null;

const AUTOSAVE_CACHE_FOLDER = path.join(userDataPath, 'autosave-cache');

async function ensureStorageFolder() {
  if (!storageFolderPromise) {
    storageFolderPromise = (async () => {
      await fs.promises.mkdir(path.join(AUTOSAVE_CACHE_FOLDER, 'media'), { recursive: true });
      return AUTOSAVE_CACHE_FOLDER;
    })().finally(() => {
      storageFolderPromise = null;
    });
  }
  return storageFolderPromise;
}

function isMediaKey(key) {
  return typeof key === 'string' && key.startsWith('media/');
}

const MIME_TYPES_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function mimeTypeForKey(key) {
  const ext = key.split('.').pop()?.toLowerCase();
  return MIME_TYPES_BY_EXTENSION[ext] || 'application/octet-stream';
}

async function resolveKeyPath(key) {
  if (typeof key !== 'string' || !key || key.includes('..') || path.isAbsolute(key)) {
    throw new Error('Invalid storage key.');
  }
  const folder = await ensureStorageFolder();
  const relative = isMediaKey(key) ? key : `${key}.json`;
  const resolved = path.resolve(folder, relative);
  if (!resolved.startsWith(path.resolve(folder) + path.sep) && resolved !== path.resolve(folder)) {
    throw new Error('Invalid storage key.');
  }
  return resolved;
}

ipcMain.handle('storage:get', async (event, key) => {
  requireTrustedSender(event);
  try {
    const filePath = await resolveKeyPath(key);
    if (isMediaKey(key)) {
      const bytes = await fs.promises.readFile(filePath).catch(() => null);
      if (!bytes) return null;
      return { kind: 'binary', bytes: new Uint8Array(bytes), type: mimeTypeForKey(key) };
    }
    const text = await fs.promises.readFile(filePath, 'utf-8').catch(() => null);
    if (text === null) return null;
    return { kind: 'text', text };
  } catch (err) {
    logger.error('storage:get failed', { key, error: err.message });
    throw new Error(`Failed to read "${key}": ${err.message}`);
  }
});

ipcMain.handle('storage:set', async (event, key, payload) => {
  requireTrustedSender(event);
  try {
    const filePath = await resolveKeyPath(key);
    if (payload.kind === 'binary') {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, Buffer.from(payload.bytes));
    } else {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, payload.text, 'utf-8');
    }
  } catch (err) {
    logger.error('storage:set failed', { key, error: err.message });
    throw new Error(`Failed to write "${key}": ${err.message}`);
  }
});

ipcMain.handle('storage:remove', async (event, key) => {
  requireTrustedSender(event);
  try {
    const filePath = await resolveKeyPath(key);
    await fs.promises.rm(filePath, { force: true });
  } catch (err) {
    logger.error('storage:remove failed', { key, error: err.message });
    throw new Error(`Failed to remove "${key}": ${err.message}`);
  }
});

ipcMain.handle('storage:listKeys', async (event) => {
  requireTrustedSender(event);
  try {
    const folder = await ensureStorageFolder();
    const rootEntries = await fs.promises.readdir(folder, { withFileTypes: true });
    const keys = rootEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -'.json'.length));

    const mediaDir = path.join(folder, 'media');
    const mediaEntries = await fs.promises.readdir(mediaDir, { withFileTypes: true }).catch(() => []);
    mediaEntries
      .filter((entry) => entry.isFile())
      .forEach((entry) => keys.push(`media/${entry.name}`));

    return keys;
  } catch (err) {
    logger.error('storage:listKeys failed', { error: err.message });
    throw new Error(`Failed to list storage keys: ${err.message}`);
  }
});

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          if (mainWindow) mainWindow.webContents.send('menu:new');
        },
      },
      {
        label: 'Open...',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          if (mainWindow) mainWindow.webContents.send('menu:open');
        },
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          if (mainWindow) mainWindow.webContents.send('menu:save');
        },
      },
      {
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => {
          if (mainWindow) mainWindow.webContents.send('menu:saveAs');
        },
      },
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit(),
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      { type: 'separator' },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:',
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (mainWindow) mainWindow.reload();
        },
      },
      {
        label: 'Force Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
        },
      },
      { type: 'separator' },
      {
        label: 'Toggle DevTools',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          if (mainWindow) mainWindow.webContents.toggleDevTools();
        },
      },
      { type: 'separator' },
      {
        label: 'Toggle Fullscreen',
        accelerator: 'F11',
        click: () => {
          if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
        },
      },
    ],
  },
];

if (isDev) {
  template.push({
    label: 'Debug',
    submenu: [
      {
        label: 'Open User Data Folder',
        click: () => {
          const { shell } = require('electron');
          shell.openPath(userDataPath);
        },
      },
      {
        label: 'Clear Window State',
        click: () => {
          try {
            config.delete('windowState');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              message: 'Window state cleared. Restart the app.',
            });
          } catch (err) {
            console.error('Failed to clear window state:', err);
          }
        },
      },
    ],
  });
}

template.push({
  label: 'Help',
  submenu: [
    {
      label: 'About',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About Presentation App',
          message: 'Presentation Editor',
          detail: 'Create and edit presentations with ease.\n\nVersion 1.0.0',
        });
      },
    },
  ],
});

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

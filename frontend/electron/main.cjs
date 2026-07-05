const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const { randomUUID } = require('crypto');
const fs = require('fs');
const logger = require('./logger.cjs');
const config = require('./config.cjs');

const isDev = !app.isPackaged;
const devtools = isDev ? require('./devtools.cjs') : null;

let mainWindow;
let readyToClose = false;
let flushInProgress = false;
const linkedProjectFolders = new Map();
const projectSaveQueues = new Map();
const allowedReadPaths = new Set();
const allowedWritePaths = new Set();
const allowedProjectWriteFolders = new Set();
const allowedProjectReadFolders = new Set();

const userDataPath = app.getPath('userData');
const normalizeFilePath = (filePath) => path.resolve(String(filePath ?? ''));
const isTrustedSender = (event) =>
  Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);

function readPersistedProjectFolders() {
  const stored = config.get('projectFoldersByPresentationId', {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored)
      .filter(([presentationId, projectFolder]) =>
        typeof presentationId === 'string'
        && presentationId.length > 0
        && typeof projectFolder === 'string'
        && projectFolder.length > 0)
      .map(([presentationId, projectFolder]) => [
        presentationId,
        normalizeFilePath(projectFolder),
      ]),
  );
}

function restoreLinkedProjectFolders() {
  linkedProjectFolders.clear();
  Object.entries(readPersistedProjectFolders()).forEach(([presentationId, projectFolder]) => {
    linkedProjectFolders.set(presentationId, projectFolder);
  });
}

function persistLinkedProjectFolder(presentationId, projectFolder) {
  const normalizedFolder = normalizeFilePath(projectFolder);
  const mappings = readPersistedProjectFolders();
  mappings[presentationId] = normalizedFolder;
  config.set('projectFoldersByPresentationId', mappings);
  linkedProjectFolders.set(presentationId, normalizedFolder);
  return normalizedFolder;
}

function getPresentationSourceDescriptor(presentationId) {
  const projectFolder = linkedProjectFolders.get(presentationId)
    || readPersistedProjectFolders()[presentationId]
    || null;
  return projectFolder
    ? { kind: 'project', presentationId, projectFolder, status: 'project' }
    : { kind: 'draft', presentationId, projectFolder: null, status: 'draft' };
}

function findPresentationIdForProjectFolder(projectFolder) {
  const normalizedFolder = normalizeFilePath(projectFolder);
  return Object.entries(readPersistedProjectFolders())
    .find(([, folder]) => normalizeFilePath(folder) === normalizedFolder)?.[0] ?? null;
}

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
  restoreLinkedProjectFolders();
  ipcMain.removeAllListeners('app:quitReady');
  allowedReadPaths.clear();
  allowedWritePaths.clear();
  allowedProjectWriteFolders.clear();
  allowedProjectReadFolders.clear();
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

const prodIndexPath = path.join(__dirname, '../dist/index.html');

const startUrl = isDev
  ? 'http://localhost:5173'
  : pathToFileURL(prodIndexPath).href;

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
    }, 5 * 60 * 1000);

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
        allowedProjectReadFolders.add(normalizeFilePath(path.dirname(filePath)));
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
    result.filePaths.forEach((filePath) => {
      allowedReadPaths.add(normalizeFilePath(filePath));
      allowedProjectReadFolders.add(normalizeFilePath(path.dirname(filePath)));
    });
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

ipcMain.handle('dialog:confirm', async (event, title, message) => {
  requireTrustedSender(event);
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: String(title).slice(0, 100),
    message: String(message).slice(0, 4000),
  });
  return result.response === 0;
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

async function chooseNamedProjectFolder(presentationTitle) {
  const defaultFolderName = sanitizeFolderName(presentationTitle);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Choose project folder name and location',
    defaultPath: defaultFolderName,
    buttonLabel: 'Select Project Folder',
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (result.canceled || !result.filePath) return null;

  const projectFolder = normalizeFilePath(result.filePath);
  const stats = await fs.promises.stat(projectFolder).catch(() => null);
  if (stats?.isFile()) {
    throw new Error('The selected project path is an existing file.');
  }
  if (stats?.isDirectory()) {
    const entries = await fs.promises.readdir(projectFolder);
    if (entries.length > 0) {
      throw new Error('Please choose a new or empty project folder.');
    }
  }
  return {
    projectFolder,
    folderName: path.basename(projectFolder),
  };
}

function validateProjectRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string'
    || !relativePath
    || relativePath.includes('..')
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid project file path: ${relativePath}`);
  }
  const normalized = relativePath.replaceAll('\\', '/');
  if (
    normalized !== 'presentation.json'
    && !normalized.startsWith('media/image/')
    && !normalized.startsWith('media/video/')
    && !normalized.startsWith('fonts/')
  ) {
    throw new Error(`Unsupported project file path: ${relativePath}`);
  }
  return normalized;
}

function isWritableProjectFolder(projectFolder) {
  const normalized = normalizeFilePath(projectFolder);
  const persistedFolders = Object.values(readPersistedProjectFolders());
  return allowedProjectWriteFolders.has(normalized)
    || persistedFolders.includes(normalized);
}

function isReadableProjectFolder(projectFolder) {
  const normalized = normalizeFilePath(projectFolder);
  const recentFolders = config.get('recentProjects', []).map(normalizeFilePath);
  return isWritableProjectFolder(normalized)
    || allowedProjectReadFolders.has(normalized)
    || recentFolders.includes(normalized);
}

function requireProjectFolder(projectFolder, access) {
  const normalized = normalizeFilePath(projectFolder);
  const allowed = access === 'write'
    ? isWritableProjectFolder(normalized)
    : isReadableProjectFolder(normalized);
  if (!allowed) {
    throw new Error('This project folder was not authorized by the user.');
  }
  return normalized;
}

async function writeProjectFile(root, file) {
  const relativePath = validateProjectRelativePath(file.relativePath);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Invalid project file path: ${file.relativePath}`);
  }
  await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
  if (file.kind === 'binary') {
    if (!ArrayBuffer.isView(file.bytes)) {
      throw new Error(`Invalid binary project file: ${file.relativePath}`);
    }
    await fs.promises.writeFile(resolved, Buffer.from(file.bytes));
    return;
  }
  if (file.kind !== 'text' || typeof file.text !== 'string') {
    throw new Error(`Invalid text project file: ${file.relativePath}`);
  }
  await fs.promises.writeFile(resolved, file.text, 'utf-8');
}

function collectProjectAssetReferences(value, references = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectProjectAssetReferences(child, references));
    return references;
  }
  if (!value || typeof value !== 'object') return references;
  Object.entries(value).forEach(([key, child]) => {
    if (
      (key === 'file-link' || key === 'font-file')
      && typeof child === 'string'
      && (child.startsWith('media/') || child.startsWith('fonts/'))
    ) {
      references.add(validateProjectRelativePath(child));
    } else {
      collectProjectAssetReferences(child, references);
    }
  });
  return references;
}

async function verifyStagedProject(stagingFolder) {
  const manifestPath = path.join(stagingFolder, 'presentation.json');
  const manifestText = await fs.promises.readFile(manifestPath, 'utf-8');
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error('The staged presentation.json is not valid JSON.');
  }
  const references = collectProjectAssetReferences(manifest);
  for (const relativePath of references) {
    const assetPath = path.resolve(stagingFolder, relativePath);
    const stats = await fs.promises.stat(assetPath).catch(() => null);
    if (!stats?.isFile()) {
      throw new Error(`Required project asset was not staged: ${relativePath}`);
    }
  }
}

async function stageProjectSnapshot(projectFolder, files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Project snapshot contains no files.');
  }
  const manifests = files.filter((file) => file.relativePath === 'presentation.json');
  if (manifests.length !== 1) {
    throw new Error('Project snapshot must contain exactly one presentation.json.');
  }
  const duplicatePaths = new Set();
  const seenPaths = new Set();
  files.forEach((file) => {
    const relativePath = validateProjectRelativePath(file.relativePath);
    if (seenPaths.has(relativePath)) duplicatePaths.add(relativePath);
    seenPaths.add(relativePath);
  });
  if (duplicatePaths.size > 0) {
    throw new Error(`Duplicate project file path: ${[...duplicatePaths][0]}`);
  }

  const target = path.resolve(projectFolder);
  const parent = path.dirname(target);
  const baseName = path.basename(target);
  const stagingFolder = path.join(parent, `.${baseName}.staging-${randomUUID()}`);
  await fs.promises.mkdir(parent, { recursive: true });

  try {
    const targetStats = await fs.promises.stat(target).catch(() => null);
    if (targetStats?.isDirectory()) {
      await fs.promises.cp(target, stagingFolder, { recursive: true, errorOnExist: true });
    } else {
      await fs.promises.mkdir(stagingFolder, { recursive: true });
    }
    await fs.promises.mkdir(path.join(stagingFolder, 'media', 'image'), { recursive: true });
    await fs.promises.mkdir(path.join(stagingFolder, 'media', 'video'), { recursive: true });
    await fs.promises.mkdir(path.join(stagingFolder, 'fonts'), { recursive: true });

    const manifest = manifests[0];
    for (const file of files) {
      if (file !== manifest) await writeProjectFile(stagingFolder, file);
    }
    await writeProjectFile(stagingFolder, manifest);
    await verifyStagedProject(stagingFolder);
    return stagingFolder;
  } catch (error) {
    await fs.promises.rm(stagingFolder, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function commitStagedProject(projectFolder, stagingFolder) {
  const target = path.resolve(projectFolder);
  const parent = path.dirname(target);
  if (path.dirname(path.resolve(stagingFolder)) !== parent) {
    throw new Error('Project staging folder must be beside its destination.');
  }
  const backupFolder = path.join(parent, `.${path.basename(target)}.backup-${randomUUID()}`);
  const targetExists = Boolean(await fs.promises.stat(target).catch(() => null));
  let backupCreated = false;

  try {
    if (targetExists) {
      await fs.promises.rename(target, backupFolder);
      backupCreated = true;
    }
    await fs.promises.rename(stagingFolder, target);
  } catch (error) {
    if (backupCreated) {
      const targetAfterFailure = await fs.promises.stat(target).catch(() => null);
      if (!targetAfterFailure) {
        await fs.promises.rename(backupFolder, target).catch(() => {});
      }
    }
    throw error;
  }

  if (backupCreated) {
    fs.promises.rm(backupFolder, { recursive: true, force: true }).catch((error) => {
      logger.warn('Could not remove project backup folder', {
        folder: backupFolder,
        error: error.message,
      });
    });
  }
}

async function writeSafeProjectSnapshot(projectFolder, files) {
  const stagingFolder = await stageProjectSnapshot(projectFolder, files);
  try {
    await commitStagedProject(projectFolder, stagingFolder);
  } catch (error) {
    await fs.promises.rm(stagingFolder, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

ipcMain.handle('project:chooseFolder', async (event, presentationTitle) => {
  requireTrustedSender(event);
  const chosen = await chooseNamedProjectFolder(presentationTitle);
  if (!chosen) return null;
  const normalized = normalizeFilePath(chosen.projectFolder);
  allowedProjectWriteFolders.add(normalized);
  return {
    projectFolder: normalized,
    folderName: chosen.folderName,
  };
});

ipcMain.handle('project:writeSnapshot', async (event, {
  presentationId,
  projectFolder,
  files,
} = {}) => {
  requireTrustedSender(event);
  if (!presentationId) throw new Error('Missing presentation id.');
  const target = requireProjectFolder(projectFolder, 'write');
  return queueProjectSave(presentationId, async () => {
    try {
      await writeSafeProjectSnapshot(target, files);
      allowedProjectWriteFolders.delete(target);
      allowedProjectReadFolders.add(target);
      return { projectFolder: target, verified: true };
    } catch (error) {
      allowedProjectWriteFolders.delete(target);
      logger.error('Failed to write safe project snapshot', {
        folder: target,
        error: error.message,
      });
      throw new Error(`Failed to write project snapshot: ${error.message}`);
    }
  });
});

ipcMain.handle('project:loadSnapshot', async (event, projectFolder) => {
  requireTrustedSender(event);
  const folder = requireProjectFolder(projectFolder, 'read');
  const manifestPath = path.join(folder, 'presentation.json');
  const [text, stats] = await Promise.all([
    fs.promises.readFile(manifestPath, 'utf-8'),
    fs.promises.stat(manifestPath),
  ]);
  JSON.parse(text);
  return { text, updatedAt: stats.mtimeMs, projectFolder: folder };
});

ipcMain.handle('project:chooseOpenFolder', async (event) => {
  requireTrustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Presentation Project',
    buttonLabel: 'Open Project Folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const projectFolder = normalizeFilePath(result.filePaths[0]);
  const manifestPath = path.join(projectFolder, 'presentation.json');
  try {
    const text = await fs.promises.readFile(manifestPath, 'utf-8');
    JSON.parse(text);
  } catch (error) {
    throw new Error(
      'The selected folder is not a valid presentation project. It must contain a valid presentation.json file.',
    );
  }
  allowedProjectReadFolders.add(projectFolder);
  return projectFolder;
});

ipcMain.handle('project:openFolder', async (event, projectFolder) => {
  requireTrustedSender(event);
  const folder = requireProjectFolder(projectFolder, 'read');
  await verifyStagedProject(folder);

  let presentationId = findPresentationIdForProjectFolder(folder);
  if (!presentationId) {
    presentationId = randomUUID();
    persistLinkedProjectFolder(presentationId, folder);
  } else {
    linkedProjectFolders.set(presentationId, folder);
  }
  recordRecentProject(folder);
  return { presentationId, projectFolder: folder };
});

ipcMain.handle('project:readSnapshotFile', async (event, projectFolder, relativePath) => {
  requireTrustedSender(event);
  const folder = requireProjectFolder(projectFolder, 'read');
  const safeRelativePath = validateProjectRelativePath(relativePath);
  if (safeRelativePath === 'presentation.json') {
    throw new Error('Use project:loadSnapshot to read presentation.json.');
  }
  const resolved = path.resolve(folder, safeRelativePath);
  if (!resolved.startsWith(folder + path.sep)) {
    throw new Error(`Invalid project file path: ${relativePath}`);
  }
  const bytes = await fs.promises.readFile(resolved);
  return new Uint8Array(bytes);
});

ipcMain.handle('project:commitSource', async (event, presentationId, projectFolder) => {
  requireTrustedSender(event);
  if (!presentationId) throw new Error('Missing presentation id.');
  const folder = requireProjectFolder(projectFolder, 'read');
  await verifyStagedProject(folder);

  const normalizedFolder = persistLinkedProjectFolder(presentationId, folder);
  recordRecentProject(normalizedFolder);

  let cleanupEligible = false;
  try {
    const eligibleIds = config.get('draftCleanupEligiblePresentationIds', []);
    if (!eligibleIds.includes(presentationId)) {
      config.set('draftCleanupEligiblePresentationIds', [...eligibleIds, presentationId]);
    }
    cleanupEligible = true;
  } catch (error) {
    logger.warn('Could not mark draft cache as cleanup-eligible', {
      presentationId,
      error: error.message,
    });
  }

  return {
    kind: 'project',
    presentationId,
    projectFolder: normalizedFolder,
    status: 'project',
    draftCleanupEligible: cleanupEligible,
  };
});

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
      let folder = getPresentationSourceDescriptor(presentationId).projectFolder;
      if (forceNewFolder || !folder) {
        const chosen = await chooseNewProjectFolder(presentationTitle);
        if (!chosen) return null;
        folder = chosen;
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
      persistLinkedProjectFolder(presentationId, folder);
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

ipcMain.handle('file:readMediaSibling', async (event, folder, relativePath) => {
  requireTrustedSender(event);
  const normFolder = normalizeFilePath(folder);
  if (!allowedProjectReadFolders.has(normFolder)) {
    throw new Error('This folder was not authorized for reading.');
  }
  if (typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }
  const root = path.resolve(normFolder);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }
  try {
    const bytes = await fs.promises.readFile(resolved);
    return new Uint8Array(bytes);
  } catch {
    return null;
  }
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
  persistLinkedProjectFolder(presentationId, projectFolder);
  markPresentationLinked(presentationId);
});

ipcMain.handle('project:getLinkedFolder', async (event, presentationId) => {
  requireTrustedSender(event);
  return getPresentationSourceDescriptor(presentationId).projectFolder;
});

ipcMain.handle('project:getLinkedIds', async (event) => {
  requireTrustedSender(event);
  return Object.keys(readPersistedProjectFolders());
});

ipcMain.handle('project:getSource', async (event, presentationId) => {
  requireTrustedSender(event);
  return getPresentationSourceDescriptor(presentationId);
});

ipcMain.handle('project:getSources', async (event) => {
  requireTrustedSender(event);
  return Object.entries(readPersistedProjectFolders()).map(([presentationId, projectFolder]) => ({
    kind: 'project',
    presentationId,
    projectFolder,
    status: 'project',
  }));
});

ipcMain.handle('project:releaseSource', async (event, presentationId) => {
  requireTrustedSender(event);
  if (!presentationId) return;
  const mappings = readPersistedProjectFolders();
  if (Object.hasOwn(mappings, presentationId)) {
    delete mappings[presentationId];
    config.set('projectFoldersByPresentationId', mappings);
  }
  linkedProjectFolders.delete(presentationId);
  const eligibleIds = config.get('draftCleanupEligiblePresentationIds', []);
  config.set(
    'draftCleanupEligiblePresentationIds',
    eligibleIds.filter((id) => id !== presentationId),
  );
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
        label: 'Open Project Folder...',
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

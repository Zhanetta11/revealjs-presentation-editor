const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const logger = require('./logger.cjs');
const config = require('./config.cjs');
const devtools = isDev ? require('./devtools.cjs') : null;

let mainWindow;

const userDataPath = app.getPath('userData');

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
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  logger.info('Loading URL', { url: startUrl });
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

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
  saveWindowState();
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  dialog.showErrorBox('Error', 'An unexpected error occurred: ' + err.message);
});

ipcMain.handle('dialog:openFile', async () => {
  logger.debug('Open file dialog requested');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Presentations', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.filePaths.length > 0) {
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
  logger.debug('Save file dialog requested', { defaultName, extension });
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'presentation.json',
    filters: SAVE_FILTERS[extension] || SAVE_FILTERS.json,
  });
  if (result.filePath) {
    logger.info('File save path selected', { path: result.filePath });
  }
  return result.filePath;
});

ipcMain.handle('dialog:showError', async (event, title, message) => {
  await dialog.showErrorBox(title, message);
});

ipcMain.handle('dialog:showMessage', async (event, title, message) => {
  await dialog.showMessageBox(mainWindow, { type: 'info', title, message });
});

ipcMain.handle('file:readFile', async (event, filePath) => {
  try {
    logger.debug('Reading file', { path: filePath });
    const content = await fs.promises.readFile(filePath, 'utf-8');
    logger.info('File read successfully', { path: filePath, size: content.length });
    return content;
  } catch (err) {
    logger.error('Failed to read file', { path: filePath, error: err.message });
    throw new Error(`Failed to read file: ${err.message}`);
  }
});

ipcMain.handle('file:writeFile', async (event, filePath, content) => {
  try {
    logger.debug('Writing file', { path: filePath, size: content.length });
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    logger.info('File written successfully', { path: filePath });
  } catch (err) {
    logger.error('Failed to write file', { path: filePath, error: err.message });
    throw new Error(`Failed to write file: ${err.message}`);
  }
});

ipcMain.handle('app:getAppPath', () => app.getAppPath());
ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.on('file:openFromDrop', (event, filePath) => {
  if (mainWindow) {
    mainWindow.webContents.send('file:dropped', filePath);
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
            if (fs.existsSync(windowStatePath)) {
              fs.unlinkSync(windowStatePath);
            }
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

ipcMain.handle('config:get', (event, key) => {
  return config.get(key);
});

ipcMain.handle('config:set', (event, key, value) => {
  config.set(key, value);
  logger.debug('Config updated', { key, valueType: typeof value });
});

ipcMain.handle('logs:getDir', () => {
  return logger.getLogsDir();
});

if (isDev && devtools) {
  ipcMain.handle('devtools:getMetrics', () => {
    return devtools.getMetrics();
  });

  ipcMain.handle('devtools:getMemory', () => {
    return devtools.getMemoryInfo();
  });
}
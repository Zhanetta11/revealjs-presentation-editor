const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');

let mainWindow;

const userDataPath = app.getPath('userData');
const windowStatePath = path.join(userDataPath, 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      return JSON.parse(fs.readFileSync(windowStatePath, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load window state:', err);
  }
  return { width: 1280, height: 720, x: undefined, y: undefined };
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
      fs.writeFileSync(windowStatePath, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('Failed to save window state:', err);
    }
  }
}

function createWindow() {
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
    console.error('Renderer process crashed');
    dialog.showErrorBox('Error', 'The application has crashed. Please restart.');
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', saveWindowState);

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  dialog.showErrorBox('Error', 'An unexpected error occurred: ' + err.message);
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Presentations', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'presentation.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
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
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
});

ipcMain.handle('file:writeFile', async (event, filePath, content) => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write file: ${err.message}`);
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
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:writeFile', filePath, content),

  showError: (title, message) => ipcRenderer.invoke('dialog:showError', title, message),
  showMessage: (title, message) => ipcRenderer.invoke('dialog:showMessage', title, message),

  onMenuNew: (callback) => ipcRenderer.on('menu:new', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu:open', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu:saveAs', callback),

  onFileDrop: (callback) => ipcRenderer.on('file:dropped', (event, filePath) => callback(filePath)),

  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),

  getLogsDir: () => ipcRenderer.invoke('logs:getDir'),
});
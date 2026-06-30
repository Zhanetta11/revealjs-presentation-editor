const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName, extension) => ipcRenderer.invoke('dialog:saveFile', defaultName, extension),
  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:writeFile', filePath, content),

  showError: (title, message) => ipcRenderer.invoke('dialog:showError', title, message),
  showMessage: (title, message) => ipcRenderer.invoke('dialog:showMessage', title, message),

  onMenuNew: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('menu:new', listener);
    return () => ipcRenderer.removeListener('menu:new', listener);
  },
  onMenuOpen: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('menu:open', listener);
    return () => ipcRenderer.removeListener('menu:open', listener);
  },
  onMenuSave: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('menu:save', listener);
    return () => ipcRenderer.removeListener('menu:save', listener);
  },
  onMenuSaveAs: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('menu:saveAs', listener);
    return () => ipcRenderer.removeListener('menu:saveAs', listener);
  },

  onFileDrop: (callback) => {
    const listener = (event, filePath) => callback(filePath);
    ipcRenderer.on('file:dropped', listener);
    return () => ipcRenderer.removeListener('file:dropped', listener);
  },

  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),

  getLogsDir: () => ipcRenderer.invoke('logs:getDir'),

  getDevMetrics: () => ipcRenderer.invoke('devtools:getMetrics'),
  getMemoryInfo: () => ipcRenderer.invoke('devtools:getMemory'),
});
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName, extension, options) => ipcRenderer.invoke('dialog:saveFile', defaultName, extension, options),
  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:writeFile', filePath, content),
  writeLinkedFile: (content) => ipcRenderer.invoke('file:writeLinkedFile', content),

  showError: (title, message) => ipcRenderer.invoke('dialog:showError', title, message),
  showMessage: (title, message) => ipcRenderer.invoke('dialog:showMessage', title, message),

  storageGet: (key) => ipcRenderer.invoke('storage:get', key),
  storageSet: (key, payload) => ipcRenderer.invoke('storage:set', key, payload),
  storageRemove: (key) => ipcRenderer.invoke('storage:remove', key),
  storageListKeys: () => ipcRenderer.invoke('storage:listKeys'),

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

  onBeforeQuit: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:beforeQuit', listener);
    return () => ipcRenderer.removeListener('app:beforeQuit', listener);
  },
  notifyQuitReady: (success = true, message = '') =>
    ipcRenderer.send('app:quitReady', { success: Boolean(success), message: String(message) }),

});

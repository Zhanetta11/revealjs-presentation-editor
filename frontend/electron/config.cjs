const Store = require('electron-store').default || require('electron-store');

const schema = {
  recentProjects: {
    type: 'array',
    default: [],
  },
  linkedPresentationIds: {
    type: 'array',
    default: [],
  },
  windowState: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      x: { type: 'number' },
      y: { type: 'number' },
      isMaximized: { type: 'boolean' },
    },
    default: {
      width: 1280,
      height: 720,
      x: undefined,
      y: undefined,
      isMaximized: false,
    },
  },
  appSettings: {
    type: 'object',
    properties: {
      theme: { type: 'string' },
      language: { type: 'string' },
      autoSave: { type: 'boolean' },
      autoSaveInterval: { type: 'number' },
      recentFiles: { type: 'array' },
    },
    default: {
      theme: 'light',
      language: 'en',
      autoSave: true,
      autoSaveInterval: 60000,
      recentFiles: [],
    },
  },
};

const store = new Store({ schema });

module.exports = {
  get: (key, defaultValue) => store.get(key, defaultValue),
  set: (key, value) => store.set(key, value),
  delete: (key) => store.delete(key),
  clear: () => store.clear(),
  all: () => store.store,
};
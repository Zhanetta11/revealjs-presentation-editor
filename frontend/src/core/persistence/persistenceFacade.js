import { storageAdapter } from "./storage/storageAdapter";
import {
  getIndex,
  createPresentation,
  updateIndexEntry,
  deletePresentation,
  deleteDraftManifest,
  loadPresentation,
  savePresentation,
  presentationKey,
} from "./storage/presentationsLibrary";
import { storeMediaFile, getMediaFile } from "./storage/mediaStorage";
import { downloadPresentationAsJson } from "./serialization/serializationOperations";
export {
  PresentationSourceKind,
  PresentationSourceStatus,
  PresentationSourcePlatform,
  createDraftSource,
  createProjectSource,
  createCommittingSource,
  normalizePresentationSource,
  getPresentationSource,
  getProjectPresentationSources,
  releasePresentationSource,
} from "./project/sourceMetadata";

export const storageGet    = (key)        => storageAdapter.get(key);
export const storageSet    = (key, value) => storageAdapter.set(key, value);
export const storageRemove = (key)        => storageAdapter.remove(key);

export {
  getIndex,
  createPresentation,
  updateIndexEntry,
  deletePresentation,
  deleteDraftManifest,
  loadPresentation,
  savePresentation,
  presentationKey,
};

export { storeMediaFile, getMediaFile };

export { downloadPresentationAsJson };
export {
  chooseElectronProjectFolder,
  chooseElectronProjectToOpen,
  openElectronProjectFolder,
  writeElectronProjectSnapshot,
  loadElectronProjectSnapshot,
  commitElectronProjectSource,
  writeAndCommitElectronProjectSnapshot,
} from "./project/electronProjectFolder";
export {
  openBrowserProjectFolderFromPicker,
  saveBrowserProjectSnapshot,
  writeBrowserProjectSnapshot,
  loadBrowserLinkedProjectSnapshot,
  linkBrowserProjectFolder,
} from "./project/browserProjectFolder";

const localStorageSettings = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* private-browsing / quota */ }
  },
};

const settingsBackend = localStorageSettings;
const SETTINGS_CACHE = new Map();

export const getSetting = (key, defaultValue = null) => {
  const v = settingsBackend.get(key);
  if (v !== null && v !== undefined) return v;
  return SETTINGS_CACHE.get(key) ?? defaultValue;
};

export const setSetting = (key, value) => {
  SETTINGS_CACHE.set(key, String(value));
  settingsBackend.set(key, value);
};

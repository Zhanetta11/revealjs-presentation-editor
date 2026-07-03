import { isElectron, getElectronAPI } from "./electron";

export const confirmDialog = async (title, message) => {
  if (isElectron()) return getElectronAPI().confirm(title, message);
  return window.confirm(message);
};

export const showErrorDialog = async (title, message) => {
  if (isElectron()) {
    await getElectronAPI().showError(title, message);
    return;
  }
  window.alert(`${title}: ${message}`);
};

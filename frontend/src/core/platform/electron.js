export const isElectron = () =>
  typeof window !== "undefined" && Boolean(window.electronAPI);

export const getElectronAPI = () => (isElectron() ? window.electronAPI : null);

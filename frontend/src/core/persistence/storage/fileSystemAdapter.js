import { getElectronAPI } from "../../platform/electron";

export const fileSystemAdapter = {
  async set(key, value) {
    const api = getElectronAPI();
    if (value instanceof Blob) {
      const bytes = new Uint8Array(await value.arrayBuffer());
      await api.storageSet(key, { kind: "binary", bytes, type: value.type });
    } else {
      await api.storageSet(key, { kind: "text", text: JSON.stringify(value) });
    }
  },

  async get(key) {
    const api = getElectronAPI();
    const result = await api.storageGet(key);
    if (!result) return null;
    if (result.kind === "binary") {
      return new Blob([result.bytes], { type: result.type });
    }
    return JSON.parse(result.text);
  },

  async remove(key) {
    const api = getElectronAPI();
    await api.storageRemove(key);
  },

  async getAllKeys() {
    const api = getElectronAPI();
    return api.storageListKeys();
  },

  async getAllPresentationIds() {
    const keys = await this.getAllKeys();
    return keys
      .filter((k) => k.startsWith("presentation-"))
      .map((k) => k.slice("presentation-".length));
  },
};

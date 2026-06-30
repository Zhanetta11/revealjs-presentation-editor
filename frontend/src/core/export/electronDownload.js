import { getElectronAPI } from "../platform/electron";

const extensionOf = (filename) => filename.split(".").pop()?.toLowerCase() ?? "";

const saveToPath = async (filename, content) => {
  const api = getElectronAPI();
  const filePath = await api.saveFile(filename, extensionOf(filename));
  if (!filePath) return;
  await api.writeFile(filePath, content);
};

export const electronDownload = {
  async saveBlob(blob, filename) {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await saveToPath(filename, buffer);
  },

  async saveText(content, filename) {
    await saveToPath(filename, content);
  },
};

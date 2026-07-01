import { storageAdapter } from "./storageAdapter";

const extensionFor = (file) => {
  const [, subtype] = (file.type || "").split("/");
  return subtype || "bin";
};

export const indexedDbMediaStorage = {
  async store(file) {
    const mediaId = crypto.randomUUID();
    const key = `media/${mediaId}.${extensionFor(file)}`;
    await storageAdapter.set(key, file);
    return { mediaId, key };
  },
};

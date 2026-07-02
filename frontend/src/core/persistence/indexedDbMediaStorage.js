import { storageAdapter } from "./storageAdapter";

const MAX_MEDIA_BYTES = 500 * 1024 * 1024;

const extensionFor = (file) => {
  const [, subtype] = (file.type || "").split("/");
  return subtype || "bin";
};

export const indexedDbMediaStorage = {
  async store(file) {
    if (file.size > MAX_MEDIA_BYTES) {
      throw new Error(
        "The media file is larger than 500 MB. Compress the video or trim it to a shorter clip, then try again.",
      );
    }
    const mediaId = crypto.randomUUID();
    const key = `media/${mediaId}.${extensionFor(file)}`;
    await storageAdapter.set(key, file);
    return { mediaId, key };
  },
};

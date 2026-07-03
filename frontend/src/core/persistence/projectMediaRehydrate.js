import { storeMediaFile, storeMediaFileAtKey } from "./mediaStorage";

const isRelativeMediaPath = (value) =>
  typeof value === "string" && (value.startsWith("media/") || value.startsWith("fonts/"));

const MIME_TYPES_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const mimeFromExtension = (relativePath) => {
  const ext = relativePath.split(".").pop()?.toLowerCase();
  return MIME_TYPES_BY_EXTENSION[ext] ?? "application/octet-stream";
};

export async function rehydrateProjectMedia(
  presentation,
  readFile,
  { cacheKeyForPath = null } = {},
) {
  const cache = new Map();

  const resolveRef = (relativePath) => {
    if (!cache.has(relativePath)) {
      cache.set(
        relativePath,
        (async () => {
          const bytes = await readFile(relativePath);
          if (!bytes) return null;
          const blob = new Blob([bytes], { type: mimeFromExtension(relativePath) });
          const preferredKey = cacheKeyForPath
            ? await cacheKeyForPath(relativePath)
            : null;
          const { key } = preferredKey
            ? await storeMediaFileAtKey(preferredKey, blob)
            : await storeMediaFile(blob);
          return `indexeddb://${key}`;
        })(),
      );
    }
    return cache.get(relativePath);
  };

  const walk = async (value) => {
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (!value || typeof value !== "object") return value;

    const entries = await Promise.all(
      Object.entries(value).map(async ([key, child]) => {
        const isMediaRef = (key === "file-link" || key === "font-file") && isRelativeMediaPath(child);
        if (!isMediaRef) return [key, await walk(child)];
        const rewritten = await resolveRef(child);
        return [key, rewritten ?? child];
      }),
    );
    return Object.fromEntries(entries);
  };

  return walk(presentation);
}

export async function rehydrateProjectManifestJson(jsonText, readFile, options) {
  const parsed = JSON.parse(jsonText);
  const rehydrated = await rehydrateProjectMedia(parsed, readFile, options);
  return JSON.stringify(rehydrated);
}

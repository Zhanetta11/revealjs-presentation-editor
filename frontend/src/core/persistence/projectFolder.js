import { getMediaFile } from "./mediaStorage";
import { serializePresentation } from "./serializationOperations";

const extensionFromBlob = (blob, fallback) => (blob.type || "").split("/")[1] || fallback;

const buildResolvedPresentation = async (presentation, { requireResolvedMedia = false } = {}) => {
  const counters = { image: 1, video: 1, font: 1 };
  const mediaFiles = [];

  const walk = async (value, parent) => {
    if (Array.isArray(value)) return Promise.all(value.map((item) => walk(item, parent)));
    if (!value || typeof value !== "object") return value;

    const entries = await Promise.all(
      Object.entries(value).map(async ([key, child]) => {
        const isMediaRef = key === "file-link" && typeof child === "string" && child.startsWith("indexeddb://");
        const isFontRef = key === "font-file" && typeof child === "string" && child.startsWith("indexeddb://");
        if (!isMediaRef && !isFontRef) {
          return [key, await walk(child, value)];
        }

        const mediaKey = child.slice("indexeddb://".length);
        const blob = await getMediaFile(mediaKey);
        if (!blob) {
          if (requireResolvedMedia) {
            throw new Error(`Required project asset is missing from storage: ${mediaKey}`);
          }
          return [key, child];
        }

        const kind = isFontRef ? "font" : (value["media-type"] === "video" ? "video" : "image");
        const fallbackExt = kind === "video" ? "mp4" : kind === "font" ? "ttf" : "png";
        const ext = extensionFromBlob(blob, fallbackExt);
        const relativePath = kind === "font"
          ? `fonts/font_${counters.font++}.${ext}`
          : `media/${kind}/${kind}_${counters[kind]++}.${ext}`;

        mediaFiles.push({ relativePath, blob });
        return [key, relativePath];
      }),
    );
    return Object.fromEntries(entries);
  };

  const resolvedPresentation = await walk(presentation, null);
  return { resolvedPresentation, mediaFiles };
};

export const buildProjectManifest = async (
  presentation,
  { requireResolvedMedia = false } = {},
) => {
  const { resolvedPresentation, mediaFiles } = await buildResolvedPresentation(
    presentation,
    { requireResolvedMedia },
  );
  const jsonText = serializePresentation(resolvedPresentation);
  return { jsonText, mediaFiles };
};

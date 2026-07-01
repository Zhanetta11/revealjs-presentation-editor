import { createId, getSlides, setSlides } from "../utils/presentationUtils";
import {
  clampCrop,
  clampCropEdges,
  clampCropPan,
  getCroppedMediaGeometry,
} from "../model/mediaCrop";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export { clampCrop, clampCropEdges, clampCropPan };

export const computeCropOrigin = (media) => {
  const {
    crop: [ct, cr, cb, cl],
    scale,
    sourceWidth,
    sourceHeight,
    renderedSourceWidth: srcW,
    renderedSourceHeight: srcH,
  } = getCroppedMediaGeometry(media);
  const fullX = (media.position?.x ?? 0) - (cl / 100) * srcW;
  const fullY = (media.position?.y ?? 0) - (ct / 100) * srcH;
  return { fullX, fullY, srcW, srcH, sourceWidth, sourceHeight, scale, initialCrop: [ct, cr, cb, cl] };
};

export const computeCropResult = (crop, cropOrigin) => {
  const [ct, cr, cb, cl] = clampCrop(crop);
  const { fullX, fullY, srcW, srcH } = cropOrigin;
  const scale = cropOrigin.scale ?? 1;
  const x1n = (cl / 100) * srcW, x2n = srcW - (cr / 100) * srcW;
  const y1n = (ct / 100) * srcH, y2n = srcH - (cb / 100) * srcH;
  let winX1 = clamp(Math.min(x1n, x2n), 0, srcW);
  let winX2 = clamp(Math.max(x1n, x2n), 0, srcW);
  let winY1 = clamp(Math.min(y1n, y2n), 0, srcH);
  let winY2 = clamp(Math.max(y1n, y2n), 0, srcH);
  const minWidth = Math.min(1, srcW);
  const minHeight = Math.min(1, srcH);
  if (winX2 - winX1 < minWidth) winX1 = Math.max(0, winX2 - minWidth);
  if (winY2 - winY1 < minHeight) winY1 = Math.max(0, winY2 - minHeight);
  return {
    crop: [winY1 / srcH * 100, (srcW - winX2) / srcW * 100, (srcH - winY2) / srcH * 100, winX1 / srcW * 100],
    position: { x: fullX + winX1, y: fullY + winY1 },
    width: Math.max(1, winX2 - winX1),
    height: Math.max(1, winY2 - winY1),
    "source-width": cropOrigin.sourceWidth ?? srcW / scale,
    "source-height": cropOrigin.sourceHeight ?? srcH / scale,
  };
};

export const createImageMediaElement = (mediaId, key, { width = 300, height = 200 } = {}) => ({
  id: mediaId,
  "file-link": `indexeddb://${key}`,
  "media-type": "image",
  position: { x: 60, y: 60 },
  width,
  height,
  "source-width": width,
  "source-height": height,
  rotation: 0,
  "z-index": 1,
  scale: 1,
  crop: [],
  effects: {},
  opacity: 1,
  playback: {},
});

export const createVideoMediaElement = (mediaId, key, { width = 480, height = 270 } = {}) => ({
  id: mediaId,
  "file-link": `indexeddb://${key}`,
  "media-type": "video",
  position: { x: 60, y: 60 },
  width,
  height,
  "source-width": width,
  "source-height": height,
  rotation: 0,
  "z-index": 1,
  scale: 1,
  crop: [],
  effects: {},
  opacity: 1,
  playback: { autoplay: false, loop: false, muted: false },
});

export const addMedia = (presentation, slideIndex, mediaData) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];

  if (!slide) return presentation;

  const mediaElement = {
    id: mediaData.id ?? createId("media"),
    "file-link": mediaData["file-link"] ?? "",
    "media-type": mediaData["media-type"] ?? "image",
    position: mediaData.position ?? { x: 10, y: 10 },
    width: mediaData.width ?? 300,
    height: mediaData.height ?? 200,
    ...(mediaData["source-width"] != null ? { "source-width": mediaData["source-width"] } : {}),
    ...(mediaData["source-height"] != null ? { "source-height": mediaData["source-height"] } : {}),
    rotation: mediaData.rotation ?? 0,
    "z-index": mediaData["z-index"] ?? 1,
    scale: mediaData.scale ?? 1,
    crop: mediaData.crop ?? [],
    effects: mediaData.effects ?? {},
    opacity: mediaData.opacity ?? 1,
    playback: mediaData.playback ?? {},
  };

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      media: [...(slide.contents?.media ?? []), mediaElement],
    },
  };

  return setSlides(presentation, slides);
};

export const deleteMedia = (presentation, slideIndex, mediaId) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];

  if (!slide) return presentation;

  const remaining = (slide.contents?.media ?? []).filter((media) => media.id !== mediaId);
  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      media: remaining,
      animations: (slide.contents?.animations ?? [])
        .filter((a) => a.id !== mediaId)
        .map((a, index) => ({ ...a, sequence: index + 1 })),
    },
  };

  return setSlides(presentation, slides);
};

export const updateMedia = (presentation, slideIndex, mediaId, updates) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];

  if (!slide) return presentation;

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      media: (slide.contents?.media ?? []).map((media) =>
        media.id === mediaId ? { ...media, ...updates } : media,
      ),
    },
  };

  return setSlides(presentation, slides);
};

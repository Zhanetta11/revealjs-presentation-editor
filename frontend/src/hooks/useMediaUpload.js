import { useCallback } from "react";
import { storeMediaFile } from "../core/persistence/persistenceFacade";
import { createImageMediaElement, createVideoMediaElement } from "../core/operations/mediaOperations";
import { showErrorDialog } from "../core/platform/dialogs";

function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 300, height: 200 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function readVideoDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ width: 480, height: 270 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

function fitToSlide(width, height, slideWidth, slideHeight) {
  const maxW = slideWidth * 0.3;
  const maxH = slideHeight * 0.3;
  if (width <= maxW && height <= maxH) return { width, height };
  const scale = Math.min(maxW / width, maxH / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function reportUploadError(kind, error) {
  console.error(`[MediaUpload] Failed to add ${kind}:`, error);
  showErrorDialog("Upload Failed", `Could not add the ${kind}: ${error?.message ?? "unknown error"}`);
}

export function useMediaUpload(addMedia, slideWidth = 1280, slideHeight = 720) {
  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      try {
        const [{ mediaId, key }, dims] = await Promise.all([
          storeMediaFile(file),
          readImageDimensions(file),
        ]);
        const scaledDims = fitToSlide(dims.width, dims.height, slideWidth, slideHeight);
        addMedia(createImageMediaElement(mediaId, key, scaledDims));
      } catch (error) {
        reportUploadError("image", error);
      } finally {
        event.target.value = "";
      }
    },
    [addMedia, slideWidth, slideHeight],
  );

  const handleVideoUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith("video/")) return;

      try {
        const [{ mediaId, key }, dims] = await Promise.all([
          storeMediaFile(file),
          readVideoDimensions(file),
        ]);
        const scaledDims = fitToSlide(dims.width, dims.height, slideWidth, slideHeight);
        addMedia(createVideoMediaElement(mediaId, key, scaledDims));
      } catch (error) {
        reportUploadError("video", error);
      } finally {
        event.target.value = "";
      }
    },
    [addMedia, slideWidth, slideHeight],
  );

  return { handleImageUpload, handleVideoUpload };
}

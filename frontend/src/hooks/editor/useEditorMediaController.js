import { useCallback } from "react";
import {
  createImageMediaElement,
  createVideoMediaElement,
} from "../../core/operations/mediaOperations";
import { storeMediaFile } from "../../core/persistence/persistenceFacade";
import { showErrorDialog } from "../../core/platform/dialogs";
import { EditorEventType, createEditorEvent } from "../../core/events/editorEvents";
import { exportToReveal, exportToRevealZip } from "../../core/export/exportToReveal";
import { useMediaUpload } from "../media/useMediaUpload";
import {
  readImageDimensionsFromFile,
  readVideoDimensionsFromFile,
} from "./editorControllerHelpers";

export function useEditorMediaController({
  presentation,
  selectedMediaElement,
  slideWidth,
  slideHeight,
  eventBus,
  isSlideMasterOpen,
  selectedMasterLayoutId,
  addMedia,
  updateMedia,
  updateElement,
  addLayoutElement,
  addMasterElement,
  beginHistory,
  commitHistory,
}) {
  const handleChangePicture = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      if (!selectedMediaElement?.id) return;
      const naturalSize = await readImageDimensionsFromFile(file);
      const maxWidth = slideWidth * 0.3;
      const maxHeight = slideHeight * 0.3;
      const scale = Math.min(
        1,
        maxWidth / naturalSize.width,
        maxHeight / naturalSize.height,
      );
      const { key } = await storeMediaFile(file);
      updateMedia(selectedMediaElement.id, {
        "file-link": `indexeddb://${key}`,
        width: Math.round(naturalSize.width * scale),
        height: Math.round(naturalSize.height * scale),
        "source-width": naturalSize.width,
        "source-height": naturalSize.height,
        crop: null,
      });
    },
    [
      selectedMediaElement,
      slideWidth,
      slideHeight,
      updateMedia,
    ],
  );

  const handleApplyBgFillImage = useCallback(
    async (file, currentSettings) => {
      if (!file || !file.type.startsWith("image/")) return;
      let key;
      try {
        ({ key } = await storeMediaFile(file));
      } catch (error) {
        console.error("[Editor] Failed to store background image:", error);
        showErrorDialog(
          "Upload Failed",
          `Could not set the background image: ${error?.message ?? "unknown error"}`,
        );
        return;
      }
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_BACKGROUND, {
          background: {
            type: "image",
            "file-link": `indexeddb://${key}`,
            ...(currentSettings ?? {}),
          },
        }),
      );
    },
    [eventBus],
  );

  const {
    handleImageUpload,
    handleVideoUpload,
  } = useMediaUpload(addMedia, slideWidth, slideHeight);
  const masterAddMedia = useCallback(
    (mediaElement) => {
      if (selectedMasterLayoutId) {
        addLayoutElement(
          selectedMasterLayoutId,
          "media",
          mediaElement,
        );
      } else {
        addMasterElement("media", mediaElement);
      }
    },
    [selectedMasterLayoutId, addLayoutElement, addMasterElement],
  );
  const {
    handleImageUpload: handleMasterImageUpload,
    handleVideoUpload: handleMasterVideoUpload,
  } = useMediaUpload(masterAddMedia, slideWidth, slideHeight);

  const activeImageUpload = isSlideMasterOpen
    ? handleMasterImageUpload
    : handleImageUpload;
  const activeVideoUpload = isSlideMasterOpen
    ? handleMasterVideoUpload
    : handleVideoUpload;
  const exportPresentation = useCallback(
    () => exportToReveal(presentation),
    [presentation],
  );
  const handleExportZip = useCallback(
    () => exportToRevealZip(presentation),
    [presentation],
  );

  const handlePlaceholderImageUpload = useCallback(
    async (placeholderElement, file) => {
      if (!placeholderElement || !file?.type?.startsWith("image/")) return;
      let mediaId, key, naturalSize;
      try {
        [{ mediaId, key }, naturalSize] = await Promise.all([
          storeMediaFile(file),
          readImageDimensionsFromFile(file),
        ]);
      } catch (error) {
        console.error("[Editor] Failed to store placeholder image:", error);
        showErrorDialog(
          "Upload Failed",
          `Could not add the image: ${error?.message ?? "unknown error"}`,
        );
        return;
      }
      const phW = placeholderElement.width ?? naturalSize.width;
      const phH = placeholderElement.height ?? naturalSize.height;
      const naturalW = naturalSize.width > 0 ? naturalSize.width : phW;
      const naturalH = naturalSize.height > 0 ? naturalSize.height : phH;
      const scale = Math.min(phW / naturalW, phH / naturalH);
      const fitW = Math.round(naturalW * scale);
      const fitH = Math.round(naturalH * scale);
      const phPos = placeholderElement.position ?? { x: 60, y: 60 };
      const fitX = Math.round(phPos.x + (phW - fitW) / 2);
      const fitY = Math.round(phPos.y + (phH - fitH) / 2);
      beginHistory();
      addMedia({
        ...createImageMediaElement(mediaId, key, {
          width: fitW,
          height: fitH,
        }),
        "placeholder-id": placeholderElement["placeholder-id"],
        position: { x: fitX, y: fitY },
        width: fitW,
        height: fitH,
        "source-width": fitW,
        "source-height": fitH,
        "z-index": placeholderElement["z-index"] ?? 1,
      });
      updateElement(placeholderElement.id, { hidden: true });
      commitHistory();
    },
    [addMedia, updateElement, beginHistory, commitHistory],
  );

  const handlePlaceholderVideoUpload = useCallback(
    async (placeholderElement, file) => {
      if (!placeholderElement || !file?.type?.startsWith("video/")) return;
      let mediaId, key, naturalSize;
      try {
        [{ mediaId, key }, naturalSize] = await Promise.all([
          storeMediaFile(file),
          readVideoDimensionsFromFile(file),
        ]);
      } catch (error) {
        console.error("[Editor] Failed to store placeholder video:", error);
        showErrorDialog(
          "Upload Failed",
          `Could not add the video: ${error?.message ?? "unknown error"}`,
        );
        return;
      }
      const phW = placeholderElement.width ?? naturalSize.width;
      const phH = placeholderElement.height ?? naturalSize.height;
      const naturalW = naturalSize.width > 0 ? naturalSize.width : phW;
      const naturalH = naturalSize.height > 0 ? naturalSize.height : phH;
      const scale = Math.min(phW / naturalW, phH / naturalH);
      const fitW = Math.round(naturalW * scale);
      const fitH = Math.round(naturalH * scale);
      const phPos = placeholderElement.position ?? { x: 60, y: 60 };
      const fitX = Math.round(phPos.x + (phW - fitW) / 2);
      const fitY = Math.round(phPos.y + (phH - fitH) / 2);
      beginHistory();
      addMedia({
        ...createVideoMediaElement(mediaId, key, {
          width: fitW,
          height: fitH,
        }),
        "placeholder-id": placeholderElement["placeholder-id"],
        position: { x: fitX, y: fitY },
        width: fitW,
        height: fitH,
        "z-index": placeholderElement["z-index"] ?? 1,
      });
      updateElement(placeholderElement.id, { hidden: true });
      commitHistory();
    },
    [addMedia, updateElement, beginHistory, commitHistory],
  );

  return {
    handleChangePicture,
    handleApplyBgFillImage,
    activeImageUpload,
    activeVideoUpload,
    exportPresentation,
    handleExportZip,
    handlePlaceholderImageUpload,
    handlePlaceholderVideoUpload,
  };
}

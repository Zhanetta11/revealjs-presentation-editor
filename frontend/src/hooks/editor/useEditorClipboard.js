import { useCallback } from "react";
import { getSlideElement } from "../../core/operations/slideOperations";
import { createImageMediaElement } from "../../core/operations/mediaOperations";
import { storeMediaFile } from "../../core/persistence/persistenceFacade";
import {
  htmlToClipboardParagraphs,
  insertClipboardParagraphs,
  plainTextToClipboardParagraphs,
} from "../../core/text/clipboardText";
import {
  fitImageToSlide,
  paragraphText,
  readClipboardPayload,
  readImageDimensionsFromFile,
} from "./editorControllerHelpers";

export function useEditorClipboard({
  selectedSlide,
  selectedElementId,
  selectedElements,
  selectedTextElement,
  selectedSlideIndex,
  presentation,
  clipboard,
  currentFormatting,
  activeSelectionRef,
  setActiveSelection,
  setPendingFormatting,
  updateTextElementParagraphs,
  slideWidth,
  slideHeight,
  addMedia,
  updateElement,
  beginHistory,
  commitHistory,
  copyElement,
  cutElement,
  pasteElement,
}) {
  const handleCopy = useCallback(
    (elementOrEvent) => {
      if (selectedElements.length > 1 && !elementOrEvent?.id) {
        copyElement(selectedElements);
        return;
      }
      const element = elementOrEvent?.id
        ? elementOrEvent
        : getSlideElement(selectedSlide, selectedElementId);
      if (element) copyElement(element);
    },
    [selectedSlide, selectedElementId, selectedElements, copyElement],
  );

  const handleCut = useCallback(
    (elementOrEvent) => {
      if (selectedElements.length > 1 && !elementOrEvent?.id) {
        cutElement(selectedElements);
        return;
      }
      const element = elementOrEvent?.id
        ? elementOrEvent
        : getSlideElement(selectedSlide, selectedElementId);
      if (element) cutElement(element);
    },
    [selectedSlide, selectedElementId, selectedElements, cutElement],
  );

  const handlePaste = useCallback(() => pasteElement(), [pasteElement]);

  const handlePasteText = useCallback(
    async (elementId, mode = "destination") => {
      const targetId = elementId ?? selectedElementId;
      const textElement =
        targetId === selectedTextElement?.id
          ? selectedTextElement
          : (selectedSlide?.contents?.text ?? []).find(
              (element) => element.id === targetId,
            );
      if (!targetId || !textElement) return false;
      const activeSelection = activeSelectionRef.current;
      const lastParagraphIdx = Math.max(
        0,
        (textElement.paragraphs?.length ?? 1) - 1,
      );
      const lastOffset = paragraphText(
        textElement.paragraphs?.[lastParagraphIdx],
      ).length;
      const selection =
        activeSelection?.elementId === targetId
          ? activeSelection
          : {
              elementId: targetId,
              paragraphIdx: lastParagraphIdx,
              rangeStart: lastOffset,
              endParagraphIdx: lastParagraphIdx,
              rangeEnd: lastOffset,
            };

      const payload = await readClipboardPayload();
      const internalClipboard = Array.isArray(clipboard)
        ? clipboard
        : clipboard
          ? [clipboard]
          : [];
      const internalText = internalClipboard.find(
        (element) => element["media-type"] === undefined,
      );
      const htmlParagraphs = payload.html
        ? htmlToClipboardParagraphs(payload.html)
        : [];
      const htmlPlainText = htmlParagraphs
        .map((paragraph) => paragraphText(paragraph))
        .join("\n");
      const internalPlainText = (internalText?.paragraphs ?? [])
        .map((paragraph) => paragraphText(paragraph))
        .join("\n");
      const clipboardText =
        payload.text || htmlPlainText || internalPlainText;

      let clipboardParagraphs = [];
      if (mode === "source" && htmlParagraphs.length) {
        clipboardParagraphs = htmlParagraphs;
      }
      if (
        mode === "source" &&
        clipboardParagraphs.length === 0 &&
        internalText?.paragraphs?.length
      ) {
        clipboardParagraphs = structuredClone(internalText.paragraphs);
      }
      if (clipboardParagraphs.length === 0 && clipboardText) {
        clipboardParagraphs = plainTextToClipboardParagraphs(
          clipboardText,
          mode === "text" ? {} : currentFormatting,
        );
      }
      if (clipboardParagraphs.length === 0) return false;

      const result = insertClipboardParagraphs(
        textElement.paragraphs,
        selection,
        clipboardParagraphs,
      );
      if (!result) return false;
      updateTextElementParagraphs(
        selectedSlideIndex,
        targetId,
        result.paragraphs,
        false,
      );
      const nextSelection = { elementId: targetId, ...result.selection };
      activeSelectionRef.current = nextSelection;
      setActiveSelection(nextSelection);
      setPendingFormatting({});
      return true;
    },
    [
      activeSelectionRef,
      clipboard,
      currentFormatting,
      selectedElementId,
      selectedSlide,
      selectedSlideIndex,
      selectedTextElement,
      setActiveSelection,
      setPendingFormatting,
      updateTextElementParagraphs,
    ],
  );

  const handlePastePicture = useCallback(
    async (targetElementId) => {
      const targetElement = targetElementId
        ? (selectedSlide?.contents?.text ?? []).find(
            (element) => element.id === targetElementId,
          ) ?? selectedTextElement
        : selectedTextElement;
      const scaleToPlaceholder = (
        naturalWidth,
        naturalHeight,
        placeholderWidth,
        placeholderHeight,
      ) => {
        const scale =
          placeholderHeight > placeholderWidth
            ? placeholderHeight / naturalHeight
            : placeholderWidth / naturalWidth;
        return {
          width: Math.round(naturalWidth * scale),
          height: Math.round(naturalHeight * scale),
        };
      };
      const findLayoutTextId = (element) => {
        if (!element) return null;
        if (element["placeholder-id"]) return element["placeholder-id"];
        const layout = (presentation?.slideset?.layouts ?? []).find(
          (item) => item["layout-id"] === selectedSlide?.["layout-id"],
        );
        const ex = element.position?.x ?? 0;
        const ey = element.position?.y ?? 0;
        const ew = element.width ?? 300;
        const eh = element.height ?? 80;
        return (layout?.elements?.text ?? []).find((layoutText) => {
          const lx = layoutText.position?.x ?? 0;
          const ly = layoutText.position?.y ?? 0;
          const lw = layoutText.width ?? 300;
          const lh = layoutText.height ?? 80;
          const overlapX = Math.max(
            0,
            Math.min(ex + ew, lx + lw) - Math.max(ex, lx),
          );
          const overlapY = Math.max(
            0,
            Math.min(ey + eh, ly + lh) - Math.max(ey, ly),
          );
          return overlapX * overlapY > Math.min(ew * eh, lw * lh) * 0.3;
        })?.id ?? null;
      };
      const withPlaceholder = (properties) => {
        const placeholderId = findLayoutTextId(targetElement);
        return placeholderId
          ? { ...properties, "placeholder-id": placeholderId }
          : properties;
      };
      const placeImage = (mediaId, key, naturalSize) => {
        if (!targetElement) {
          addMedia(
            createImageMediaElement(
              mediaId,
              key,
              fitImageToSlide(
                naturalSize.width,
                naturalSize.height,
                slideWidth,
                slideHeight,
              ),
            ),
          );
          return;
        }
        const size = scaleToPlaceholder(
          naturalSize.width,
          naturalSize.height,
          targetElement.width ?? naturalSize.width,
          targetElement.height ?? naturalSize.height,
        );
        beginHistory();
        addMedia(
          withPlaceholder({
            ...createImageMediaElement(mediaId, key, size),
            position: targetElement.position ?? { x: 60, y: 60 },
            "source-width": naturalSize.width,
            "source-height": naturalSize.height,
            "z-index": targetElement["z-index"] ?? 1,
          }),
        );
        updateElement(targetElement.id, { hidden: true });
        commitHistory();
      };
      const internalClipboard = Array.isArray(clipboard)
        ? clipboard
        : clipboard
          ? [clipboard]
          : [];
      const internalMedia = internalClipboard.find(
        (element) => element["media-type"] !== undefined,
      );
      if (internalMedia && targetElement) {
        const size = scaleToPlaceholder(
          internalMedia.width ?? targetElement.width ?? 300,
          internalMedia.height ?? targetElement.height ?? 200,
          targetElement.width ?? internalMedia.width ?? 300,
          targetElement.height ?? internalMedia.height ?? 200,
        );
        beginHistory();
        addMedia(
          withPlaceholder({
            ...structuredClone(internalMedia),
            id: crypto.randomUUID(),
            position: targetElement.position ?? { x: 60, y: 60 },
            ...size,
            "z-index": targetElement["z-index"] ?? 1,
          }),
        );
        updateElement(targetElement.id, { hidden: true });
        commitHistory();
        return true;
      }
      if (internalMedia) {
        pasteElement();
        return true;
      }
      try {
        const payload = await readClipboardPayload();
        if (!payload.imageBlob) return false;
        const file = new File(
          [payload.imageBlob],
          `clipboard-image.${payload.imageType.split("/")[1] ?? "png"}`,
          { type: payload.imageType },
        );
        const [{ mediaId, key }, naturalSize] = await Promise.all([
          storeMediaFile(file),
          readImageDimensionsFromFile(file),
        ]);
        placeImage(mediaId, key, naturalSize);
        return true;
      } catch (error) {
        console.warn(
          "[EditorPage] Clipboard picture paste failed:",
          error,
        );
        return false;
      }
    },
    [
      addMedia,
      beginHistory,
      clipboard,
      commitHistory,
      pasteElement,
      presentation,
      selectedSlide,
      selectedTextElement,
      slideHeight,
      slideWidth,
      updateElement,
    ],
  );

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteText,
    handlePastePicture,
  };
}

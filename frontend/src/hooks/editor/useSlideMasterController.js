import { useCallback, useMemo } from "react";
import {
  buildLayoutPseudoSlide,
  buildMasterPseudoSlide,
} from "../../core/operations/masterOperations";
import { createZOrderUpdates } from "../../core/operations/zOrderOperations";
import { findMasterTextElement } from "../../core/operations/formattingState";

export function useSlideMasterController({
  presentation,
  selectedMasterLayoutId,
  selectedMasterLayout,
  selectedMasterElementId,
  selectedMasterElementIds,
  masterTextIds,
  masterMediaIds,
  beginHistory,
  commitHistory,
  updateLayoutItem,
  updateMasterElement,
  updateMasterTextContent,
  updateLayoutTextFormattingAction,
  updateMasterTextFormatting,
  removeLayoutPlaceholder,
  deleteLayoutElement,
  deleteMasterElement,
}) {
  const masterElements = presentation?.slideset?.master?.elements;
  const masterFormatting = presentation?.slideset?.master?.formatting;
  const masterColorTheme = presentation?.slideset?.master?.["color-theme"];
  const activeMasterSlide = useMemo(
    () =>
      selectedMasterLayout
        ? buildLayoutPseudoSlide(
            selectedMasterLayout,
            masterColorTheme ?? [],
          )
        : buildMasterPseudoSlide(masterElements ?? {}, masterColorTheme ?? []),
    [selectedMasterLayout, masterElements, masterColorTheme],
  );

  const arrangeMasterViewElement = useCallback(
    (mode) => {
      const selectedIds =
        selectedMasterElementIds?.length > 0
          ? selectedMasterElementIds
          : selectedMasterElementId
            ? [selectedMasterElementId]
            : [];
      if (selectedIds.length === 0) return;
      const updates = createZOrderUpdates(
        activeMasterSlide,
        selectedIds,
        mode,
      );
      if (updates.length === 0) return;

      beginHistory();
      updates.forEach(({ elementId, updates: elementUpdates }) => {
        if (selectedMasterLayoutId) {
          updateLayoutItem(
            selectedMasterLayoutId,
            elementId,
            elementUpdates,
          );
        } else {
          updateMasterElement(elementId, elementUpdates);
        }
      });
      commitHistory();
    },
    [
      activeMasterSlide,
      beginHistory,
      commitHistory,
      selectedMasterElementId,
      selectedMasterElementIds,
      selectedMasterLayoutId,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const handleMasterBringToFront = useCallback(
    () => arrangeMasterViewElement("front"),
    [arrangeMasterViewElement],
  );
  const handleMasterBringForward = useCallback(
    () => arrangeMasterViewElement("forward"),
    [arrangeMasterViewElement],
  );
  const handleMasterSendBackward = useCallback(
    () => arrangeMasterViewElement("backward"),
    [arrangeMasterViewElement],
  );
  const handleMasterSendToBack = useCallback(
    () => arrangeMasterViewElement("back"),
    [arrangeMasterViewElement],
  );

  const masterViewChangeText = useCallback(
    (id, text) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { promptText: text });
      } else {
        updateMasterTextContent(id, text);
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      updateLayoutItem,
      updateMasterTextContent,
    ],
  );

  const masterViewChangeParagraphs = useCallback(
    (id, paragraphs) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        const layout = (presentation?.slideset?.layouts ?? []).find(
          (item) => item["layout-id"] === selectedMasterLayoutId,
        );
        const isPlaceholder = (layout?.placeholders ?? []).some(
          (placeholder) => placeholder["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          const text = paragraphs
            .map((paragraph) =>
              paragraph.runs.map((run) => run.text).join(""),
            )
            .join("\n");
          updateLayoutItem(selectedMasterLayoutId, id, { promptText: text });
        } else {
          updateLayoutItem(selectedMasterLayoutId, id, {
            paragraphs,
            userModified: true,
          });
        }
      } else {
        updateMasterElement(id, { paragraphs, userModified: true });
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      presentation,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewFormatText = useCallback(
    (id, rawFormatting) => {
      const delta = Number(rawFormatting["font-size-delta"] ?? 0);
      let formatting = rawFormatting;
      if (delta) {
        const element = findMasterTextElement(
          presentation,
          selectedMasterLayoutId,
          id,
        );
        const currentSize =
          parseFloat(
            element?.paragraphs?.[0]?.formatting?.size ??
              masterFormatting?.size ??
              "24",
          ) || 24;
        const newSize = Math.max(
          6,
          Math.min(120, currentSize + delta),
        );
        formatting = {
          ...rawFormatting,
          "font-size-delta": undefined,
          size: `${newSize}px`,
        };
        delete formatting["font-size-delta"];
      }
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        const layout = (presentation?.slideset?.layouts ?? []).find(
          (item) => item["layout-id"] === selectedMasterLayoutId,
        );
        const isPlaceholder = (layout?.placeholders ?? []).some(
          (placeholder) => placeholder["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          updateLayoutItem(selectedMasterLayoutId, id, { formatting });
        } else {
          updateLayoutTextFormattingAction(
            selectedMasterLayoutId,
            id,
            formatting,
          );
        }
      } else {
        updateMasterTextFormatting(id, formatting);
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      presentation,
      masterFormatting,
      updateLayoutItem,
      updateLayoutTextFormattingAction,
      updateMasterTextFormatting,
    ],
  );

  const masterViewMoveText = useCallback(
    (id, x, y) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { position: { x, y } });
      } else {
        updateMasterElement(id, { position: { x, y } });
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewResizeText = useCallback(
    (id, width, height) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { width, height });
      } else {
        updateMasterElement(id, { width, height });
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewMoveMedia = useCallback(
    (id, x, y) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { position: { x, y } });
      } else {
        updateMasterElement(id, { position: { x, y } });
      }
    },
    [
      selectedMasterLayoutId,
      masterMediaIds,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewResizeMedia = useCallback(
    (id, width, height) => {
      const allMedia =
        presentation?.slideset?.master?.elements?.media ?? [];
      const element = allMedia.find((media) => media.id === id);
      const updates = { width, height };
      if (element && "source-width" in element) {
        const hasCrop = (element.crop ?? []).some((value) => value !== 0);
        if (hasCrop) {
          const [, cropRight = 0, , cropLeft = 0] = element.crop ?? [];
          const [cropTop = 0, , cropBottom = 0] = element.crop ?? [];
          const widthFraction = 1 - cropLeft / 100 - cropRight / 100;
          const heightFraction = 1 - cropTop / 100 - cropBottom / 100;
          const scaleX = element.width > 0 ? width / element.width : 1;
          const newSourceWidth =
            widthFraction > 0.001
              ? Math.round(width / widthFraction)
              : Math.round(
                  (element["source-width"] ?? element.width) * scaleX,
                );
          updates["source-width"] = newSourceWidth;
          if (
            (element["source-width"] ?? 0) > 0 &&
            (element["source-height"] ?? 0) > 0
          ) {
            const newSourceHeight = Math.round(
              newSourceWidth *
                (element["source-height"] / element["source-width"]),
            );
            updates["source-height"] = newSourceHeight;
            if (heightFraction > 0.001) {
              updates.height = Math.round(newSourceHeight * heightFraction);
            }
          } else {
            const scaleY = element.height > 0 ? height / element.height : 1;
            updates["source-height"] = Math.round(
              (element["source-height"] ?? element.height) * scaleY,
            );
          }
        } else {
          updates["source-width"] = width;
          updates["source-height"] = height;
          updates.crop = [];
        }
      }
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { width, height });
      } else {
        updateMasterElement(id, updates);
      }
    },
    [
      selectedMasterLayoutId,
      masterMediaIds,
      updateLayoutItem,
      updateMasterElement,
      presentation,
    ],
  );

  const masterViewAutoFitText = useCallback(
    (id, updates) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, updates);
      } else {
        updateMasterElement(id, updates);
      }
    },
    [
      selectedMasterLayoutId,
      masterTextIds,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewAutoFitMedia = useCallback(
    (id, updates) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, updates);
      } else {
        updateMasterElement(id, updates);
      }
    },
    [
      selectedMasterLayoutId,
      masterMediaIds,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const masterViewDeleteText = useCallback(
    (id) => {
      if (masterTextIds.has(id)) {
        deleteMasterElement("text", id);
      } else if (selectedMasterLayoutId) {
        const isPlaceholder = (selectedMasterLayout?.placeholders ?? []).some(
          (placeholder) => placeholder["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          removeLayoutPlaceholder(selectedMasterLayoutId, id);
        } else {
          deleteLayoutElement(selectedMasterLayoutId, "text", id);
        }
      }
    },
    [
      selectedMasterLayoutId,
      selectedMasterLayout,
      masterTextIds,
      removeLayoutPlaceholder,
      deleteLayoutElement,
      deleteMasterElement,
    ],
  );

  const masterViewDeleteMedia = useCallback(
    (id) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        deleteLayoutElement(selectedMasterLayoutId, "media", id);
      } else {
        deleteMasterElement("media", id);
      }
    },
    [
      selectedMasterLayoutId,
      masterMediaIds,
      deleteLayoutElement,
      deleteMasterElement,
    ],
  );

  const masterViewDeleteSelection = useCallback(
    (elementIds) => {
      const ids = Array.isArray(elementIds) ? elementIds : [elementIds];
      const validIds = ids.filter(Boolean);
      if (validIds.length === 0) return;

      if (validIds.length > 1) beginHistory();
      validIds.forEach((id) => {
        const isMedia =
          masterMediaIds.has(id) ||
          (selectedMasterLayout?.elements?.media ?? []).some(
            (media) => media.id === id,
          ) ||
          (selectedMasterLayout?.placeholders ?? []).some(
            (placeholder) =>
              (placeholder.type === "image" ||
                placeholder.type === "video") &&
              placeholder["placeholder-id"] === id,
          );
        if (isMedia) {
          masterViewDeleteMedia(id);
        } else {
          masterViewDeleteText(id);
        }
      });
      if (validIds.length > 1) commitHistory();
    },
    [
      beginHistory,
      commitHistory,
      masterMediaIds,
      selectedMasterLayout,
      masterViewDeleteMedia,
      masterViewDeleteText,
    ],
  );

  return {
    activeMasterSlide,
    handleMasterBringToFront,
    handleMasterBringForward,
    handleMasterSendBackward,
    handleMasterSendToBack,
    masterViewChangeText,
    masterViewChangeParagraphs,
    masterViewFormatText,
    masterViewMoveText,
    masterViewResizeText,
    masterViewMoveMedia,
    masterViewResizeMedia,
    masterViewAutoFitText,
    masterViewAutoFitMedia,
    masterViewDeleteText,
    masterViewDeleteMedia,
    masterViewDeleteSelection,
  };
}

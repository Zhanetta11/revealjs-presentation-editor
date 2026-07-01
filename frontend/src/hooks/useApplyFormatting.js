import { useCallback } from "react";
import {
  splitFormattingUpdates,
  RUN_LEVEL_KEYS,
} from "../core/text/textFormatting";

export const useApplyFormatting = ({
  activeSelectionRef,
  editingTextElementIdRef,
  currentFormatting,
  updateTextRangeFormatting,
  updateTextElementFormatting,
  updateParagraphFormatting,
  setPendingFormatting,
}) =>
  useCallback(
    (elementId, updates) => {
      const sel = activeSelectionRef.current;
      const isCurrentlyEditing = editingTextElementIdRef.current === elementId;
      const hasRealSel =
        isCurrentlyEditing &&
        sel &&
        sel.elementId === elementId &&
        !(
          sel.paragraphIdx === (sel.endParagraphIdx ?? sel.paragraphIdx) &&
          sel.rangeStart === sel.rangeEnd
        );

      if (hasRealSel) {
        const { runUpdates, paraUpdates } = splitFormattingUpdates(updates);
        const allUpdates = { ...runUpdates, ...paraUpdates };
        if (Object.keys(allUpdates).length > 0)
          updateTextRangeFormatting(
            elementId,
            sel.paragraphIdx,
            sel.rangeStart,
            sel.endParagraphIdx ?? sel.paragraphIdx,
            sel.rangeEnd,
            allUpdates,
          );
        return;
      }

      const fontSizeDelta = Number(updates["font-size-delta"] ?? 0);
      const updatesWithoutDelta = { ...updates };
      delete updatesWithoutDelta["font-size-delta"];
      const normalizedUpdates = fontSizeDelta
        ? {
            ...updatesWithoutDelta,
            size: `${Math.max(
              6,
              Math.min(
                120,
                (parseFloat(currentFormatting.size) || 24) + fontSizeDelta,
              ),
            )}px`,
          }
        : updatesWithoutDelta;
      const { runUpdates, paraUpdates } = splitFormattingUpdates(normalizedUpdates);

      const ELEMENT_LEVEL_KEYS = new Set(["vertical-align"]);
      const elementUpdates = Object.fromEntries(Object.entries(paraUpdates).filter(([k]) => ELEMENT_LEVEL_KEYS.has(k)));
      const paragraphOnlyUpdates = Object.fromEntries(Object.entries(paraUpdates).filter(([k]) => !ELEMENT_LEVEL_KEYS.has(k)));
      if (Object.keys(elementUpdates).length > 0)
        updateTextElementFormatting(elementId, elementUpdates);

      if (isCurrentlyEditing) {
        if (Object.keys(runUpdates).length > 0) {
          const cursorRunBase = Object.fromEntries(
            Object.entries(currentFormatting).filter(
              ([k, v]) => RUN_LEVEL_KEYS.has(k) && v != null && v !== "mixed",
            ),
          );
          setPendingFormatting((prev) => ({
            ...cursorRunBase,
            ...prev,
            ...runUpdates,
          }));
        }
        if (Object.keys(paragraphOnlyUpdates).length > 0) {
          const cursorParagraphIdx =
            sel?.elementId === elementId ? sel.paragraphIdx : undefined;
          if (cursorParagraphIdx !== undefined) {
            updateParagraphFormatting(elementId, cursorParagraphIdx, paragraphOnlyUpdates);
          } else {
            updateTextElementFormatting(elementId, paragraphOnlyUpdates);
          }
        }
      } else {
        const allUpdates = { ...runUpdates, ...paragraphOnlyUpdates };
        if (Object.keys(allUpdates).length > 0)
          updateTextElementFormatting(elementId, allUpdates);
      }
    },
    [
      currentFormatting,
      updateTextRangeFormatting,
      updateTextElementFormatting,
      updateParagraphFormatting,
      setPendingFormatting,
      activeSelectionRef,
      editingTextElementIdRef,
    ],
  );

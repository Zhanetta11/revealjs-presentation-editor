import {
  computeCurrentFormatting,
  resolveEffectiveFormatting,
  getSelectionFormatting,
} from "../text/textFormatting";
import { getPlaceholderFormatting } from "../render/slidesetRenderUtils";
import { createPlaceholderPseudoElement } from "./layoutOperations";

const getParagraphTextLength = (paragraph) =>
  (paragraph?.runs ?? []).reduce(
    (length, run) => length + String(run?.text ?? "").length,
    0,
  );

export const isStoredTextSelectionValid = ({
  selection,
  elementId,
  textElement,
  isEditing,
}) => {
  if (!selection || !isEditing || selection.elementId !== elementId) return false;

  const paragraphs = textElement?.paragraphs ?? [];
  const startParagraphIdx = Number(selection.paragraphIdx);
  const endParagraphIdx = Number(
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const rangeStart = Number(selection.rangeStart);
  const rangeEnd = Number(selection.rangeEnd);

  if (
    !Number.isInteger(startParagraphIdx) ||
    !Number.isInteger(endParagraphIdx) ||
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    startParagraphIdx < 0 ||
    endParagraphIdx < startParagraphIdx ||
    endParagraphIdx >= paragraphs.length ||
    rangeStart < 0 ||
    rangeEnd < 0
  ) {
    return false;
  }

  if (
    rangeStart > getParagraphTextLength(paragraphs[startParagraphIdx]) ||
    rangeEnd > getParagraphTextLength(paragraphs[endParagraphIdx])
  ) {
    return false;
  }

  return startParagraphIdx !== endParagraphIdx || rangeStart <= rangeEnd;
};

export const findMasterTextElement = (
  presentation,
  selectedMasterLayoutId,
  selectedMasterElementId,
) => {
  if (!selectedMasterElementId) return null;
  const masterEl = (presentation?.slideset?.master?.elements?.text ?? []).find(
    (t) => t.id === selectedMasterElementId,
  );
  if (masterEl) return masterEl;
  if (selectedMasterLayoutId) {
    const layout = (presentation?.slideset?.layouts ?? []).find(
      (l) => l["layout-id"] === selectedMasterLayoutId,
    );
    const layoutEl = (layout?.elements?.text ?? []).find(
      (t) => t.id === selectedMasterElementId,
    );
    if (layoutEl) return layoutEl;
    const placeholder = (layout?.placeholders ?? []).find(
      (p) => p["placeholder-id"] === selectedMasterElementId && p.type === "text",
    );
    if (placeholder) {
      const pseudoElement = createPlaceholderPseudoElement(placeholder);
      return {
        ...pseudoElement,
        paragraphs: pseudoElement.paragraphs.map((paragraph, index) =>
          index === 0
            ? { ...paragraph, formatting: placeholder.formatting ?? {} }
            : paragraph,
        ),
      };
    }
  }
  return null;
};

export const computeFormattingState = ({
  presentation,
  selectedSlide,
  activeTextEl,
  activeElementId,
  activeSelectionForFormatting,
  isSlideMasterOpen,
  isEditingSelected,
  pendingFormatting,
}) => {
  const paragraphFormatting = activeTextEl?.paragraphs?.[0]?.formatting ?? {};
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const placeholderFormatting =
    activeTextEl && !isSlideMasterOpen
      ? getPlaceholderFormatting(presentation, selectedSlide, activeTextEl)
      : (isSlideMasterOpen && activeTextEl?.isPlaceholder
          ? activeTextEl.paragraphs?.[0]?.formatting ?? {}
          : {});
  const effectiveFormatting = resolveEffectiveFormatting(
    masterFormatting,
    placeholderFormatting,
    paragraphFormatting,
  );

  const validSelection = isStoredTextSelectionValid({
    selection: activeSelectionForFormatting,
    elementId: activeElementId,
    textElement: activeTextEl,
    isEditing: isEditingSelected,
  })
    ? activeSelectionForFormatting
    : null;
  const hasRealSelection =
    validSelection &&
    !(
      validSelection.paragraphIdx ===
        (validSelection.endParagraphIdx ?? validSelection.paragraphIdx) &&
      validSelection.rangeStart === validSelection.rangeEnd
    );

  const rawSelFmt = hasRealSelection
    ? (getSelectionFormatting(activeTextEl, validSelection) ?? {})
    : null;
  const selectionFormatting = rawSelFmt
    ? {
        ...effectiveFormatting,
        ...Object.fromEntries(Object.entries(rawSelFmt).filter(([, v]) => v != null)),
      }
    : null;

  const currentFormatting = selectionFormatting
    ? { ...selectionFormatting, ...pendingFormatting }
    : computeCurrentFormatting({
        isEditing: isEditingSelected,
        activeSelection: validSelection,
        selectedElementId: activeElementId,
        selectedTextEl: activeTextEl,
        effectiveFormatting,
        pendingFormatting,
      });

  return { currentFormatting, hasRealSelection, effectiveFormatting };
};

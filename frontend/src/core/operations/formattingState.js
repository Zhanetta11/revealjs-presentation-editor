import {
  computeCurrentFormatting,
  resolveEffectiveFormatting,
  getSelectionFormatting,
} from "../text/textFormatting";
import { getPlaceholderFormatting } from "../render/slidesetRenderUtils";

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
      return {
        id: placeholder["placeholder-id"],
        "placeholder-id": placeholder["placeholder-id"],
        isPlaceholder: true,
        paragraphs: [{
          id: `ph-para-${placeholder["placeholder-id"]}`,
          formatting: placeholder.formatting ?? {},
          bullets: "none",
          runs: [{ text: "", formatting: {}, "super-sub-script": "normal", link: null }],
        }],
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

  const hasRealSelection =
    activeSelectionForFormatting &&
    activeSelectionForFormatting.elementId === activeElementId &&
    !(
      activeSelectionForFormatting.paragraphIdx ===
        (activeSelectionForFormatting.endParagraphIdx ??
          activeSelectionForFormatting.paragraphIdx) &&
      activeSelectionForFormatting.rangeStart ===
        activeSelectionForFormatting.rangeEnd
    );

  const rawSelFmt = hasRealSelection
    ? (getSelectionFormatting(activeTextEl, activeSelectionForFormatting) ?? {})
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
        activeSelection: activeSelectionForFormatting,
        selectedElementId: activeElementId,
        selectedTextEl: activeTextEl,
        effectiveFormatting,
        pendingFormatting,
      });

  return { currentFormatting, hasRealSelection, effectiveFormatting };
};

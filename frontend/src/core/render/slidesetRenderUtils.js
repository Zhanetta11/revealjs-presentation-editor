export { escapeHtml } from "../utils/presentationUtils";
import { DEFAULT_SLIDE_WIDTH, DEFAULT_SLIDE_HEIGHT } from "../model/slideSizes";

export function getSlideContentIds(slide) {
  const ids = new Set();
  (slide?.contents?.text ?? []).forEach((el) => {
    ids.add(el.id);
    if (el["placeholder-id"]) ids.add(el["placeholder-id"]);
  });
  (slide?.contents?.media ?? []).forEach((el) => {
    ids.add(el.id);
    if (el["placeholder-id"]) ids.add(el["placeholder-id"]);
  });
  return ids;
}

export function getSlideSize(presentation) {
    const dimensions = presentation?.slideset?.master?.["slide-dimensions"];

    return {
        width: dimensions?.width ?? DEFAULT_SLIDE_WIDTH,
        height: dimensions?.height ?? DEFAULT_SLIDE_HEIGHT,
    };
}

export function getVisibleSlides(presentation) {
    return presentation?.slideset?.slides?.filter((slide) => !slide.hidden) || [];
}

export function getTextElements(slide) {
  return slide?.contents?.text ?? [];
}

export function getMediaElements(slide) {
    return (slide?.contents?.media || []).filter((m) => !!m["file-link"]);
}

function findPlaceholder(presentation, slide, textElement) {
  const layoutId = slide?.["layout-id"];
  const placeholderId = textElement?.["placeholder-id"];
  if (!layoutId || !placeholderId) return null;
  const layout = (presentation?.slideset?.layouts ?? []).find(
    (l) => l["layout-id"] === layoutId,
  );
  return (layout?.placeholders ?? []).find(
    (ph) => ph["placeholder-id"] === placeholderId,
  ) ?? null;
}

export function getPlaceholderFormatting(presentation, slide, textElement) {
  return findPlaceholder(presentation, slide, textElement)?.formatting ?? {};
}

export function getPlaceholderPadding(presentation, slide, textElement) {
  return findPlaceholder(presentation, slide, textElement)?.padding?.css ?? null;
}

export function getPlaceholderBackground(presentation, slide, textElement) {
  return findPlaceholder(presentation, slide, textElement)?.background ?? null;
}




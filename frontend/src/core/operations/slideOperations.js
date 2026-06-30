import { createId, getSlides, setSlides, createTextElementFromPlaceholder, createMediaElementFromPlaceholder } from "../utils/presentationUtils";
import { DEFAULT_TRANSITION } from "../model/transitionDefaults";

export const TRANSPARENT_SLIDE_BG = "#FFFFFFFF";

const getLayouts = (presentation) =>
  presentation?.slideset?.layouts ?? [];


export const createSlideFromLayout = (layout, slideNumber) => {
  const placeholders = layout.placeholders ?? [];

  const textPlaceholders = placeholders.filter((p) => p.type === "text");
  const mediaPlaceholders = placeholders.filter(
    (p) => p.type === "image" || p.type === "video",
  );

  return {
    title: { content: `Slide ${slideNumber}` },
    "layout-id": layout["layout-id"],
    hidden: false,
    contents: {
      text: textPlaceholders.map((p) =>
        createTextElementFromPlaceholder(
          p,
          p.promptText ?? (p.role === "title" ? "Click to edit title" : "Click to edit text"),
        )
      ),
      media: mediaPlaceholders.map(createMediaElementFromPlaceholder),
      shapes: [],
      tables: [],
      groups: [],
      animations: [],
      background: TRANSPARENT_SLIDE_BG,
      transition: DEFAULT_TRANSITION,
      notes: "",
    },
  };
};

export const addSlide = (presentation, layoutId = "title-content") => {
  const layouts = getLayouts(presentation);
  const slides = getSlides(presentation);

  const layout = layouts.find((l) => l["layout-id"] === layoutId);

  if (!layout) return presentation;

  const newSlide = createSlideFromLayout(layout, slides.length + 1);

  return setSlides(presentation, [...slides, newSlide]);
};

export const deleteSlide = (presentation, slideIndex) => {
  const slides = getSlides(presentation);

  if (slides.length <= 1) return presentation;

  return setSlides(
    presentation,
    slides.filter((_, index) => index !== slideIndex),
  );
};

export const duplicateSlide = (presentation, slideIndex) => {
  const slides = getSlides(presentation);
  const source = slides[slideIndex];

  if (!source) return presentation;

  const idMap = new Map();

  const text = (source.contents?.text ?? []).map((el) => {
    const newId = createId("text");
    idMap.set(el.id, newId);
    return {
      ...structuredClone(el),
      id: newId,
      paragraphs: (el.paragraphs ?? []).map((p) => {
        const newParagraphId = createId("paragraph");
        if (p.id) idMap.set(p.id, newParagraphId);
        return {
          ...structuredClone(p),
          id: newParagraphId,
        };
      }),
    };
  });

  const media = (source.contents?.media ?? []).map((el) => {
    const newId = createId("media");
    idMap.set(el.id, newId);
    return { ...structuredClone(el), id: newId };
  });

  const cloneParagraphsWithIds = (paragraphs) =>
    (paragraphs ?? []).map((paragraph) => {
      const newParagraphId = createId("paragraph");
      if (paragraph.id) idMap.set(paragraph.id, newParagraphId);
      return {
        ...structuredClone(paragraph),
        id: newParagraphId,
      };
    });

  const cloneElementsWithIds = (elements, prefix) =>
    (elements ?? []).map((element) => {
      const newId = createId(prefix);
      if (element.id) idMap.set(element.id, newId);
      const cloned = { ...structuredClone(element), id: newId };
      if (Array.isArray(element.paragraphs)) {
        cloned.paragraphs = cloneParagraphsWithIds(element.paragraphs);
      }
      if (Array.isArray(element.table?.rows)) {
        cloned.table = {
          ...cloned.table,
          rows: element.table.rows.map((row) => ({
            ...structuredClone(row),
            cells: (row.cells ?? []).map((cell) => ({
              ...structuredClone(cell),
              paragraphs: cloneParagraphsWithIds(cell.paragraphs),
            })),
          })),
        };
      }
      return cloned;
    });

  const shapes = cloneElementsWithIds(source.contents?.shapes, "shape");
  const tables = cloneElementsWithIds(source.contents?.tables, "table");
  const clonedGroups = cloneElementsWithIds(source.contents?.groups, "group");
  const groups = clonedGroups.map((group) => ({
    ...group,
    elements: (group.elements ?? []).map((id) => idMap.get(id) ?? id),
  }));

  const duplicated = {
    ...source,
    title: {
      ...structuredClone(source.title ?? {}),
      content: `${source.title?.content ?? "Slide"} Copy`,
    },
    contents: {
      ...structuredClone(source.contents),
      text,
      media,
      shapes,
      tables,
      groups,
      animations: (source.contents?.animations ?? [])
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((anim, index) => ({
          ...structuredClone(anim),
          id: idMap.get(anim.id) ?? anim.id,
          sequence: index + 1,
        })),
    },
  };

  return setSlides(presentation, [
    ...slides.slice(0, slideIndex + 1),
    duplicated,
    ...slides.slice(slideIndex + 1),
  ]);
};

export const reorderSlides = (presentation, fromIndex, toIndex) => {
  const slides = [...getSlides(presentation)];

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex >= slides.length ||
    fromIndex === toIndex
  ) {
    return presentation;
  }

  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved);

  return setSlides(presentation, slides);
};

export const updateSlideNotes = (presentation, slideIndex, notes) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];

  if (!slide) return presentation;

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, notes },
  };

  return setSlides(presentation, slides);
};

export const getSlideCommentCount = (slide) =>
  (slide?.contents?.comments ?? []).length;

export const getSlideCommentCounts = (slides) =>
  (slides ?? []).map(getSlideCommentCount);

export const toggleSlideHidden = (presentation, slideIndex) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];

  if (!slide) return presentation;

  slides[slideIndex] = { ...slide, hidden: !slide.hidden };

  return setSlides(presentation, slides);
};


export const applyBackgroundToAllSlides = (presentation, background) => {
  const slides = getSlides(presentation);
  const updated = slides.map(slide => {
    const existing = slide.contents?.background;
    const existingIsImage = existing && typeof existing === "object" && existing.type === "image";
    if (background === null && existingIsImage) return slide;
    return { ...slide, contents: { ...slide.contents, background } };
  });
  return setSlides(presentation, updated);
};

export const updateSlideBackground = (presentation, slideIndex, background) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;
  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, background },
  };
  return setSlides(presentation, slides);
};

export const getSlideElement = (slide, elementId) => {
  if (!elementId || !slide) return null;
  return (
    (slide.contents?.text ?? []).find((e) => e.id === elementId) ||
    (slide.contents?.media ?? []).find((e) => e.id === elementId) ||
    null
  );
};

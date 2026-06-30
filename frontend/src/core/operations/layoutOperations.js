import { createId, getSlides, setSlides, createTextElementFromPlaceholder, createMediaElementFromPlaceholder } from "../utils/presentationUtils";
import { applyFormattingToParagraphs } from "../text/textFormatting";

const getLayouts = (presentation) =>
  presentation?.slideset?.layouts ?? [];

export const getLayoutDisplayList = (presentation) =>
  getLayouts(presentation).map((l) => ({
    id: l["layout-id"],
    label: l.name ?? l["layout-id"],
  }));

const setLayouts = (presentation, layouts) => ({
  ...presentation,
  slideset: {
    ...presentation.slideset,
    layouts,
  },
});

const getPlaceholderDefaultText = (placeholder) => {
  if (placeholder.promptText) return placeholder.promptText;
  switch (placeholder.role) {
    case "title": return "Click to edit title";
    case "subtitle": return "Click to edit subtitle";
    case "footer": return "Footer";
    case "date": return "Date";
    case "slide-number": return "#";
    default: return "Click to edit text";
  }
};

const createTextFromPlaceholder = (placeholder) => ({
  ...createTextElementFromPlaceholder(placeholder, getPlaceholderDefaultText(placeholder)),
  userModified: false,
});

const detachFromPlaceholder = (element) => {
  const detached = { ...element };
  delete detached["placeholder-id"];
  delete detached["pos-type"];
  return detached;
};

const hasGeometryOverride = (element, placeholder) => {
  if (!placeholder) return false;
  return (
    (element.position?.x ?? 0) !== (placeholder.position?.x ?? 0)
    || (element.position?.y ?? 0) !== (placeholder.position?.y ?? 0)
    || (element.width ?? 0) !== (placeholder.width ?? 0)
    || (element.height ?? 0) !== (placeholder.height ?? 0)
    || (element.rotation ?? 0) !== (placeholder.rotation ?? 0)
  );
};

const hasBackgroundOverride = (element, placeholder) =>
  (element.background ?? "#FFFFFF00")
  !== (placeholder?.background ?? "#FFFFFF00");

const updateElementFromPlaceholder = (
  element,
  previousPlaceholders,
  updatedPlaceholders,
  isContentModified,
) => {
  const previousMatch = previousPlaceholders.find(
    (p) => p["placeholder-id"] === element["placeholder-id"],
  );
  const match = updatedPlaceholders.find(
    (p) => p["placeholder-id"] === element["placeholder-id"],
  );

  if (!match) {
    return isContentModified(element)
      ? detachFromPlaceholder(element)
      : null;
  }

  const geometryModified = hasGeometryOverride(element, previousMatch);
  const backgroundModified = hasBackgroundOverride(element, previousMatch);

  const updated = {
    ...element,
    ...(geometryModified ? {} : {
      position: { ...match.position },
      width: match.width,
      height: match.height,
      rotation: match.rotation ?? element.rotation ?? 0,
    }),
    ...(backgroundModified
      ? {}
      : { background: match.background ?? "#FFFFFF00" }),
  };

  if (
    element.paragraphs
    && match.promptText !== undefined
    && !isContentModified(element)
  ) {
    updated.paragraphs = element.paragraphs.map((p, pIdx) => {
      if (pIdx !== 0) return p;
      return {
        ...p,
        runs: p.runs.map((r, rIdx) =>
          rIdx === 0 ? { ...r, text: match.promptText } : r,
        ),
      };
    });
  }

  return updated;
};

const PLACEHOLDER_PROMPTS = {
  title: "Click to edit Master title style",
  body: "Click to edit Master text styles",
};

export const placeholderPromptText = (placeholder) =>
  placeholder.promptText ?? PLACEHOLDER_PROMPTS[placeholder.role] ?? "Click to edit text styles";

export const createPlaceholderPseudoElement = (placeholder) => {
  if (placeholder.type === "image" || placeholder.type === "video") {
    return {
      id: placeholder["placeholder-id"],
      "placeholder-id": placeholder["placeholder-id"],
      "file-link": "",
      "media-type": placeholder.type === "video" ? "video" : "image",
      position: { ...placeholder.position },
      width: placeholder.width,
      height: placeholder.height,
      rotation: placeholder.rotation ?? 0,
      "z-index": 1,
      scale: 1,
      crop: [],
      effects: {},
      playback: {},
      isPlaceholder: true,
    };
  }

  return {
    id: placeholder["placeholder-id"],
    "placeholder-id": placeholder["placeholder-id"],
    position: { ...placeholder.position },
    "pos-type": "relative-to-placeholder",
    width: placeholder.width,
    height: placeholder.height,
    rotation: placeholder.rotation ?? 0,
    "z-index": 1,
    background: placeholder.background ?? "#FFFFFF00",
    userModified: false,
    isPlaceholder: true,
    paragraphs: [
      {
        id: createId("paragraph"),
        formatting: {},
        bullets: "none",
        runs: [{
          formatting: {},
          "super-sub-script": "normal",
          text: placeholderPromptText(placeholder),
          link: null,
        }],
      },
    ],
  };
};

export const addLayout = (presentation, afterLayoutId = null) => {
  const layouts = getLayouts(presentation);
  const id = createId("custom-layout");
  const customCount = layouts.filter((l) => l["layout-id"].startsWith("custom-layout-")).length + 1;
  const newLayout = {
    "layout-id": id,
    name: `${customCount}_Custom Layout`,
    placeholders: [],
    elements: { text: [], media: [] },
  };
  if (!afterLayoutId) {
    return setLayouts(presentation, [newLayout, ...layouts]);
  }
  const idx = layouts.findIndex((l) => l["layout-id"] === afterLayoutId);
  const insertAt = idx === -1 ? layouts.length : idx + 1;
  const updated = [...layouts.slice(0, insertAt), newLayout, ...layouts.slice(insertAt)];
  return setLayouts(presentation, updated);
};

export const deleteLayout = (presentation, layoutId) => {
  const allLayouts = getLayouts(presentation);
  if (allLayouts.length <= 1) return presentation;
  const layouts = allLayouts.filter((l) => l["layout-id"] !== layoutId);
  const slides = getSlides(presentation).map((slide) =>
    slide["layout-id"] === layoutId ? { ...slide, "layout-id": layouts[0]?.["layout-id"] ?? null } : slide,
  );
  return setLayouts(setSlides(presentation, slides), layouts);
};

export const renameLayout = (presentation, layoutId, name) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) =>
    l["layout-id"] === layoutId ? { ...l, name } : l,
  );
  return setLayouts(presentation, updatedLayouts);
};

export const addLayoutElement = (presentation, layoutId, elementType, element) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    const elements = l.elements ?? {};
    const arr = elements[elementType] ?? [];
    return { ...l, elements: { ...elements, [elementType]: [...arr, element] } };
  });
  return setLayouts(presentation, updatedLayouts);
};

export const updateLayoutElementTextContent = (presentation, layoutId, elementId, text) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    const elements = l.elements ?? {};
    const arr = (elements.text ?? []).map((el) => {
      if (el.id !== elementId) return el;
      return {
        ...el,
        paragraphs: (el.paragraphs ?? []).map((paragraph, pIdx) => ({
          ...paragraph,
          runs: (paragraph.runs ?? []).map((run, rIdx) => ({
            ...run,
            text: pIdx === 0 && rIdx === 0 ? text : run.text,
          })),
        })),
      };
    });
    return { ...l, elements: { ...elements, text: arr } };
  });
  return setLayouts(presentation, updatedLayouts);
};

export const updateLayoutElement = (presentation, layoutId, elementType, elementId, updates) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    const elements = l.elements ?? {};
    const arr = (elements[elementType] ?? []).map((el) =>
      el.id === elementId ? { ...el, ...updates } : el,
    );
    return { ...l, elements: { ...elements, [elementType]: arr } };
  });
  return setLayouts(presentation, updatedLayouts);
};

export const deleteLayoutElement = (presentation, layoutId, elementType, elementId) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    const elements = l.elements ?? {};
    const arr = (elements[elementType] ?? []).filter((el) => el.id !== elementId);
    return { ...l, elements: { ...elements, [elementType]: arr } };
  });
  return setLayouts(presentation, updatedLayouts);
};

export const updateLayoutElementsFont = (presentation, layoutId, font) => {
  const layout = getLayouts(presentation).find((l) => l["layout-id"] === layoutId);
  if (!layout) return presentation;

  const updatedPlaceholders = (layout.placeholders ?? []).map((p) => ({
    ...p,
    formatting: { ...(p.formatting ?? {}), font },
  }));

  const withPropagated = propagateLayoutChanges(presentation, layoutId, updatedPlaceholders);

  const layouts = getLayouts(withPropagated).map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    return {
      ...l,
      elements: {
        ...(l.elements ?? {}),
        text: (l.elements?.text ?? []).map((el) => ({
          ...el,
          paragraphs: (el.paragraphs ?? []).map((p) => ({
            ...p,
            formatting: { ...(p.formatting ?? {}), font },
          })),
        })),
      },
    };
  });

  return setLayouts(withPropagated, layouts);
};

export const removeLayoutPlaceholder = (presentation, layoutId, placeholderId) => {
  const layout = getLayouts(presentation).find((l) => l["layout-id"] === layoutId);
  if (!layout) return presentation;
  const updatedPlaceholders = (layout.placeholders ?? []).filter(
    (p) => p["placeholder-id"] !== placeholderId,
  );
  return propagateLayoutChanges(presentation, layoutId, updatedPlaceholders);
};

export const addLayoutPlaceholder = (presentation, layoutId, placeholder) => {
  const layout = getLayouts(presentation).find((l) => l["layout-id"] === layoutId);
  if (!layout) return presentation;
  const updatedPlaceholders = [...(layout.placeholders ?? []), placeholder];
  return propagateLayoutChanges(presentation, layoutId, updatedPlaceholders);
};

export const updateLayoutPlaceholder = (presentation, layoutId, placeholderId, updates) => {
  const layout = getLayouts(presentation).find((l) => l["layout-id"] === layoutId);
  if (!layout) return presentation;

  const { formatting: formattingUpdates, ...rest } = updates;

  const updatedPlaceholders = (layout.placeholders ?? []).map((p) => {
    if (p["placeholder-id"] !== placeholderId) return p;
    return {
      ...p,
      ...rest,
      ...(formattingUpdates
        ? { formatting: { ...(p.formatting ?? {}), ...formattingUpdates } }
        : {}),
    };
  });

  return propagateLayoutChanges(presentation, layoutId, updatedPlaceholders);
};

const isTextModified = (el) => el.userModified === true;

const isMediaModified = (el) =>
  !!el["file-link"] && el["file-link"] !== "";

export const applyLayoutToSlide = (presentation, slideIndex, layoutId) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  const layout = getLayouts(presentation).find(
    (l) => l["layout-id"] === layoutId,
  );

  if (!layout || !slide) return presentation;

  const placeholders = layout.placeholders ?? [];
  const placeholderMap = new Map(
    placeholders.map((p) => [p["placeholder-id"], p])
  );

  const processElement = (el, isModified) => {
    const pid = el["placeholder-id"];
    const match = pid ? placeholderMap.get(pid) : null;
    if (match) {
      const updated = {
        ...el,
        position: { ...match.position },
        width: match.width,
        height: match.height,
        rotation: match.rotation ?? el.rotation ?? 0,
        background: match.background ?? el.background,
      };
      return { updated };
    }
    if (!pid) return { kept: el };
    if (isModified(el)) return { kept: detachFromPlaceholder(el) };
    return { remove: true };
  };

  const processedText = [];
  for (const el of (slide.contents?.text ?? [])) {
    const r = processElement(el, isTextModified);
    if (r.updated) processedText.push(r.updated);
    else if (r.kept) processedText.push(r.kept);
  }

  const processedMedia = [];
  for (const el of (slide.contents?.media ?? [])) {
    const r = processElement(el, isMediaModified);
    if (r.updated) processedMedia.push(r.updated);
    else if (r.kept) processedMedia.push(r.kept);
  }

  const handledPids = new Set([
    ...processedText.map((el) => el["placeholder-id"]).filter(Boolean),
    ...processedMedia.map((el) => el["placeholder-id"]).filter(Boolean),
  ]);

  const newText = [];
  const newMedia = [];

  for (const placeholder of placeholders) {
    const pid = placeholder["placeholder-id"];
    if (!pid || handledPids.has(pid)) continue;
    if (placeholder.type === "text") newText.push(createTextFromPlaceholder(placeholder));
    else if (placeholder.type === "image" || placeholder.type === "video") newMedia.push(createMediaElementFromPlaceholder(placeholder));
  }

  slides[slideIndex] = {
    ...slide,
    "layout-id": layoutId,
    contents: {
      ...slide.contents,
      text: [...processedText, ...newText],
      media: [...processedMedia, ...newMedia],
    },
  };

  return setSlides(presentation, slides);
};

export const updateLayoutTextFormatting = (presentation, layoutId, elementId, formattingUpdate) => {
  const layouts = getLayouts(presentation);
  const updatedLayouts = layouts.map((l) => {
    if (l["layout-id"] !== layoutId) return l;
    const textElements = (l.elements?.text ?? []).map((el) => {
      if (el.id !== elementId) return el;
      return { ...el, paragraphs: applyFormattingToParagraphs(el.paragraphs, formattingUpdate) };
    });
    return { ...l, elements: { ...(l.elements ?? {}), text: textElements } };
  });
  return setLayouts(presentation, updatedLayouts);
};

export const updateLayoutItem = (presentation, layoutId, itemId, updates) => {
  const layout = getLayouts(presentation).find((l) => l["layout-id"] === layoutId);
  if (!layout) return presentation;

  const isPlaceholder = (layout.placeholders ?? []).some((p) => p["placeholder-id"] === itemId);

  if (isPlaceholder) {
    const { promptText, ...rest } = updates;
    const merged = promptText !== undefined ? { ...rest, promptText } : rest;
    return updateLayoutPlaceholder(presentation, layoutId, itemId, merged);
  }

  const { formatting, promptText, ...rest } = updates;
  const isTextEl = (layout.elements?.text ?? []).some((el) => el.id === itemId);
  const isMediaEl = (layout.elements?.media ?? []).some((el) => el.id === itemId);
  if (!isTextEl && !isMediaEl) return presentation;
  const elementType = isTextEl ? "text" : "media";
  let result = presentation;
  if (Object.keys(rest).length) result = updateLayoutElement(result, layoutId, elementType, itemId, rest);
  if (formatting) result = updateLayoutElement(result, layoutId, elementType, itemId, { formatting });
  if (promptText !== undefined) result = updateLayoutElementTextContent(result, layoutId, itemId, promptText);
  return result;
};

export const propagateLayoutChanges = (
  presentation,
  layoutId,
  updatedPlaceholders,
) => {
  const previousLayout = getLayouts(presentation).find(
    (layout) => layout["layout-id"] === layoutId,
  );
  const previousPlaceholders = previousLayout?.placeholders ?? [];

  const slides = getSlides(presentation).map((slide) => {
    if (slide["layout-id"] !== layoutId) return slide;

    const updatedText = (slide.contents?.text ?? [])
      .map((el) =>
        updateElementFromPlaceholder(
          el,
          previousPlaceholders,
          updatedPlaceholders,
          isTextModified,
        ),
      )
      .filter(Boolean);
    const updatedMedia = (slide.contents?.media ?? [])
      .map((el) =>
        updateElementFromPlaceholder(
          el,
          previousPlaceholders,
          updatedPlaceholders,
          isMediaModified,
        ),
      )
      .filter(Boolean);

    const handledPids = new Set([
      ...updatedText.map((el) => el["placeholder-id"]).filter(Boolean),
      ...updatedMedia.map((el) => el["placeholder-id"]).filter(Boolean),
    ]);

    const newText = [];
    const newMedia = [];

    for (const placeholder of updatedPlaceholders) {
      const pid = placeholder["placeholder-id"];
      if (!pid || handledPids.has(pid)) continue;
      if (placeholder.type === "text") {
        newText.push(createTextFromPlaceholder(placeholder));
      } else if (placeholder.type === "image" || placeholder.type === "video") {
        newMedia.push(createMediaElementFromPlaceholder(placeholder));
      }
    }

    return {
      ...slide,
      contents: {
        ...slide.contents,
        text: [...updatedText, ...newText],
        media: [...updatedMedia, ...newMedia],
      },
    };
  });

  const updatedLayouts = getLayouts(presentation).map((layout) =>
    layout["layout-id"] === layoutId
      ? { ...layout, placeholders: updatedPlaceholders }
      : layout,
  );

  return setLayouts(setSlides(presentation, slides), updatedLayouts);
};

export const resetSlideToLayout = (presentation, slideIndex) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const layout = getLayouts(presentation).find(
    (l) => l["layout-id"] === slide["layout-id"],
  );
  if (!layout) return presentation;

  const placeholders = layout.placeholders ?? [];
  const placeholderMap = new Map(
    placeholders.map((p) => [p["placeholder-id"], p])
  );

  const resetText = (slide.contents?.text ?? []).map((el) => {
    const pid = el["placeholder-id"];
    const match = pid ? placeholderMap.get(pid) : null;
    if (!match) return el;
    const resetParagraphs = (el.paragraphs ?? []).map((p) => ({
      ...p,
      formatting: {},
      runs: (p.runs ?? []).map((r) => ({ ...r, formatting: {} })),
    }));
    return {
      ...el,
      position: { ...match.position },
      width: match.width,
      height: match.height,
      background: match.background ?? "#FFFFFF00",
      rotation: match.rotation ?? 0,
      paragraphs: resetParagraphs,
    };
  });

  const resetMedia = (slide.contents?.media ?? []).map((el) => {
    const pid = el["placeholder-id"];
    const match = pid ? placeholderMap.get(pid) : null;
    if (!match) return el;
    return {
      ...el,
      position: { ...match.position },
      width: match.width,
      height: match.height,
      rotation: match.rotation ?? 0,
    };
  });

  const handledPids = new Set([
    ...resetText.map((el) => el["placeholder-id"]).filter(Boolean),
    ...resetMedia.map((el) => el["placeholder-id"]).filter(Boolean),
  ]);

  const newText = [];
  const newMedia = [];

  for (const placeholder of placeholders) {
    const pid = placeholder["placeholder-id"];
    if (!pid || handledPids.has(pid)) continue;
    if (placeholder.type === "text") newText.push(createTextFromPlaceholder(placeholder));
    else if (placeholder.type === "image" || placeholder.type === "video") newMedia.push(createMediaElementFromPlaceholder(placeholder));
  }

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      text: [...resetText, ...newText],
      media: [...resetMedia, ...newMedia],
    },
  };

  return setSlides(presentation, slides);
};

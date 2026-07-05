import { getSlides, setSlides } from "../utils/presentationUtils";

export const findElementInSlide = (textElements, mediaElements, elementId) => {
  const text = textElements.find((el) => el.id === elementId);
  if (text) return { element: text, type: "text" };
  const media = mediaElements.find((el) => el.id === elementId);
  if (media) return { element: media, type: "media" };
  return null;
};

export const getElementLabel = (element) => {
  if (!element) return null;
  if (element.paragraphs) {
    return element.paragraphs?.[0]?.runs?.[0]?.text || "Text";
  }
  return element["media-type"] === "video" ? "Video" : "Image";
};

export const resizeElement = (presentation, slideIndex, elementId, newSize) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const updateSize = (element) => {
    if (element.id !== elementId) return element;
    const updates = { ...element, width: newSize.width, height: newSize.height };
    if ("source-width" in element) {
      const hasCrop = (element.crop ?? []).some((v) => v !== 0);
      if (hasCrop) {
        const scaleX = element.width > 0 ? newSize.width  / element.width  : 1;
        const scaleY = element.height > 0 ? newSize.height / element.height : 1;
        updates["source-width"]  = (element["source-width"]  ?? element.width)  * scaleX;
        updates["source-height"] = (element["source-height"] ?? element.height) * scaleY;
      } else {
        updates["source-width"]  = newSize.width;
        updates["source-height"] = newSize.height;
        updates.crop = [];
      }
    }
    return updates;
  };

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).map(updateSize),
      media: (slide.contents?.media ?? []).map(updateSize),
    },
  };

  return setSlides(presentation, slides);
};

export const deleteElementsByIds = (presentation, slideIndex, elementIds) => {
  const ids = new Set(elementIds ?? []);
  if (ids.size === 0) return presentation;
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;
  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).filter((el) => !ids.has(el.id)),
      media: (slide.contents?.media ?? []).filter((el) => !ids.has(el.id)),
      animations: (slide.contents?.animations ?? [])
        .filter((a) => !ids.has(a.id))
        .map((a, index) => ({ ...a, sequence: index + 1 })),
    },
  };
  return setSlides(presentation, slides);
};

export const updateElement = (presentation, slideIndex, elementId, updates) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const applyUpdates = (element) =>
    element.id === elementId ? { ...element, ...updates } : element;
  const elementCollections = ["text", "media", "shapes", "tables", "groups"];
  const updatedContents = { ...slide.contents };
  elementCollections.forEach((collection) => {
    if (Array.isArray(slide.contents?.[collection])) {
      updatedContents[collection] =
        slide.contents[collection].map(applyUpdates);
    }
  });

  slides[slideIndex] = {
    ...slide,
    contents: updatedContents,
  };

  return setSlides(presentation, slides);
};

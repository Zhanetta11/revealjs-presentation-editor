import { createPlaceholderPseudoElement } from "./layoutOperations";
import { TITLE_PLACEHOLDER, FOOTER_PLACEHOLDERS, createMasterTextElement } from "../model/masterDefaults";
import { applyFormattingToParagraphs } from "../text/textFormatting";
import { createParagraphId } from "../utils/presentationUtils";
import { clampCrop } from "../model/mediaCrop";

const MASTER_FOOTER_IDS = ["master-footer-date", "master-footer-center", "master-footer-page"];

export const buildMasterPseudoSlide = (masterElements, masterColorTheme) => {
  const bgEntry = (masterColorTheme ?? []).find((e) => e["css-variable-name"] === "bg-light");
  const background = bgEntry?.color ?? "#FFFFFFFF";
  return {
    contents: {
      text: masterElements.text ?? [],
      media: masterElements.media ?? [],
      background,
    },
  };
};

export const buildLayoutPseudoSlide = (layout, masterColorTheme) => {
  const bgEntry = (masterColorTheme ?? []).find((e) => e["css-variable-name"] === "bg-light");
  const background = bgEntry?.color ?? "#FFFFFFFF";
  return {
    "layout-id": layout["layout-id"],
    contents: {
      text: [
        ...(layout.placeholders ?? [])
          .filter((p) => p.type === "text")
          .map((p) => createPlaceholderPseudoElement(p)),
        ...(layout.elements?.text ?? []),
      ],
      media: [
        ...(layout.placeholders ?? [])
          .filter((p) => p.type === "image" || p.type === "video")
          .map((p) => createPlaceholderPseudoElement(p)),
        ...(layout.elements?.media ?? []),
      ],
      background,
    },
  };
};

export const toggleMasterTitle = (presentation, layoutId) => {
  if (layoutId) {
    const layouts = presentation?.slideset?.layouts ?? [];
    const layout = layouts.find((l) => l["layout-id"] === layoutId);
    const hasTitle = (layout?.placeholders ?? []).some((p) => p.role === "title");
    const updatedPlaceholders = hasTitle
      ? (layout.placeholders ?? []).filter((p) => p["placeholder-id"] !== "title-placeholder")
      : [...(layout.placeholders ?? []), TITLE_PLACEHOLDER];
    return {
      ...presentation,
      slideset: {
        ...presentation.slideset,
        layouts: layouts.map((l) =>
          l["layout-id"] === layoutId ? { ...l, placeholders: updatedPlaceholders } : l
        ),
      },
    };
  }
  const elements = presentation?.slideset?.master?.elements ?? {};
  const hasTitle = (elements.text ?? []).some((el) => el.id === "master-title");
  const newText = hasTitle
    ? (elements.text ?? []).filter((el) => el.id !== "master-title")
    : [
        ...(elements.text ?? []),
        createMasterTextElement("master-title", { x: 120, y: 60 }, 1040, 110,
          "Click to edit Master title style", { size: "36px", weight: "bold", align: "center" }),
      ];
  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: { ...presentation.slideset.master, elements: { ...elements, text: newText } },
    },
  };
};

export const toggleMasterFooters = (presentation, layoutId) => {
  if (layoutId) {
    const layouts = presentation?.slideset?.layouts ?? [];
    const layout = layouts.find((l) => l["layout-id"] === layoutId);
    const hasFooters = (layout?.placeholders ?? []).some((p) => p["placeholder-id"]?.startsWith("footer-"));
    const updatedPlaceholders = hasFooters
      ? (layout.placeholders ?? []).filter((p) => !p["placeholder-id"]?.startsWith("footer-"))
      : [...(layout.placeholders ?? []), ...FOOTER_PLACEHOLDERS];
    return {
      ...presentation,
      slideset: {
        ...presentation.slideset,
        layouts: layouts.map((l) =>
          l["layout-id"] === layoutId ? { ...l, placeholders: updatedPlaceholders } : l
        ),
      },
    };
  }
  const elements = presentation?.slideset?.master?.elements ?? {};
  const hasFooters = (elements.text ?? []).some((el) => MASTER_FOOTER_IDS.includes(el.id));
  const fmt = { size: "20px", align: "center" };
  const newText = hasFooters
    ? (elements.text ?? []).filter((el) => !MASTER_FOOTER_IDS.includes(el.id))
    : [
        ...(elements.text ?? []),
        createMasterTextElement("master-footer-date",   { x: 60,  y: 640 }, 260, 40, "Date",   fmt),
        createMasterTextElement("master-footer-center", { x: 380, y: 640 }, 520, 40, "Footer", fmt),
        createMasterTextElement("master-footer-page",   { x: 960, y: 640 }, 260, 40, "#",      fmt),
      ];
  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: { ...presentation.slideset.master, elements: { ...elements, text: newText } },
    },
  };
};

function bgToHex6(bg) {
  if (!bg || typeof bg !== "string") return null;
  if (bg.startsWith("rgba")) {
    const m = bg.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
  }
  if (bg.startsWith("#")) return "#" + bg.replace("#", "").slice(0, 6).toLowerCase();
  return null;
}

export const updateMasterTheme = (
  presentation,
  colorTheme,
  decorations,
  { colorSchemeId, designId } = {},
) => {
  const oldBgLight = (presentation?.slideset?.master?.["color-theme"] ?? [])
    .find(e => e["css-variable-name"] === "bg-light")?.color;
  const oldBgHex6 = oldBgLight ? bgToHex6(oldBgLight) : null;

  const slides = (presentation?.slideset?.slides ?? []).map(slide => {
    const bg = slide?.contents?.background;
    if (!bg || bg === "#FFFFFFFF" || (typeof bg === "object" && bg.type === "image")) return slide;
    if (oldBgHex6 && typeof bg === "string" && bgToHex6(bg) === oldBgHex6) {
      return { ...slide, contents: { ...slide.contents, background: null } };
    }
    return slide;
  });

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      slides,
      master: {
        ...presentation.slideset.master,
        "color-theme": colorTheme,
        ...(decorations !== undefined ? { decorations } : {}),
        ...(colorSchemeId !== undefined
          ? { "current-color-scheme-id": colorSchemeId }
          : {}),
        ...(designId !== undefined
          ? { "last-applied-design-id": designId }
          : {}),
      },
    },
  };
};

const scaleElement = (el, scaleX, scaleY, newW, newH) => {
  const rawCrop = Array.isArray(el.crop) ? el.crop : [];
  const [ct, cr, cb, cl] = clampCrop(el.crop);
  const hasCrop = ct !== 0 || cr !== 0 || cb !== 0 || cl !== 0;
  const hadStoredCrop = rawCrop.some((value) => Number(value) !== 0);
  const isMedia = el["file-link"] != null || el["media-type"] != null;
  const wFrac = 1 - cl / 100 - cr / 100;
  const hFrac = 1 - ct / 100 - cb / 100;

  let w, h, scaledSrcW, scaledSrcH;

  if (hasCrop && el["source-width"] != null && el["source-height"] != null && (el["source-width"] > 0)) {
    scaledSrcW = wFrac > 0.001
      ? Math.round((el.width ?? 100) * scaleX / wFrac)
      : Math.round(el["source-width"] * scaleX);
    scaledSrcH = Math.round(scaledSrcW * (el["source-height"] / el["source-width"]));
    w = Math.max(20, Math.min(wFrac > 0.001 ? Math.round(scaledSrcW * wFrac) : Math.round((el.width ?? 100) * scaleX), newW));
    h = Math.max(10, Math.min(hFrac > 0.001 ? Math.round(scaledSrcH * hFrac) : Math.round((el.height ?? 50) * scaleY), newH));
  } else if (isMedia && !hasCrop && (el.width ?? 0) > 0) {
    w = Math.max(20, Math.min(Math.round((el.width ?? 100) * scaleX), newW));
    h = Math.max(10, Math.min(Math.round(w * ((el.height ?? 50) / el.width)), newH));
  } else {
    w = Math.max(20, Math.min(Math.round((el.width ?? 100) * scaleX), newW));
    h = Math.max(10, Math.min(Math.round((el.height ?? 50) * scaleY), newH));
  }

  const x = Math.max(0, Math.min(Math.round((el.position?.x ?? 0) * scaleX), newW - w));
  const y = Math.max(0, Math.min(Math.round((el.position?.y ?? 0) * scaleY), newH - h));

  return {
    ...el,
    position: { x, y },
    width: w,
    height: h,
    ...(hadStoredCrop ? { crop: [ct, cr, cb, cl] } : {}),
    ...(scaledSrcW != null ? { "source-width": scaledSrcW } : {}),
    ...(scaledSrcH != null ? { "source-height": scaledSrcH } : {}),
  };
};


const scalePositionOnly = (element, scaleX, scaleY, newW, newH) => ({
  ...element,
  position: {
    x: Math.max(0, Math.min(Math.round((element.position?.x ?? 0) * scaleX), newW)),
    y: Math.max(0, Math.min(Math.round((element.position?.y ?? 0) * scaleY), newH)),
  },
});

const scaleElements = (elements, scaleX, scaleY, newW, newH) => {
  const scaled = { ...elements };
  for (const key of ["text", "media", "shapes", "tables"]) {
    if (Array.isArray(elements?.[key])) {
      scaled[key] = elements[key].map((element) =>
        scaleElement(element, scaleX, scaleY, newW, newH),
      );
    }
  }
  if (Array.isArray(elements?.groups)) {
    scaled.groups = elements.groups.map((group) =>
      scalePositionOnly(group, scaleX, scaleY, newW, newH),
    );
  }
  return scaled;
};

export const updateMasterDimensions = (
  presentation,
  slideDimensions,
  aspectRatio,
  dimensionUnits,
) => {
  const oldDim = presentation?.slideset?.master?.["slide-dimensions"];
  const oldW = oldDim?.width ?? 1280;
  const oldH = oldDim?.height ?? 720;
  const newW = slideDimensions.width;
  const newH = slideDimensions.height;

  if (oldW === newW && oldH === newH) {
    return {
      ...presentation,
      slideset: {
        ...presentation.slideset,
        master: {
          ...presentation.slideset.master,
          "slide-dimensions": slideDimensions,
          "aspect-ratio": aspectRatio,
          "dimension-units": dimensionUnits,
        },
      },
    };
  }

  const scaleX = newW / oldW;
  const scaleY = newH / oldH;

  const oldMaster = presentation.slideset.master;
  const scaledMasterElements = scaleElements(oldMaster.elements ?? {}, scaleX, scaleY, newW, newH);

  const scaledLayouts = (presentation.slideset.layouts ?? []).map((layout) => ({
    ...layout,
    placeholders: (layout.placeholders ?? []).map((p) => scaleElement(p, scaleX, scaleY, newW, newH)),
    elements: scaleElements(layout.elements ?? {}, scaleX, scaleY, newW, newH),
  }));

  const scaledSlides = (presentation.slideset.slides ?? []).map((slide) => ({
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).map((el) => scaleElement(el, scaleX, scaleY, newW, newH)),
      media: (slide.contents?.media ?? []).map((el) => scaleElement(el, scaleX, scaleY, newW, newH)),
      shapes: (slide.contents?.shapes ?? []).map((el) => scaleElement(el, scaleX, scaleY, newW, newH)),
      tables: (slide.contents?.tables ?? []).map((el) => scaleElement(el, scaleX, scaleY, newW, newH)),
      groups: (slide.contents?.groups ?? []).map((el) => scalePositionOnly(el, scaleX, scaleY, newW, newH)),
    },
  }));

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...oldMaster,
        "slide-dimensions": slideDimensions,
        "aspect-ratio": aspectRatio,
        "dimension-units": dimensionUnits,
        elements: scaledMasterElements,
      },
      layouts: scaledLayouts,
      slides: scaledSlides,
    },
  };
};

export const updateMasterFormatting = (presentation, formatting) => {
  const oldMaster = presentation.slideset?.master?.formatting ?? {};
  const newMasterFormatting = { ...oldMaster, ...formatting };

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...presentation.slideset.master,
        formatting: newMasterFormatting,
      },
    },
  };
};

export const addMasterElement = (presentation, type, element) => ({
  ...presentation,
  slideset: {
    ...presentation.slideset,
    master: {
      ...presentation.slideset.master,
      elements: {
        ...(presentation.slideset.master.elements ?? {}),
        [type]: [
          ...(presentation.slideset.master.elements?.[type] ?? []),
          element,
        ],
      },
    },
  },
});

export const updateMasterElement = (presentation, type, elementId, updates) => ({
  ...presentation,
  slideset: {
    ...presentation.slideset,
    master: {
      ...presentation.slideset.master,
      elements: {
        ...(presentation.slideset.master.elements ?? {}),
        [type]: (presentation.slideset.master.elements?.[type] ?? []).map((el) =>
          el.id === elementId ? { ...el, ...updates } : el
        ),
      },
    },
  },
});

export const deleteMasterElement = (presentation, type, elementId) => ({
  ...presentation,
  slideset: {
    ...presentation.slideset,
    master: {
      ...presentation.slideset.master,
      elements: {
        ...(presentation.slideset.master.elements ?? {}),
        [type]: (presentation.slideset.master.elements?.[type] ?? []).filter(
          (el) => el.id !== elementId
        ),
      },
    },
  },
});


export const updateMasterTextFormatting = (presentation, elementId, formattingUpdate) => {
  const elements = presentation?.slideset?.master?.elements?.text ?? [];

  const updatedText = elements.map((el) => {
    if (el.id !== elementId) return el;
    return { ...el, paragraphs: applyFormattingToParagraphs(el.paragraphs, formattingUpdate) };
  });

  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...presentation.slideset.master,
        elements: {
          ...(presentation.slideset.master.elements ?? {}),
          text: updatedText,
        },
      },
    },
  };
};

export const updateMasterTextContent = (presentation, elementId, newText) => {
  const elements = presentation?.slideset?.master?.elements?.text ?? [];
  const updatedText = elements.map((el) => {
    if (el.id !== elementId) return el;
    const lines = newText.split("\n");
    const existingParagraphs = el.paragraphs ?? [];
    const updatedParagraphs = lines.map((line, i) => {
      const existing = existingParagraphs[i];
      return {
        id: existing?.id ?? createParagraphId(),
        formatting: existing?.formatting ?? {},
        bullets: existing?.bullets ?? "none",
        runs: [{
          formatting: existing?.runs?.[0]?.formatting ?? {},
          "super-sub-script": existing?.runs?.[0]?.["super-sub-script"] ?? "normal",
          text: line,
          link: existing?.runs?.[0]?.link ?? null,
        }],
      };
    });
    return { ...el, userModified: true, paragraphs: updatedParagraphs };
  });
  return {
    ...presentation,
    slideset: {
      ...presentation.slideset,
      master: {
        ...presentation.slideset.master,
        elements: {
          ...(presentation.slideset.master.elements ?? {}),
          text: updatedText,
        },
      },
    },
  };
};

export const updateMasterItem = (presentation, elementId, updates) => {
  const elements = presentation?.slideset?.master?.elements ?? {};
  const { text, formatting, ...rest } = updates;

  const isText = (elements.text ?? []).some((el) => el.id === elementId);
  const isMedia = (elements.media ?? []).some((el) => el.id === elementId);
  if (!isText && !isMedia) return presentation;
  const elementType = isText ? "text" : "media";

  let result = presentation;
  if (Object.keys(rest).length) result = updateMasterElement(result, elementType, elementId, rest);
  if (formatting) result = updateMasterTextFormatting(result, elementId, formatting);
  if (text !== undefined) result = updateMasterTextContent(result, elementId, text);
  return result;
};

export const hasTitle = (presentation, layoutId = null) => {
  if (layoutId) {
    const layout = (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === layoutId);
    return (layout?.placeholders ?? []).some((p) => p.role === "title");
  }
  return (presentation?.slideset?.master?.elements?.text ?? []).some((el) => el.id === "master-title");
};

export const hasFooters = (presentation, layoutId = null) => {
  if (layoutId) {
    const layout = (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === layoutId);
    return (layout?.placeholders ?? []).some((p) => p["placeholder-id"]?.startsWith("footer-"));
  }
  return (presentation?.slideset?.master?.elements?.text ?? []).some((el) => MASTER_FOOTER_IDS.includes(el.id));
};

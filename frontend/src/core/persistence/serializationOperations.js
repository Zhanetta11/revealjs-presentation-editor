import { validateSlideset } from "../operations/slidesetValidation";
import { migrateParagraphFormatting } from "../text/textFormatting";
import { downloadBackend } from "../export/downloadBackend";

const collectUsedFonts = (presentation) => {
  const fontNames = new Set();

  const scanFormatting = (fmt) => {
    if (fmt?.font) fontNames.add(fmt.font);
  };

  const slideset = presentation?.slideset;
  if (!slideset) return presentation;

  scanFormatting(slideset.master?.formatting);

  for (const layout of slideset.layouts ?? []) {
    for (const ph of layout.placeholders ?? []) {
      scanFormatting(ph.formatting);
    }
    for (const el of layout.elements?.text ?? []) {
      for (const para of el.paragraphs ?? []) {
        scanFormatting(para.formatting);
        for (const run of para.runs ?? []) scanFormatting(run.formatting);
      }
    }
  }

  for (const el of slideset.master?.elements?.text ?? []) {
    for (const para of el.paragraphs ?? []) {
      scanFormatting(para.formatting);
      for (const run of para.runs ?? []) scanFormatting(run.formatting);
    }
  }

  for (const slide of slideset.slides ?? []) {
    for (const el of slide.contents?.text ?? []) {
      for (const para of el.paragraphs ?? []) {
        scanFormatting(para.formatting);
        for (const run of para.runs ?? []) scanFormatting(run.formatting);
      }
    }
  }

  const existingFonts = slideset.fonts ?? [];
  const existingIds = new Set(existingFonts.map((f) => f["font-id"]));
  const merged = [
    ...existingFonts,
    ...[...fontNames]
      .filter((name) => !existingIds.has(name))
      .map((name) => ({ "font-id": name, "font-file": "" })),
  ];

  return {
    ...presentation,
    slideset: { ...slideset, fonts: merged },
  };
};

const listTypeToBullets = (listType) => {
  if (listType === "numbered") return "number";
  if (listType === "bullets") return "points";
  return "none";
};

const computeParagraphBullets = (presentation) => {
  const slideset = presentation?.slideset;
  if (!slideset) return presentation;

  const masterFormatting = slideset.master?.formatting ?? {};
  const layoutsById = new Map(
    (slideset.layouts ?? []).map((layout) => [layout["layout-id"], layout]),
  );

  const transformParagraphs = (
    paragraphs,
    placeholderFormatting = {},
    inheritedMasterFormatting = masterFormatting,
  ) =>
    (paragraphs ?? []).map((para) => ({
      ...para,
      bullets: listTypeToBullets(
        para.formatting?.["list-type"]
        ?? placeholderFormatting["list-type"]
        ?? inheritedMasterFormatting["list-type"],
      ),
    }));

  const transformTextElements = (
    elements,
    getPlaceholderFormatting = () => ({}),
    inheritedMasterFormatting = masterFormatting,
  ) =>
    (elements ?? []).map((el) => ({
      ...el,
      paragraphs: transformParagraphs(
        el.paragraphs,
        getPlaceholderFormatting(el),
        inheritedMasterFormatting,
      ),
    }));

  const slides = (slideset.slides ?? []).map((slide) => ({
    ...slide,
    contents: {
      ...slide.contents,
      text: transformTextElements(
        slide.contents?.text,
        (element) => {
          const layout = layoutsById.get(slide["layout-id"]);
          return (layout?.placeholders ?? []).find(
            (placeholder) =>
              placeholder["placeholder-id"] === element["placeholder-id"],
          )?.formatting ?? {};
        },
      ),
    },
  }));

  const layouts = (slideset.layouts ?? []).map((layout) => ({
    ...layout,
    elements: {
      ...layout.elements,
      text: transformTextElements(layout.elements?.text),
    },
  }));

  return {
    ...presentation,
    slideset: {
      ...slideset,
      slides,
      layouts,
      master: {
        ...slideset.master,
        elements: {
          ...slideset.master?.elements,
          text: transformTextElements(
            slideset.master?.elements?.text,
            () => ({}),
            masterFormatting,
          ),
        },
      },
    },
  };
};

const INTERNAL_FIELDS = new Set(["userSetKeys", "userModified", "isPlaceholder"]);

const stripInternalFields = (obj) => {
  if (Array.isArray(obj)) return obj.map(stripInternalFields);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !INTERNAL_FIELDS.has(k))
        .map(([k, v]) => [k, stripInternalFields(v)]),
    );
  }
  return obj;
};

const migratePresentation = (presentation) => {
  const layouts = presentation?.slideset?.layouts ?? [];
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const placeholderMap = new Map();
  for (const layout of layouts) {
    const layoutPlaceholders = new Map();
    for (const ph of layout.placeholders ?? []) {
      layoutPlaceholders.set(ph["placeholder-id"], ph.formatting ?? {});
    }
    placeholderMap.set(layout["layout-id"], layoutPlaceholders);
  }

  const slides = (presentation?.slideset?.slides ?? []).map((slide) => ({
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).map((el) => {
        const phFormatting =
          placeholderMap
            .get(slide["layout-id"])
            ?.get(el["placeholder-id"]) ?? {};
        return {
          ...el,
          paragraphs: migrateParagraphFormatting(el.paragraphs, phFormatting, masterFormatting),
        };
      }),
    },
  }));

  return { ...presentation, slideset: { ...presentation.slideset, slides } };
};

export const serializePresentation = (presentation) => {
  const withFonts = collectUsedFonts(presentation);
  const withBullets = computeParagraphBullets(withFonts);
  return JSON.stringify(stripInternalFields(withBullets), null, 2);
};

export const deserializePresentation = (jsonString) => {
  try {
    const parsedPresentation = JSON.parse(jsonString);
    const validationErrors = validateSlideset(parsedPresentation);

    if (validationErrors.length > 0) {
      console.warn("[Serialization] Validation errors:", validationErrors);
      return { data: migratePresentation(parsedPresentation), errors: validationErrors };
    }

    return { data: migratePresentation(parsedPresentation), errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Serialization] Failed to parse:", message);
    return { data: null, errors: [message] };
  }
};

export const downloadPresentationAsJson = (presentation) => {
  const json = serializePresentation(presentation);
  const filename = presentation.slideset?.filename ?? "untitled-presentation";
  downloadBackend.saveText(json, filename.endsWith(".json") ? filename : `${filename}.json`, "application/json");
};

import { validateSlideset } from "../../operations/slidesetValidation";
import { migrateParagraphFormatting } from "../../text/textFormatting";
import { CONTENT_PLACEHOLDER_PROMPTS } from "../../operations/textOperations";
import { downloadBackend } from "../../export/downloadBackend";

const PLACEHOLDER_ROLE_PROMPTS = {
  title: "Click to edit title",
  subtitle: "Click to edit subtitle",
  footer: "Footer",
  date: "Date",
  "slide-number": "#",
};

const placeholderDefaultText = (placeholder) =>
  placeholder?.promptText
  ?? PLACEHOLDER_ROLE_PROMPTS[placeholder?.role]
  ?? "Click to edit text";

const plainParagraphText = (paragraphs) =>
  (paragraphs ?? [])
    .map((p) => (p.runs ?? []).map((r) => r.text ?? "").join(""))
    .join("\n")
    .trim();

const isUserModifiedPlaceholderText = (paragraphs, placeholder) => {
  const text = plainParagraphText(paragraphs);
  if (text === "") return false;
  if (CONTENT_PLACEHOLDER_PROMPTS.has(text)) return false;
  if (text === placeholderDefaultText(placeholder)) return false;
  return true;
};

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
const ASSET_REFERENCE_FIELDS = new Set(["file-link", "font-file"]);

const isNonPortableLocalAssetReference = (value) => {
  if (typeof value !== "string" || value.length === 0) return false;
  return (
    value.startsWith("indexeddb://")
    || value.startsWith("blob:")
    || value.startsWith("file://")
    || /^[a-zA-Z]:[\\/]/.test(value)
    || /^\\\\/.test(value)
    || value.startsWith("/")
  );
};

export const findNonPortableAssetReferences = (value) => {
  const references = [];
  const visited = new WeakSet();

  const walk = (current, path) => {
    if (!current || typeof current !== "object") return;
    if (visited.has(current)) return;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    Object.entries(current).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      if (
        ASSET_REFERENCE_FIELDS.has(key)
        && isNonPortableLocalAssetReference(child)
      ) {
        references.push({ path: childPath, value: child });
      } else {
        walk(child, childPath);
      }
    });
  };

  walk(value, "");
  return references;
};

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
      layoutPlaceholders.set(ph["placeholder-id"], ph);
    }
    placeholderMap.set(layout["layout-id"], layoutPlaceholders);
  }

  const slides = (presentation?.slideset?.slides ?? []).map((slide) => ({
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).map((el) => {
        const placeholder =
          placeholderMap.get(slide["layout-id"])?.get(el["placeholder-id"]) ?? null;
        const phFormatting = placeholder?.formatting ?? {};
        const migrated = {
          ...el,
          paragraphs: migrateParagraphFormatting(el.paragraphs, phFormatting, masterFormatting),
        };
        if (
          el["placeholder-id"]
          && el.userModified !== true
          && isUserModifiedPlaceholderText(migrated.paragraphs, placeholder)
        ) {
          migrated.userModified = true;
        }
        return migrated;
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
    const parsedPresentation = JSON.parse(jsonString, (key, value) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        return undefined;
      }
      return value;
    });
    const stack = [{ value: parsedPresentation, depth: 0 }];
    let nodeCount = 0;
    while (stack.length > 0) {
      const { value, depth } = stack.pop();
      if (!value || typeof value !== "object") continue;
      nodeCount += 1;
      if (depth > 100 || nodeCount > 100_000) {
        throw new Error("Presentation structure is too deeply nested or complex.");
      }
      Object.values(value).forEach((child) => {
        if (child && typeof child === "object") {
          stack.push({ value: child, depth: depth + 1 });
        }
      });
    }
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

export const downloadPresentationAsJson = async (presentation) => {
  const localReferences = findNonPortableAssetReferences(presentation);
  if (localReferences.length > 0) {
    throw new Error(
      "Standalone JSON cannot include local media or font references. "
      + "Save a project folder or use ZIP export so the asset files are included.",
    );
  }
  const json = serializePresentation(presentation);
  const filename = presentation.slideset?.filename ?? "untitled-presentation";
  await downloadBackend.saveText(json, filename.endsWith(".json") ? filename : `${filename}.json`, "application/json");
};

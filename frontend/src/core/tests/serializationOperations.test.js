import { describe, test, expect, vi } from "vitest";
import {
  downloadPresentationAsJson,
  findNonPortableAssetReferences,
  serializePresentation,
  deserializePresentation,
} from "../persistence/serialization/serializationOperations";
import { validateSlideset } from "../operations/slidesetValidation";
import { createDefaultPresentation } from "../model/defaultPresentation";
import { applyLayoutToSlide } from "../operations/layoutOperations";
import { downloadBackend } from "../export/downloadBackend";

const makePlaceholderPresentation = (bodyText, extraFormatting = {}) => ({
  slideset: {
    master: { formatting: {} },
    layouts: [
      {
        "layout-id": "with-body",
        placeholders: [
          {
            "placeholder-id": "body-placeholder",
            type: "text",
            role: "body",
            position: { x: 10, y: 10 },
            width: 200,
            height: 100,
            formatting: {},
          },
        ],
      },
      { "layout-id": "title-only", placeholders: [] },
    ],
    slides: [
      {
        "layout-id": "with-body",
        contents: {
          text: [
            {
              id: "body-text",
              "placeholder-id": "body-placeholder",
              paragraphs: [
                { formatting: extraFormatting, runs: [{ text: bodyText, formatting: {} }] },
              ],
            },
          ],
          media: [],
        },
      },
    ],
  },
});

const loadedBodyElement = (presentation) => {
  const result = deserializePresentation(JSON.stringify(presentation));
  return result.data.slideset.slides[0].contents.text[0];
};

describe("serializationOperations", () => {
  test("serializes presentation to JSON string", () => {
    const presentation = createDefaultPresentation();

    const json = serializePresentation(presentation);

    expect(typeof json).toBe("string");
    expect(json).toContain("slideset");
  });

  test("deserializes valid presentation without errors", () => {
    const presentation = createDefaultPresentation();
    const json = serializePresentation(presentation);

    const result = deserializePresentation(json);

    expect(result).not.toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.data.slideset.layouts.length).toBeGreaterThan(0);
    expect(result.data.slideset.slides.length).toBeGreaterThan(0);
  });

  test("round trip preserves valid presentation structure", () => {
    const original = createDefaultPresentation();

    const json = serializePresentation(original);
    const result = deserializePresentation(json);

    expect(result).not.toBeNull();

    const validationErrors = validateSlideset(result.data);

    expect(validationErrors).toEqual([]);
    expect(result.data.slideset.layouts.length).toBeGreaterThan(0);
    expect(result.data.slideset.slides.length).toBeGreaterThan(0);
  });

  test("preserves unsupported team-owned content and font declarations", () => {
    const presentation = createDefaultPresentation();
    presentation.slideset.fonts.push({
      "font-id": "ShapeTeamFont",
      "font-file": "fonts/shape-team.woff",
    });
    const contents = presentation.slideset.slides[0].contents;
    contents.shapes = [{
      id: "shape-1",
      type: "custom",
      position: { x: 20, y: 30 },
      width: 200,
      height: 100,
      config: { teamSpecific: "keep" },
      paragraphs: [{
        id: "shape-paragraph",
        formatting: { font: "ShapeTeamFont" },
        runs: [{ text: "Shape", formatting: {} }],
      }],
    }];
    contents.tables = [{
      id: "table-1",
      position: { x: 50, y: 60 },
      width: 300,
      height: 180,
      table: { rows: [{ cells: [{ vendorField: "keep" }] }] },
    }];
    contents.groups = [{
      id: "group-1",
      elements: ["shape-1", "table-1"],
      position: { x: 10, y: 10 },
      vendorField: { keep: true },
    }];

    const serialized = JSON.parse(serializePresentation(presentation));

    expect(serialized.slideset.fonts).toContainEqual({
      "font-id": "ShapeTeamFont",
      "font-file": "fonts/shape-team.woff",
    });
    expect(serialized.slideset.slides[0].contents.shapes).toEqual(contents.shapes);
    expect(serialized.slideset.slides[0].contents.tables).toEqual(contents.tables);
    expect(serialized.slideset.slides[0].contents.groups).toEqual(contents.groups);
  });

  test("serializes bullets metadata using layout inheritance and explicit none", () => {
    const presentation = createDefaultPresentation();
    const layout = presentation.slideset.layouts.find(
      (item) => item["layout-id"] === "title-content",
    );
    const bodyPlaceholder = layout.placeholders.find(
      (placeholder) => placeholder["placeholder-id"] === "body-placeholder",
    );
    bodyPlaceholder.formatting["list-type"] = "bullets";
    const bodyText = presentation.slideset.slides[0].contents.text.find(
      (element) => element["placeholder-id"] === "body-placeholder",
    );
    bodyText.paragraphs[0].formatting = {};

    let serialized = JSON.parse(serializePresentation(presentation));
    let serializedBody = serialized.slideset.slides[0].contents.text.find(
      (element) => element["placeholder-id"] === "body-placeholder",
    );
    expect(serializedBody.paragraphs[0].bullets).toBe("points");

    bodyText.paragraphs[0].formatting = { "list-type": "none" };
    serialized = JSON.parse(serializePresentation(presentation));
    serializedBody = serialized.slideset.slides[0].contents.text.find(
      (element) => element["placeholder-id"] === "body-placeholder",
    );
    expect(serializedBody.paragraphs[0].bullets).toBe("none");
  });

  test("migrates duplicate placeholder ids using the slide layout", () => {
    const presentation = createDefaultPresentation();
    presentation.slideset.master.formatting = {};
    presentation.slideset.layouts = [
      {
        "layout-id": "red-layout",
        placeholders: [{
          "placeholder-id": "title",
          type: "text",
          position: { x: 0, y: 0 },
          width: 100,
          height: 50,
          formatting: { color: "red" },
        }],
      },
      {
        "layout-id": "blue-layout",
        placeholders: [{
          "placeholder-id": "title",
          type: "text",
          position: { x: 0, y: 0 },
          width: 100,
          height: 50,
          formatting: { color: "blue" },
        }],
      },
    ];
    presentation.slideset.slides = [{
      "layout-id": "red-layout",
      contents: {
        text: [{
          id: "title-text",
          "placeholder-id": "title",
          paragraphs: [{
            formatting: { color: "blue" },
            runs: [{ text: "Explicit blue", formatting: {} }],
          }],
        }],
        media: [],
      },
    }];

    const result = deserializePresentation(JSON.stringify(presentation));

    expect(
      result.data.slideset.slides[0].contents.text[0].paragraphs[0].formatting.color,
    ).toBe("blue");
  });

  test("returns null data for invalid JSON", () => {
    const result = deserializePresentation("{ invalid json }");

    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("drops prototype-pollution keys while loading", () => {
    const presentation = createDefaultPresentation();
    const json = JSON.stringify(presentation).replace(
      '"slideset":{',
      '"slideset":{"__proto__":{"polluted":true},',
    );

    const result = deserializePresentation(json);

    expect(result.data).not.toBeNull();
    expect(Object.prototype.polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result.data.slideset, "__proto__")).toBe(false);
  });

  test("keeps validation errors for invalid presentation", () => {
    const invalidPresentation = {
      slideset: {
        filename: "broken.json",
        master: {
          "slide-dimensions": { width: 1280, height: 720 },
          "color-theme": [],
        },
        layouts: [],
        slides: [
          {
            title: { content: "Broken Slide" },
            "layout-id": "missing-layout",
            contents: {
              text: [],
              media: [],
              shapes: [],
              tables: [],
              groups: [],
              animations: [],
            },
          },
        ],
      },
    };

    const json = serializePresentation(invalidPresentation);
    const result = deserializePresentation(json);

    expect(result).not.toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContain(
      "Slide 1 references unknown layout: missing-layout"
    );
  });

  test.each([
    "indexeddb://media/image.png",
    "blob:https://editor.local/runtime-media",
    "file:///C:/Users/User/AppData/cache/image.png",
    "C:\\Users\\User\\AppData\\cache\\image.png",
    "/tmp/editor-cache/image.png",
  ])("detects non-portable local asset reference %s", (fileLink) => {
    const presentation = createDefaultPresentation();
    presentation.slideset.slides[0].contents.media.push({
      id: "local-image",
      "media-type": "image",
      "file-link": fileLink,
    });

    expect(findNonPortableAssetReferences(presentation)).toEqual([
      expect.objectContaining({ value: fileLink }),
    ]);
  });

  test("blocks standalone JSON when local media references would leak", async () => {
    const presentation = createDefaultPresentation();
    presentation.slideset.slides[0].contents.media.push({
      id: "local-image",
      "media-type": "image",
      "file-link": "indexeddb://media/image.png",
    });
    const saveText = vi
      .spyOn(downloadBackend, "saveText")
      .mockResolvedValue(undefined);

    await expect(downloadPresentationAsJson(presentation)).rejects.toThrow(
      "Standalone JSON cannot include local media or font references",
    );
    expect(saveText).not.toHaveBeenCalled();
    saveText.mockRestore();
  });

  test("allows standalone JSON when it has no local runtime references", async () => {
    const presentation = createDefaultPresentation();
    const saveText = vi
      .spyOn(downloadBackend, "saveText")
      .mockResolvedValue(undefined);

    await downloadPresentationAsJson(presentation);

    expect(saveText).toHaveBeenCalledOnce();
    expect(saveText.mock.calls[0][0]).not.toContain("indexeddb://");
    saveText.mockRestore();
  });
});

describe("userModified re-derivation on load", () => {
  test("re-derives userModified for real user text in a placeholder", () => {
    const el = loadedBodyElement(makePlaceholderPresentation("My real content"));
    expect(el.userModified).toBe(true);
  });

  test("does not mark empty placeholder text as userModified", () => {
    const el = loadedBodyElement(makePlaceholderPresentation(""));
    expect(el.userModified).not.toBe(true);
  });

  test("does not mark known prompt text as userModified", () => {
    const el = loadedBodyElement(makePlaceholderPresentation("Click to edit text"));
    expect(el.userModified).not.toBe(true);
  });

  test("does not mark a placeholder's own promptText as userModified", () => {
    const presentation = makePlaceholderPresentation("Type here");
    presentation.slideset.layouts[0].placeholders[0].promptText = "Type here";
    const el = loadedBodyElement(presentation);
    expect(el.userModified).not.toBe(true);
  });

  test("userModified is not written to the shared/exported JSON", () => {
    const loaded = deserializePresentation(
      JSON.stringify(makePlaceholderPresentation("Kept content")),
    ).data;
    expect(loaded.slideset.slides[0].contents.text[0].userModified).toBe(true);
    expect(serializePresentation(loaded)).not.toContain("userModified");
  });

  test("user text survives save -> reopen -> layout switch to a layout without the placeholder", () => {
    const reopened = deserializePresentation(
      JSON.stringify(makePlaceholderPresentation("Important notes")),
    ).data;
    const switched = applyLayoutToSlide(reopened, 0, "title-only");
    const texts = switched.slideset.slides[0].contents.text;
    const kept = texts.find((t) =>
      t.paragraphs?.[0]?.runs?.[0]?.text === "Important notes",
    );
    expect(kept).toBeDefined();
  });

  test("does not touch decorative text boxes (no placeholder-id)", () => {
    const presentation = makePlaceholderPresentation("box content");
    delete presentation.slideset.slides[0].contents.text[0]["placeholder-id"];
    const el = loadedBodyElement(presentation);
    expect(el.userModified).not.toBe(true);
  });

  test("preserves explicit formatting overrides while re-deriving userModified", () => {
    const el = loadedBodyElement(
      makePlaceholderPresentation("Styled text", { color: "#123456" }),
    );
    expect(el.userModified).toBe(true);
    expect(el.paragraphs[0].formatting.color).toBe("#123456");
  });
});

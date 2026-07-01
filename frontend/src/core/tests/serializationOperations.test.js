import { describe, test, expect } from "vitest";
import {
  serializePresentation,
  deserializePresentation,
} from "../persistence/serializationOperations";
import { validateSlideset } from "../operations/slidesetValidation";
import { createDefaultPresentation } from "../model/defaultPresentation";

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
      (item) => item["layout-id"] === "title-content-media",
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
});

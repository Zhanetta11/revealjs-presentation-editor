import { describe, expect, test } from "vitest";
import {
  buildLayoutPseudoSlide,
  buildMasterPseudoSlide,
  updateMasterDimensions,
  updateMasterItem,
} from "../operations/masterOperations";

describe("updateMasterDimensions media scaling", () => {
  test("normalizes legacy negative crop values while resizing a presentation", () => {
    const presentation = {
      slideset: {
        master: {
          "slide-dimensions": { width: 1000, height: 500 },
          elements: { text: [], media: [] },
        },
        layouts: [],
        slides: [{
          contents: {
            text: [],
            media: [{
              id: "image-1",
              "file-link": "image.png",
              position: { x: 100, y: 50 },
              width: 500,
              height: 350,
              "source-width": 400,
              "source-height": 300,
              crop: [-10, -20, 0, 0],
            }],
          },
        }],
      },
    };

    const updated = updateMasterDimensions(
      presentation,
      { width: 1500, height: 750 },
      "2:1",
      "px",
    );
    const media = updated.slideset.slides[0].contents.media[0];

    expect(media.crop).toEqual([0, 0, 0, 0]);
    expect(media.width).toBe(750);
    expect(media.height).toBe(525);
  });

  test("preserves and scales team-owned shapes, tables, and groups", () => {
    const presentation = {
      slideset: {
        master: {
          "slide-dimensions": { width: 1000, height: 500 },
          elements: {
            text: [],
            media: [],
            shapes: [{ id: "master-shape", position: { x: 10, y: 20 }, width: 100, height: 50 }],
            vendorElements: [{ keep: true }],
          },
        },
        layouts: [{
          "layout-id": "layout",
          placeholders: [],
          elements: {
            text: [],
            media: [],
            tables: [{ id: "layout-table", position: { x: 20, y: 30 }, width: 200, height: 100 }],
          },
        }],
        slides: [{
          contents: {
            text: [],
            media: [],
            shapes: [{ id: "shape", position: { x: 100, y: 50 }, width: 200, height: 100 }],
            tables: [{ id: "table", position: { x: 300, y: 100 }, width: 200, height: 100 }],
            groups: [{ id: "group", elements: ["shape", "table"], position: { x: 50, y: 25 } }],
          },
        }],
      },
    };

    const updated = updateMasterDimensions(
      presentation,
      { width: 2000, height: 1000 },
      "2:1",
      "px",
    );

    expect(updated.slideset.master.elements.shapes[0].position).toEqual({ x: 20, y: 40 });
    expect(updated.slideset.master.elements.vendorElements).toEqual([{ keep: true }]);
    expect(updated.slideset.layouts[0].elements.tables[0].width).toBe(400);
    expect(updated.slideset.slides[0].contents.shapes[0].width).toBe(400);
    expect(updated.slideset.slides[0].contents.tables[0].position).toEqual({ x: 600, y: 200 });
    expect(updated.slideset.slides[0].contents.groups[0]).toMatchObject({
      elements: ["shape", "table"],
      position: { x: 100, y: 50 },
    });
  });
});

describe("master z-order context", () => {
  test("includes every supported master and layout collection", () => {
    const masterSlide = buildMasterPseudoSlide({
      text: [{ id: "text" }],
      media: [{ id: "media" }],
      shapes: [{ id: "shape" }],
      tables: [{ id: "table" }],
      groups: [{ id: "group" }],
    });
    const layoutSlide = buildLayoutPseudoSlide({
      "layout-id": "layout",
      placeholders: [{
        "placeholder-id": "placeholder",
        type: "text",
      }],
      elements: {
        shapes: [{ id: "layout-shape" }],
        tables: [{ id: "layout-table" }],
        groups: [{ id: "layout-group" }],
      },
    });

    expect(masterSlide.contents.shapes[0].id).toBe("shape");
    expect(masterSlide.contents.tables[0].id).toBe("table");
    expect(masterSlide.contents.groups[0].id).toBe("group");
    expect(layoutSlide.contents.text[0].id).toBe("placeholder");
    expect(layoutSlide.contents.shapes[0].id).toBe("layout-shape");
    expect(layoutSlide.contents.tables[0].id).toBe("layout-table");
    expect(layoutSlide.contents.groups[0].id).toBe("layout-group");
  });

  test("updates z-index in non-text master element collections", () => {
    const presentation = {
      slideset: {
        master: {
          elements: {
            shapes: [{ id: "shape", "z-index": 1 }],
          },
        },
      },
    };

    const updated = updateMasterItem(presentation, "shape", {
      "z-index": 3,
    });

    expect(updated.slideset.master.elements.shapes[0]["z-index"]).toBe(3);
  });
});

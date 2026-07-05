import { describe, expect, test } from "vitest";
import {
  createZOrderUpdates,
  getElementsInZOrder,
} from "../operations/zOrderOperations";

const element = (id, zIndex) => ({
  id,
  ...(zIndex === undefined ? {} : { "z-index": zIndex }),
});

const slideWith = ({ text = [], media = [] }) => ({
  contents: { text, media },
});

const applyUpdates = (slide, updates) => {
  const updatesById = new Map(
    updates.map(({ elementId, updates: value }) => [elementId, value]),
  );
  const apply = (item) => ({ ...item, ...(updatesById.get(item.id) ?? {}) });
  return slideWith({
    text: slide.contents.text.map(apply),
    media: slide.contents.media.map(apply),
  });
};

const orderedIdsAfter = (slide, selectedIds, mode) => {
  const updates = createZOrderUpdates(slide, selectedIds, mode);
  return getElementsInZOrder(applyUpdates(slide, updates)).map(
    (item) => item.id,
  );
};

describe("zOrderOperations", () => {
  test("uses editor paint order as a stable tie-breaker", () => {
    const slide = slideWith({
      text: [element("text", 1)],
      media: [element("media", 1)],
    });

    expect(getElementsInZOrder(slide).map((item) => item.id)).toEqual([
      "text",
      "media",
    ]);
  });

  test("orders every supported element collection in one stack", () => {
    const slide = {
      contents: {
        text: [element("text", 5)],
        media: [element("media", 4)],
        shapes: [element("shape", 3)],
        tables: [element("table", 2)],
        groups: [element("group", 1)],
      },
    };

    expect(getElementsInZOrder(slide).map((item) => item.id)).toEqual([
      "group",
      "table",
      "shape",
      "media",
      "text",
    ]);
  });

  test("bring forward swaps with the next visible layer and removes ties", () => {
    const slide = slideWith({
      text: [element("a", 1), element("b", 2)],
      media: [element("c", 2)],
    });

    expect(orderedIdsAfter(slide, ["a"], "forward")).toEqual([
      "b",
      "a",
      "c",
    ]);

    const updates = createZOrderUpdates(slide, ["a"], "forward");
    const zIndexes = getElementsInZOrder(applyUpdates(slide, updates)).map(
      (item) => item["z-index"],
    );
    expect(zIndexes).toEqual([1, 2, 3]);
  });

  test("send backward swaps with the previous layer", () => {
    const slide = slideWith({
      text: [element("a", 1), element("b", 2), element("c", 3)],
    });

    expect(orderedIdsAfter(slide, ["c"], "backward")).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  test("moves multiple selected elements as a block while preserving order", () => {
    const slide = slideWith({
      text: [
        element("a", 1),
        element("b", 2),
        element("c", 3),
        element("d", 4),
      ],
    });

    expect(orderedIdsAfter(slide, ["a", "b"], "forward")).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(orderedIdsAfter(slide, ["b", "c"], "front")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(orderedIdsAfter(slide, ["b", "c"], "back")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  test("normalizes missing and duplicate values even at a boundary", () => {
    const slide = slideWith({
      text: [element("a"), element("b", 1)],
      media: [element("c", 1)],
    });

    const updates = createZOrderUpdates(slide, ["c"], "front");
    const updated = applyUpdates(slide, updates);

    expect(getElementsInZOrder(updated).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(getElementsInZOrder(updated).map((item) => item["z-index"])).toEqual([
      1, 2, 3,
    ]);
  });
});

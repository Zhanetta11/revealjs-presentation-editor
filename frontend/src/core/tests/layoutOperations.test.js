import { describe, test, expect } from "vitest";
import {
    propagateLayoutChanges,
    applyLayoutToSlide,
    addLayout,
    deleteLayout,
    renameLayout,
    addLayoutPlaceholder,
    removeLayoutPlaceholder,
    addLayoutElement,
    deleteLayoutElement,
    updateLayoutElement,
    resetSlideToLayout,
} from "../operations/layoutOperations";

describe("layoutOperations", () => {
  const createPresentation = () => ({
    slideset: {
      layouts: [
        {
          "layout-id": "layout-1",
          placeholders: [
            {
              "placeholder-id": "title",
              position: { x: 10, y: 20 },
              width: 300,
              height: 80,
            },
            {
              "placeholder-id": "image",
              position: { x: 100, y: 120 },
              width: 400,
              height: 250,
            },
          ],
        },
      ],
      slides: [
        {
          "layout-id": "layout-1",
          contents: {
            text: [
              {
                id: "text-1",
                "placeholder-id": "title",
                position: { x: 10, y: 20 },
                width: 300,
                height: 80,
                paragraphs: [
                  {
                    runs: [{ text: "Original title" }],
                  },
                ],
              },
            ],
            media: [
              {
                id: "media-1",
                "placeholder-id": "image",
                "file-link": "",
                "media-type": "image",
                position: { x: 100, y: 120 },
                width: 400,
                height: 250,
              },
            ],
          },
        },
      ],
    },
  });

  test("propagates placeholder changes to text and media elements", () => {
    const presentation = createPresentation();

    const updated = propagateLayoutChanges(
      presentation,
      "layout-1",
      [
        {
          "placeholder-id": "title",
          position: { x: 50, y: 60 },
          width: 500,
          height: 100,
        },
        {
          "placeholder-id": "image",
          position: { x: 200, y: 220 },
          width: 300,
          height: 180,
        },
      ],
    );

    const updatedSlide = updated.slideset.slides[0];
    const updatedText = updatedSlide.contents.text[0];
    const updatedMedia = updatedSlide.contents.media[0];

    expect(updatedText.position).toEqual({ x: 50, y: 60 });
    expect(updatedText.width).toBe(500);
    expect(updatedText.height).toBe(100);

    expect(updatedMedia.position).toEqual({ x: 200, y: 220 });
    expect(updatedMedia.width).toBe(300);
    expect(updatedMedia.height).toBe(180);
  });

  test("preserves text and media content during layout propagation", () => {
    const presentation = createPresentation();

    const updated = propagateLayoutChanges(
      presentation,
      "layout-1",
      [
        {
          "placeholder-id": "title",
          position: { x: 70, y: 80 },
          width: 600,
          height: 120,
        },
        {
          "placeholder-id": "image",
          position: { x: 150, y: 160 },
          width: 350,
          height: 240,
        },
      ],
    );

    expect(
      updated.slideset.slides[0].contents.text[0].paragraphs[0].runs[0].text
    ).toBe("Original title");

    expect(
      updated.slideset.slides[0].contents.media[0].id
    ).toBe("media-1");
  });

  test("content edits do not break placeholder geometry inheritance", () => {
    const presentation = createPresentation();
    presentation.slideset.slides[0].contents.text[0].userModified = true;

    const updated = propagateLayoutChanges(presentation, "layout-1", [
      {
        ...presentation.slideset.layouts[0].placeholders[0],
        position: { x: 80, y: 90 },
        width: 550,
      },
      presentation.slideset.layouts[0].placeholders[1],
    ]);

    const title = updated.slideset.slides[0].contents.text[0];
    expect(title.position).toEqual({ x: 80, y: 90 });
    expect(title.width).toBe(550);
    expect(title.paragraphs[0].runs[0].text).toBe("Original title");
    expect(title.userModified).toBe(true);
  });

  test("preserves geometry that was moved away from the old placeholder", () => {
    const presentation = createPresentation();
    presentation.slideset.slides[0].contents.text[0].position = { x: 999, y: 888 };

    const updated = propagateLayoutChanges(presentation, "layout-1", [
      {
        ...presentation.slideset.layouts[0].placeholders[0],
        position: { x: 80, y: 90 },
      },
      presentation.slideset.layouts[0].placeholders[1],
    ]);

    expect(updated.slideset.slides[0].contents.text[0].position).toEqual({
      x: 999,
      y: 888,
    });
  });

  test("updates the layout definition itself", () => {
    const presentation = createPresentation();

    const updatedPlaceholders = [
      {
        "placeholder-id": "title",
        position: { x: 30, y: 40 },
        width: 450,
        height: 90,
      },
    ];

    const updated = propagateLayoutChanges(
      presentation,
      "layout-1",
      updatedPlaceholders,
    );

    expect(updated.slideset.layouts[0].placeholders).toEqual(
      updatedPlaceholders
    );
  });

  test("does not change slides using a different layout", () => {
    const presentation = {
      slideset: {
        layouts: [
          {
            "layout-id": "layout-1",
            placeholders: [],
          },
          {
            "layout-id": "layout-2",
            placeholders: [],
          },
        ],
        slides: [
          {
            "layout-id": "layout-2",
            contents: {
              text: [
                {
                  id: "text-1",
                  "placeholder-id": "title",
                  position: { x: 10, y: 20 },
                  width: 300,
                  height: 80,
                },
              ],
              media: [],
            },
          },
        ],
      },
    };

    const updated = propagateLayoutChanges(
      presentation,
      "layout-1",
      [
        {
          "placeholder-id": "title",
          position: { x: 99, y: 99 },
          width: 999,
          height: 999,
        },
      ],
    );

    expect(updated.slideset.slides[0].contents.text[0].position).toEqual({
      x: 10,
      y: 20,
    });
  });

  test("applies new layout by updating matching placeholders and creating missing ones", () => {
    const presentation = {
        slideset: {
        layouts: [
            {
            "layout-id": "old-layout",
            placeholders: [
                {
                "placeholder-id": "title",
                type: "text",
                position: { x: 10, y: 20 },
                width: 300,
                height: 80,
                },
            ],
            },
            {
            "layout-id": "new-layout",
            placeholders: [
                {
                "placeholder-id": "title",
                type: "text",
                position: { x: 50, y: 60 },
                width: 500,
                height: 100,
                },
                {
                "placeholder-id": "image",
                type: "image",
                position: { x: 200, y: 220 },
                width: 300,
                height: 180,
                },
            ],
            },
        ],
        slides: [
            {
            "layout-id": "old-layout",
            contents: {
                text: [
                {
                    id: "text-1",
                    "placeholder-id": "title",
                    position: { x: 10, y: 20 },
                    width: 300,
                    height: 80,
                    paragraphs: [
                    {
                        runs: [{ text: "Existing title" }],
                    },
                    ],
                },
                {
                    id: "text-extra",
                    "placeholder-id": "old-extra",
                    position: { x: 5, y: 5 },
                    width: 100,
                    height: 50,
                    userModified: true,
                },
                ],
                media: [],
            },
            },
        ],
        },
    };

    const updated = applyLayoutToSlide(presentation, 0, "new-layout");
    const slide = updated.slideset.slides[0];

    expect(slide["layout-id"]).toBe("new-layout");

    const title = slide.contents.text.find(
        (el) => el["placeholder-id"] === "title"
    );
    expect(title.position).toEqual({ x: 50, y: 60 });
    expect(title.width).toBe(500);
    expect(title.height).toBe(100);
    expect(title.paragraphs[0].runs[0].text).toBe("Existing title");

    const extra = slide.contents.text.find((el) => el.id === "text-extra");
    expect(extra.position).toEqual({ x: 5, y: 5 });
    expect(extra["placeholder-id"]).toBe("old-extra");

    const image = slide.contents.media.find(
        (el) => el["placeholder-id"] === "image"
    );
    expect(image).toBeDefined();
    expect(image["media-type"]).toBe("image");
    expect(image.position).toEqual({ x: 200, y: 220 });
    });

  test("applying a blank layout keeps edited text as a standalone element", () => {
    const presentation = createPresentation();
    presentation.slideset.layouts.push({
      "layout-id": "blank",
      placeholders: [],
    });
    presentation.slideset.slides[0].contents.text[0].userModified = true;

    const updated = applyLayoutToSlide(presentation, 0, "blank");
    const title = updated.slideset.slides[0].contents.text[0];

    expect(title.paragraphs[0].runs[0].text).toBe("Original title");
    expect(title["placeholder-id"]).toBe("title");
    expect(title["pos-type"]).toBeUndefined();
    expect(updated.slideset.slides[0].contents.media).toEqual([]);
  });

  test("carries edited text into a same-role placeholder with a different id", () => {
    const presentation = createPresentation();
    presentation.slideset.layouts[0].placeholders[0].role = "title";
    presentation.slideset.layouts.push({
      "layout-id": "other",
      placeholders: [
        {
          "placeholder-id": "different-title-id",
          type: "text",
          role: "title",
          position: { x: 50, y: 60 },
          width: 500,
          height: 100,
        },
      ],
    });
    presentation.slideset.slides[0].contents.text[0].userModified = true;

    const updated = applyLayoutToSlide(presentation, 0, "other");
    const texts = updated.slideset.slides[0].contents.text;

    const carried = texts.find((el) => el["placeholder-id"] === "different-title-id");
    expect(carried).toBeDefined();
    expect(carried.paragraphs[0].runs[0].text).toBe("Original title");
    expect(carried.position).toEqual({ x: 50, y: 60 });
    expect(texts.filter((el) => el["placeholder-id"] === "different-title-id")).toHaveLength(1);
  });

  test("reset restores layout geometry without forgetting edited content", () => {
    const presentation = createPresentation();
    const title = presentation.slideset.slides[0].contents.text[0];
    title.userModified = true;
    title.position = { x: 500, y: 500 };
    title.rotation = 25;
    presentation.slideset.layouts[0].placeholders[0].rotation = 10;

    const reset = resetSlideToLayout(presentation, 0);
    const resetTitle = reset.slideset.slides[0].contents.text[0];
    expect(resetTitle.position).toEqual({ x: 10, y: 20 });
    expect(resetTitle.rotation).toBe(10);
    expect(resetTitle.userModified).toBe(true);

    const changedLayout = propagateLayoutChanges(reset, "layout-1", [
      {
        ...reset.slideset.layouts[0].placeholders[0],
        position: { x: 70, y: 75 },
      },
      reset.slideset.layouts[0].placeholders[1],
    ]);
    expect(changedLayout.slideset.slides[0].contents.text[0].position).toEqual({
      x: 70,
      y: 75,
    });
  });
});

function makePresentation(layouts, slides = []) {
  return { slideset: { layouts, slides } };
}

describe("addLayout", () => {
  test("adds a new layout to the front when no afterLayoutId", () => {
    const p = makePresentation([{ "layout-id": "existing", placeholders: [] }]);
    const updated = addLayout(p);
    expect(updated.slideset.layouts).toHaveLength(2);
    expect(updated.slideset.layouts[0]["layout-id"]).toMatch(/^custom-layout-/);
  });

  test("inserts after the specified layout id", () => {
    const p = makePresentation([
      { "layout-id": "a", placeholders: [] },
      { "layout-id": "b", placeholders: [] },
    ]);
    const updated = addLayout(p, "a");
    expect(updated.slideset.layouts[1]["layout-id"]).toMatch(/^custom-layout-/);
    expect(updated.slideset.layouts[2]["layout-id"]).toBe("b");
  });

  test("new layout has empty placeholders and elements", () => {
    const p = makePresentation([{ "layout-id": "x", placeholders: [] }]);
    const updated = addLayout(p);
    const newLayout = updated.slideset.layouts[0];
    expect(newLayout.placeholders).toEqual([]);
    expect(newLayout.elements).toEqual({ text: [], media: [] });
  });
});

describe("deleteLayout", () => {
  test("removes the layout", () => {
    const p = makePresentation([
      { "layout-id": "a", placeholders: [] },
      { "layout-id": "b", placeholders: [] },
    ]);
    const updated = deleteLayout(p, "a");
    expect(updated.slideset.layouts).toHaveLength(1);
    expect(updated.slideset.layouts[0]["layout-id"]).toBe("b");
  });

  test("does not delete the last remaining layout", () => {
    const p = makePresentation([{ "layout-id": "only", placeholders: [] }]);
    const updated = deleteLayout(p, "only");
    expect(updated.slideset.layouts).toHaveLength(1);
  });

  test("reassigns slides that used the deleted layout to the first remaining layout", () => {
    const p = makePresentation(
      [
        { "layout-id": "a", placeholders: [] },
        { "layout-id": "b", placeholders: [] },
      ],
      [{ "layout-id": "a", contents: { text: [], media: [] } }],
    );
    const updated = deleteLayout(p, "a");
    expect(updated.slideset.slides[0]["layout-id"]).toBe("b");
  });
});

describe("renameLayout", () => {
  test("renames the target layout", () => {
    const p = makePresentation([{ "layout-id": "a", name: "Old", placeholders: [] }]);
    const updated = renameLayout(p, "a", "New Name");
    expect(updated.slideset.layouts[0].name).toBe("New Name");
  });

  test("does not rename other layouts", () => {
    const p = makePresentation([
      { "layout-id": "a", name: "A", placeholders: [] },
      { "layout-id": "b", name: "B", placeholders: [] },
    ]);
    const updated = renameLayout(p, "a", "A2");
    expect(updated.slideset.layouts[1].name).toBe("B");
  });
});

describe("addLayoutPlaceholder", () => {
  test("adds a placeholder to the layout", () => {
    const p = makePresentation([{ "layout-id": "a", placeholders: [] }]);
    const ph = { "placeholder-id": "title", type: "text", position: { x: 0, y: 0 }, width: 800, height: 80 };
    const updated = addLayoutPlaceholder(p, "a", ph);
    expect(updated.slideset.layouts[0].placeholders).toHaveLength(1);
    expect(updated.slideset.layouts[0].placeholders[0]["placeholder-id"]).toBe("title");
  });
});

describe("removeLayoutPlaceholder", () => {
  test("removes the specified placeholder", () => {
    const p = makePresentation([{
      "layout-id": "a",
      placeholders: [
        { "placeholder-id": "title", type: "text", position: { x: 0, y: 0 }, width: 800, height: 80 },
        { "placeholder-id": "body", type: "text", position: { x: 0, y: 100 }, width: 800, height: 400 },
      ],
    }]);
    const updated = removeLayoutPlaceholder(p, "a", "title");
    expect(updated.slideset.layouts[0].placeholders).toHaveLength(1);
    expect(updated.slideset.layouts[0].placeholders[0]["placeholder-id"]).toBe("body");
  });

  test("removes empty slide instances and detaches edited content", () => {
    const p = makePresentation(
      [{
        "layout-id": "a",
        placeholders: [
          { "placeholder-id": "title", type: "text", position: { x: 0, y: 0 }, width: 800, height: 80 },
          { "placeholder-id": "body", type: "text", position: { x: 0, y: 100 }, width: 800, height: 400 },
        ],
      }],
      [{
        "layout-id": "a",
        contents: {
          text: [
            { id: "title", "placeholder-id": "title", userModified: false, paragraphs: [] },
            { id: "body", "placeholder-id": "body", userModified: true, paragraphs: [{ runs: [{ text: "Keep me" }] }] },
          ],
          media: [],
        },
      }],
    );

    const withoutTitle = removeLayoutPlaceholder(p, "a", "title");
    expect(withoutTitle.slideset.slides[0].contents.text.map((el) => el.id)).toEqual(["body"]);

    const withoutBody = removeLayoutPlaceholder(withoutTitle, "a", "body");
    const body = withoutBody.slideset.slides[0].contents.text[0];
    expect(body.paragraphs[0].runs[0].text).toBe("Keep me");
    expect(body["placeholder-id"]).toBeUndefined();
  });
});

describe("addLayoutElement", () => {
  test("adds a text element to layout elements", () => {
    const p = makePresentation([{ "layout-id": "a", placeholders: [], elements: { text: [], media: [] } }]);
    const el = { id: "el-1", paragraphs: [] };
    const updated = addLayoutElement(p, "a", "text", el);
    expect(updated.slideset.layouts[0].elements.text).toHaveLength(1);
    expect(updated.slideset.layouts[0].elements.text[0].id).toBe("el-1");
  });
});

describe("deleteLayoutElement", () => {
  test("removes element from layout by id", () => {
    const p = makePresentation([{
      "layout-id": "a",
      placeholders: [],
      elements: { text: [{ id: "el-1" }, { id: "el-2" }], media: [] },
    }]);
    const updated = deleteLayoutElement(p, "a", "text", "el-1");
    expect(updated.slideset.layouts[0].elements.text).toHaveLength(1);
    expect(updated.slideset.layouts[0].elements.text[0].id).toBe("el-2");
  });
});

describe("updateLayoutElement", () => {
  test("merges updates into the target element", () => {
    const p = makePresentation([{
      "layout-id": "a",
      placeholders: [],
      elements: { text: [{ id: "el-1", width: 100 }], media: [] },
    }]);
    const updated = updateLayoutElement(p, "a", "text", "el-1", { width: 500 });
    expect(updated.slideset.layouts[0].elements.text[0].width).toBe(500);
  });

  test("does not affect other elements", () => {
    const p = makePresentation([{
      "layout-id": "a",
      placeholders: [],
      elements: { text: [{ id: "el-1", width: 100 }, { id: "el-2", width: 200 }], media: [] },
    }]);
    const updated = updateLayoutElement(p, "a", "text", "el-1", { width: 500 });
    expect(updated.slideset.layouts[0].elements.text[1].width).toBe(200);
  });
});

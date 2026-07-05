import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import { createLayoutPlaceholder } from "../../model/defaultLayouts";

describe("layout placeholders and elements through the reducer", () => {
  const layouts = (state) => state.presentation.slideset.layouts;
  const layout = (state, id) => layouts(state).find((l) => l["layout-id"] === id);
  const slide = (state) =>
    state.presentation.slideset.slides[state.selectedSlideIndex];

  test("ADD_PLACEHOLDER extends the layout and immediately materializes on slides using it", () => {
    let state = createInitialEditorState();

    const placeholder = createLayoutPlaceholder({
      placeholderId: "extra-note-placeholder",
      x: 80,
      y: 560,
      width: 500,
      height: 100,
      promptText: "Click to add side note",
    });

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.ADD_PLACEHOLDER, {
        layoutId: "title-content",
        placeholder,
      }),
    );

    expect(
      layout(state, "title-content").placeholders.some(
        (p) => p["placeholder-id"] === "extra-note-placeholder",
      ),
    ).toBe(true);

    const materialized = slide(state).contents.text.find(
      (el) => el["placeholder-id"] === "extra-note-placeholder",
    );
    expect(materialized).toBeDefined();
    expect(materialized.position).toEqual({ x: 80, y: 560 });
    expect(materialized.paragraphs[0].runs[0].text).toBe(
      "Click to add side note",
    );
  });

  test("DELETE_PLACEHOLDER removes it from the layout and is undoable", () => {
    let state = createInitialEditorState();
    const countBefore = layout(state, "title-content").placeholders.length;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.DELETE_PLACEHOLDER, {
        layoutId: "title-content",
        placeholderId: "title-placeholder",
      }),
    );
    expect(layout(state, "title-content").placeholders).toHaveLength(
      countBefore - 1,
    );

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(layout(state, "title-content").placeholders).toHaveLength(countBefore);
  });

  test("UPDATE_ITEM moves a layout placeholder and the slide element follows", () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.UPDATE_ITEM, {
        layoutId: "title-content",
        itemId: "title-placeholder",
        updates: { position: { x: 33, y: 44 } },
      }),
    );

    expect(
      layout(state, "title-content").placeholders.find(
        (p) => p["placeholder-id"] === "title-placeholder",
      ).position,
    ).toEqual({ x: 33, y: 44 });
    expect(
      slide(state).contents.text.find(
        (el) => el["placeholder-id"] === "title-placeholder",
      ).position,
    ).toEqual({ x: 33, y: 44 });
  });

  test("UPDATE_FONT stamps the font onto every placeholder of the layout", () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.UPDATE_FONT, {
        layoutId: "title-content",
        font: "Trebuchet MS",
      }),
    );

    for (const p of layout(state, "title-content").placeholders) {
      expect(p.formatting.font).toBe("Trebuchet MS");
    }
    expect(
      layout(state, "title-slide").placeholders.every(
        (p) => p.formatting?.font !== "Trebuchet MS",
      ),
    ).toBe(true);
  });

  test("ADD_ELEMENT, UPDATE_TEXT_FORMATTING, and DELETE_ELEMENT manage decorative layout elements", () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.ADD_ELEMENT, {
        layoutId: "title-content",
        elementType: "text",
        element: {
          id: "layout-caption",
          position: { x: 20, y: 680 },
          width: 300,
          height: 30,
          paragraphs: [
            {
              id: "lc-p",
              formatting: {},
              runs: [{ formatting: {}, text: "Layout caption" }],
            },
          ],
        },
      }),
    );
    expect(
      layout(state, "title-content").elements.text.some(
        (el) => el.id === "layout-caption",
      ),
    ).toBe(true);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.UPDATE_TEXT_FORMATTING, {
        layoutId: "title-content",
        elementId: "layout-caption",
        formattingUpdate: { weight: "bold" },
      }),
    );
    expect(
      layout(state, "title-content").elements.text.find(
        (el) => el.id === "layout-caption",
      ).paragraphs[0].formatting.weight,
    ).toBe("bold");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.DELETE_ELEMENT, {
        layoutId: "title-content",
        elementType: "text",
        elementId: "layout-caption",
      }),
    );
    expect(
      layout(state, "title-content").elements.text.some(
        (el) => el.id === "layout-caption",
      ),
    ).toBe(false);
  });
});
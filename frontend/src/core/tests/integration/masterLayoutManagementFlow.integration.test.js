import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const { records, storageAdapter } = vi.hoisted(() => {
  const records = new Map();
  return {
    records,
    storageAdapter: {
      get: vi.fn(async (key) => (records.has(key) ? records.get(key) : null)),
      set: vi.fn(async (key, value) => records.set(key, value)),
      remove: vi.fn(async (key) => records.delete(key)),
      getAllKeys: vi.fn(async () => [...records.keys()]),
      getAllPresentationIds: vi.fn(async () => []),
    },
  };
});

vi.mock("../../persistence/storage/storageAdapter", () => ({ storageAdapter }));

import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import { exportToReveal } from "../../export/exportToReveal";

describe("master and layout management through the reducer", () => {
  let capturedBlob;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
    capturedBlob = null;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return "blob:mock-export-url";
    });
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });

  const layouts = (state) => state.presentation.slideset.layouts;
  const slide = (state) =>
    state.presentation.slideset.slides[state.selectedSlideIndex];

  test("LAYOUT.ADD, RENAME, and DELETE manage the layout list; slides on a deleted layout are reassigned", () => {
    let state = createInitialEditorState();
    const countBefore = layouts(state).length;

    state = editorReducer(state, createEditorEvent(EditorEventType.LAYOUT.ADD, {}));
    expect(layouts(state)).toHaveLength(countBefore + 1);
    const newLayout = layouts(state).find(
      (l) => !["title-slide", "title-content", "section-header", "two-content", "comparison", "title-only", "blank", "content-caption", "picture-caption"].includes(l["layout-id"]),
    ) ?? layouts(state).at(-1);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.RENAME, {
        layoutId: newLayout["layout-id"],
        name: "My Custom Layout",
      }),
    );
    expect(
      layouts(state).find((l) => l["layout-id"] === newLayout["layout-id"]).name,
    ).toBe("My Custom Layout");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.APPLY, {
        layoutId: newLayout["layout-id"],
      }),
    );
    expect(slide(state)["layout-id"]).toBe(newLayout["layout-id"]);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.DELETE, {
        layoutId: newLayout["layout-id"],
      }),
    );
    expect(layouts(state)).toHaveLength(countBefore);
    expect(slide(state)["layout-id"]).toBe(layouts(state)[0]["layout-id"]);
  });

  test("LAYOUT.UPDATE_PLACEHOLDERS propagates geometry changes to slides using the layout", () => {
    let state = createInitialEditorState();
    const layout = layouts(state).find((l) => l["layout-id"] === "title-content");
    const movedPlaceholders = layout.placeholders.map((p) =>
      p["placeholder-id"] === "title-placeholder"
        ? { ...p, position: { x: 40, y: 300 }, width: 600, height: 90 }
        : p,
    );

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.UPDATE_PLACEHOLDERS, {
        layoutId: "title-content",
        placeholders: movedPlaceholders,
      }),
    );

    const titleEl = slide(state).contents.text.find(
      (el) => el["placeholder-id"] === "title-placeholder",
    );
    expect(titleEl.position).toEqual({ x: 40, y: 300 });
    expect(titleEl.width).toBe(600);
    expect(titleEl.height).toBe(90);
  });

  test("LAYOUT.RESET restores placeholder geometry and strips formatting but keeps text", () => {
    let state = createInitialEditorState();
    const originalTitle = slide(state).contents.text.find(
      (el) => el["placeholder-id"] === "title-placeholder",
    );
    const originalPosition = { ...originalTitle.position };

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.UPDATE, {
        elementId: originalTitle.id,
        updates: { position: { x: 5, y: 5 } },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
        textElementId: originalTitle.id,
        formatting: { weight: "bold" },
      }),
    );

    state = editorReducer(state, createEditorEvent(EditorEventType.LAYOUT.RESET, {}));

    const resetTitle = slide(state).contents.text.find(
      (el) => el.id === originalTitle.id,
    );
    expect(resetTitle.position).toEqual(originalPosition);
    expect(resetTitle.paragraphs[0].formatting).toEqual({});
    expect(resetTitle.paragraphs[0].runs[0].text).toBe("My First Slide");
  });

  test("MASTER.TOGGLE_TITLE adds the master title element and toggling removes it", () => {
    let state = createInitialEditorState();
    const masterText = () =>
      state.presentation.slideset.master.elements.text;
    const countBefore = masterText().length;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.TOGGLE_TITLE, {}),
    );
    expect(masterText().length).toBe(countBefore + 1);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.TOGGLE_TITLE, {}),
    );
    expect(masterText().length).toBe(countBefore);
  });

  test("MASTER.UPDATE_ITEM moves a master element", () => {
    let state = createInitialEditorState();
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.ADD_ELEMENT, {
        elementType: "text",
        element: {
          id: "master-movable",
          position: { x: 0, y: 0 },
          width: 100,
          height: 30,
          paragraphs: [
            { id: "mm-p", formatting: {}, runs: [{ formatting: {}, text: "Stamp" }] },
          ],
        },
      }),
    );

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.UPDATE_ITEM, {
        elementId: "master-movable",
        updates: { position: { x: 500, y: 600 } },
      }),
    );

    expect(
      state.presentation.slideset.master.elements.text.find(
        (el) => el.id === "master-movable",
      ).position,
    ).toEqual({ x: 500, y: 600 });
  });

  test("FONT.DELETE scrubs references to the removed font back to Arial and drops it from export", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.FONT.ADD, {
      fontEntry: { "font-id": "Fancy Custom", "font-file": "" },
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "fancy-text",
        position: { x: 10, y: 10 },
        width: 300,
        height: 60,
        "z-index": 1,
        paragraphs: [
          {
            id: "ft-p",
            formatting: { font: "Fancy Custom" },
            runs: [{ formatting: {}, text: "Fancy styled" }],
          },
        ],
      },
    }));

    state = editorReducer(state, createEditorEvent(EditorEventType.FONT.DELETE, {
      fontId: "Fancy Custom",
    }));

    const el = state.presentation.slideset.slides[0].contents.text.find(
      (item) => item.id === "fancy-text",
    );
    expect(el.paragraphs[0].formatting.font).toBe("Arial");
    expect(
      state.presentation.slideset.fonts.some((f) => f["font-id"] === "Fancy Custom"),
    ).toBe(false);

    await exportToReveal(state.presentation);
    const html = await capturedBlob.text();
    expect(html).not.toContain("Fancy Custom");
  });

  test("PRESENTATION.RENAME retitles the deck and PRESENTATION.CREATE resets to a fresh one", () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.PRESENTATION.RENAME, {
        title: "Quarterly Business Review",
      }),
    );
    expect(state.presentation.slideset.title).toBe("Quarterly Business Review");

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(state.presentation.slideset.title).toBe("Untitled Presentation");

    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.PRESENTATION.CREATE, {}),
    );
    expect(state.presentation.slideset.slides).toHaveLength(1);
    expect(state.past).toEqual([]);
    expect(state.presentation.slideset.title).toBe("Untitled Presentation");
  });
});
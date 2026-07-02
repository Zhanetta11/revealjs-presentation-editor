import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../store/editorStore";
import { EditorEventType } from "../events/editorEvents";

describe("editorReducer", () => {
  test("MEDIA.ADD adds media to selected slide", () => {
    const state = createInitialEditorState();
    const initialMediaCount =
        state.presentation.slideset.slides[0].contents.media.length;

    const result = editorReducer(state, {
        type: EditorEventType.MEDIA.ADD,
        payload: {
        mediaElement: {
            id: "media-1",
            "file-link": "image.png",
            "media-type": "image",
        },
        },
    });

    expect(
        result.presentation.slideset.slides[0].contents.media
    ).toHaveLength(initialMediaCount + 1);

    expect(
        result.presentation.slideset.slides[0].contents.media.some(
        (media) => media.id === "media-1"
        )
    ).toBe(true);

    expect(result.selectedElementId).toBe("media-1");
    });

  test("ELEMENT.SELECT supports multiple and toggle selection", () => {
    const state = createInitialEditorState();
    const selected = editorReducer(state, {
      type: EditorEventType.ELEMENT.SELECT,
      payload: { elementIds: ["text-1", "media-1"] },
    });

    expect(selected.selectedElementIds).toEqual(["text-1", "media-1"]);
    expect(selected.selectedElementId).toBe("media-1");

    const toggled = editorReducer(selected, {
      type: EditorEventType.ELEMENT.SELECT,
      payload: { elementId: "text-1", toggle: true },
    });

    expect(toggled.selectedElementIds).toEqual(["media-1"]);
    expect(toggled.selectedElementId).toBe("media-1");
  });

  test("ELEMENT.COPY and ELEMENT.PASTE handle multiple elements", () => {
    const state = createInitialEditorState();
    const elements = [
      {
        id: "copy-text",
        position: { x: 10, y: 20 },
        paragraphs: [],
      },
      {
        id: "copy-media",
        position: { x: 30, y: 40 },
        "media-type": "image",
      },
    ];

    const copied = editorReducer(state, {
      type: EditorEventType.ELEMENT.COPY,
      payload: { elements },
    });
    const pasted = editorReducer(copied, {
      type: EditorEventType.ELEMENT.PASTE,
      payload: {},
    });

    expect(pasted.selectedElementIds).toHaveLength(2);
    expect(
      pasted.presentation.slideset.slides[0].contents.text.some(
        (element) => element.id === pasted.selectedElementIds[0],
      ),
    ).toBe(true);
    expect(
      pasted.presentation.slideset.slides[0].contents.media.some(
        (element) => element.id === pasted.selectedElementIds[1],
      ),
    ).toBe(true);
  });

  test("ELEMENT.DELETE_SELECTION removes text and media atomically", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: EditorEventType.MEDIA.ADD,
      payload: {
        mediaElement: {
          id: "delete-media",
          "media-type": "image",
        },
      },
    });
    const textId =
      state.presentation.slideset.slides[0].contents.text[0].id;

    const result = editorReducer(state, {
      type: EditorEventType.ELEMENT.DELETE_SELECTION,
      payload: { elementIds: [textId, "delete-media"] },
    });

    expect(
      result.presentation.slideset.slides[0].contents.text.some(
        (element) => element.id === textId,
      ),
    ).toBe(false);
    expect(
      result.presentation.slideset.slides[0].contents.media.some(
        (element) => element.id === "delete-media",
      ),
    ).toBe(false);
    expect(result.selectedElementIds).toEqual([]);
  });

  test("HISTORY.UNDO restores previous presentation state", () => {
    const state = createInitialEditorState();
    const afterAdd = editorReducer(state, {
      type: EditorEventType.MEDIA.ADD,
      payload: { mediaElement: { id: "undo-media", "media-type": "image" } },
    });
    expect(afterAdd.past.length).toBe(1);

    const afterUndo = editorReducer(afterAdd, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });

    expect(afterUndo.past.length).toBe(0);
    expect(
      afterUndo.presentation.slideset.slides[0].contents.media.some(
        (m) => m.id === "undo-media",
      ),
    ).toBe(false);
  });

  test("HISTORY.REDO re-applies undone state", () => {
    const state = createInitialEditorState();
    const afterAdd = editorReducer(state, {
      type: EditorEventType.MEDIA.ADD,
      payload: { mediaElement: { id: "redo-media", "media-type": "image" } },
    });
    const afterUndo = editorReducer(afterAdd, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });
    expect(afterUndo.future.length).toBe(1);

    const afterRedo = editorReducer(afterUndo, {
      type: EditorEventType.HISTORY.REDO,
      payload: {},
    });

    expect(afterRedo.future.length).toBe(0);
    expect(
      afterRedo.presentation.slideset.slides[0].contents.media.some(
        (m) => m.id === "redo-media",
      ),
    ).toBe(true);
  });

  test("ELEMENT.UPDATE_MANY updates visibility in one history entry", () => {
    const state = createInitialEditorState();
    const textIds = state.presentation.slideset.slides[0].contents.text.map(
      (element) => element.id,
    );
    const result = editorReducer(state, {
      type: EditorEventType.ELEMENT.UPDATE_MANY,
      payload: {
        updates: textIds.map((elementId) => ({
          elementId,
          updates: { hidden: true },
        })),
      },
    });

    expect(
      result.presentation.slideset.slides[0].contents.text.every(
        (element) => element.hidden,
      ),
    ).toBe(true);
    expect(result.past).toHaveLength(1);
  });

  test("groups media replacement into one atomic history transaction", () => {
    let state = createInitialEditorState();
    const textId = state.presentation.slideset.slides[0].contents.text[0].id;

    state = editorReducer(state, {
      type: EditorEventType.HISTORY.BEGIN,
      payload: {},
    });
    state = editorReducer(state, {
      type: EditorEventType.MEDIA.ADD,
      payload: {
        mediaElement: { id: "picture-paste", "media-type": "image" },
      },
    });
    state = editorReducer(state, {
      type: EditorEventType.ELEMENT.UPDATE,
      payload: { elementId: textId, updates: { hidden: true } },
    });
    state = editorReducer(state, {
      type: EditorEventType.HISTORY.COMMIT,
      payload: {},
    });
    state = editorReducer(state, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });

    const slide = state.presentation.slideset.slides[0];
    expect(
      slide.contents.media.some((media) => media.id === "picture-paste"),
    ).toBe(false);
    expect(
      slide.contents.text.find((element) => element.id === textId)?.hidden,
    ).not.toBe(true);
  });

  test("MASTER.UPDATE_THEME_COLOR updates a single theme color inside the reducer", () => {
    const state = createInitialEditorState();
    const previousTheme = state.presentation.slideset.master["color-theme"];
    const colorVariable = previousTheme[0]["css-variable-name"];

    const result = editorReducer(state, {
      type: EditorEventType.MASTER.UPDATE_THEME_COLOR,
      payload: { colorVariable, hexColor: "#123456" },
    });

    const updatedEntry = result.presentation.slideset.master["color-theme"].find(
      (entry) => entry["css-variable-name"] === colorVariable,
    );
    expect(updatedEntry.color.startsWith("#123456")).toBe(true);
    expect(previousTheme[0].color).not.toBe(updatedEntry.color);
    expect(result.past).toHaveLength(1);

    const undone = editorReducer(result, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });
    expect(
      undone.presentation.slideset.master["color-theme"][0].color,
    ).toBe(previousTheme[0].color);
  });

  test("MASTER.UPDATE_THEME stores theme metadata without mutating prior state", () => {
    const state = createInitialEditorState();
    const previousMaster = state.presentation.slideset.master;
    const colorTheme = previousMaster["color-theme"];

    const result = editorReducer(state, {
      type: EditorEventType.MASTER.UPDATE_THEME,
      payload: {
        colorTheme,
        decorations: previousMaster.decorations,
        metadata: {
          colorSchemeId: "scheme-test",
          designId: "design-test",
        },
      },
    });

    expect(
      result.presentation.slideset.master["current-color-scheme-id"],
    ).toBe("scheme-test");
    expect(
      result.presentation.slideset.master["last-applied-design-id"],
    ).toBe("design-test");
    expect(previousMaster["current-color-scheme-id"]).not.toBe("scheme-test");
    expect(previousMaster["last-applied-design-id"]).not.toBe("design-test");
    expect(result.past).toHaveLength(1);

    const undone = editorReducer(result, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });
    expect(
      undone.presentation.slideset.master["current-color-scheme-id"],
    ).toBe(previousMaster["current-color-scheme-id"]);

    const redone = editorReducer(undone, {
      type: EditorEventType.HISTORY.REDO,
      payload: {},
    });
    expect(
      redone.presentation.slideset.master["current-color-scheme-id"],
    ).toBe("scheme-test");
  });

  test("groups master z-order updates into one undo entry", () => {
    const initial = createInitialEditorState();
    const state = {
      ...initial,
      presentation: {
        ...initial.presentation,
        slideset: {
          ...initial.presentation.slideset,
          master: {
            ...initial.presentation.slideset.master,
            elements: {
              ...initial.presentation.slideset.master.elements,
              text: [
                { id: "master-a", "z-index": 1 },
                { id: "master-b", "z-index": 2 },
              ],
            },
          },
        },
      },
    };

    const begun = editorReducer(state, {
      type: EditorEventType.HISTORY.BEGIN,
      payload: {},
    });
    const firstUpdate = editorReducer(begun, {
      type: EditorEventType.MASTER.UPDATE_ITEM,
      payload: {
        elementId: "master-a",
        updates: { "z-index": 2 },
      },
    });
    const secondUpdate = editorReducer(firstUpdate, {
      type: EditorEventType.MASTER.UPDATE_ITEM,
      payload: {
        elementId: "master-b",
        updates: { "z-index": 1 },
      },
    });
    const committed = editorReducer(secondUpdate, {
      type: EditorEventType.HISTORY.COMMIT,
      payload: {},
    });

    expect(committed.past).toHaveLength(1);
    expect(
      committed.presentation.slideset.master.elements.text.map(
        (item) => item["z-index"],
      ),
    ).toEqual([2, 1]);

    const undone = editorReducer(committed, {
      type: EditorEventType.HISTORY.UNDO,
      payload: {},
    });
    expect(
      undone.presentation.slideset.master.elements.text.map(
        (item) => item["z-index"],
      ),
    ).toEqual([1, 2]);
  });

  test("does not create an undo entry for an unchanged transaction", () => {
    const initial = createInitialEditorState();
    const begun = editorReducer(initial, {
      type: EditorEventType.HISTORY.BEGIN,
      payload: {},
    });
    const committed = editorReducer(begun, {
      type: EditorEventType.HISTORY.COMMIT,
      payload: {},
    });

    expect(committed.past).toHaveLength(0);
    expect(committed.pendingSnapshot).toBeNull();
    expect(committed.historyTransactionDirty).toBe(false);
  });
});

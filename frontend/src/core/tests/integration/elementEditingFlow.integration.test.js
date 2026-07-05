import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";

describe("element editing through the reducer", () => {
  function stateWithTextAndMedia() {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "edit-text",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        paragraphs: [
          { id: "et-p", formatting: {}, runs: [{ formatting: {}, text: "Original" }] },
        ],
      },
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.MEDIA.ADD, {
      mediaElement: {
        id: "edit-media",
        "file-link": "photo.png",
        "media-type": "image",
        position: { x: 300, y: 10 },
        width: 200,
        height: 150,
      },
    }));
    return state;
  }

  const slide = (state) =>
    state.presentation.slideset.slides[state.selectedSlideIndex];
  const textEl = (state, id) => slide(state).contents.text.find((el) => el.id === id);
  const mediaEl = (state, id) => slide(state).contents.media.find((el) => el.id === id);

  test("TEXT.UPDATE_CONTENT replaces the text, mapping lines to paragraphs", () => {
    let state = stateWithTextAndMedia();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_CONTENT, {
        textElementId: "edit-text",
        text: "First line\nSecond line",
        userModified: true,
      }),
    );

    const el = textEl(state, "edit-text");
    expect(el.paragraphs).toHaveLength(2);
    expect(el.paragraphs[0].runs[0].text).toBe("First line");
    expect(el.paragraphs[1].runs[0].text).toBe("Second line");
    expect(el.userModified).toBe(true);
  });

  test("TEXT.DELETE removes the element and clears selection", () => {
    let state = stateWithTextAndMedia();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.DELETE, { elementId: "edit-text" }),
    );

    expect(textEl(state, "edit-text")).toBeUndefined();
    expect(state.selectedElementId).toBeNull();

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(textEl(state, "edit-text")).toBeDefined();
  });

  test("ELEMENT.UPDATE moves an element with history, ELEMENT.UPDATE_SILENT without", () => {
    let state = stateWithTextAndMedia();
    const historyBefore = state.past.length;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.UPDATE, {
        elementId: "edit-text",
        updates: { position: { x: 99, y: 88 } },
      }),
    );
    expect(textEl(state, "edit-text").position).toEqual({ x: 99, y: 88 });
    expect(state.past.length).toBe(historyBefore + 1);

    const historyAfterUpdate = state.past.length;
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.UPDATE_SILENT, {
        elementId: "edit-text",
        updates: { position: { x: 100, y: 90 } },
      }),
    );
    expect(textEl(state, "edit-text").position).toEqual({ x: 100, y: 90 });
    expect(state.past.length).toBe(historyAfterUpdate);
  });

  test("ELEMENT.RESIZE updates element dimensions", () => {
    let state = stateWithTextAndMedia();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.RESIZE, {
        elementId: "edit-media",
        size: { width: 320, height: 240 },
      }),
    );

    expect(mediaEl(state, "edit-media").width).toBe(320);
    expect(mediaEl(state, "edit-media").height).toBe(240);
  });

  test("MEDIA.UPDATE edits media properties and MEDIA.DELETE removes the element", () => {
    let state = stateWithTextAndMedia();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MEDIA.UPDATE, {
        mediaId: "edit-media",
        updates: { alt: "Team photo", width: 250 },
      }),
    );
    expect(mediaEl(state, "edit-media").alt).toBe("Team photo");
    expect(mediaEl(state, "edit-media").width).toBe(250);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MEDIA.DELETE, { mediaId: "edit-media" }),
    );
    expect(mediaEl(state, "edit-media")).toBeUndefined();
    expect(state.selectedElementId).toBeNull();

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(mediaEl(state, "edit-media")).toBeDefined();
  });

  test("comments are added to and deleted from the selected slide only", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.COMMENT.ADD, {
        text: "Please double-check this figure",
        author: "Reviewer",
      }),
    );

    const slides = state.presentation.slideset.slides;
    expect(slides[1].contents.comments).toHaveLength(1);
    expect(slides[1].contents.comments[0].text).toBe(
      "Please double-check this figure",
    );
    expect(slides[1].contents.comments[0].author).toBe("Reviewer");
    expect(slides[0].contents.comments).toHaveLength(0);

    const commentId = slides[1].contents.comments[0].id;
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.COMMENT.DELETE, { commentId }),
    );
    expect(
      state.presentation.slideset.slides[1].contents.comments,
    ).toHaveLength(0);
  });

  test("HISTORY.CANCEL aborts an in-flight transaction and restores the snapshot", () => {
    let state = stateWithTextAndMedia();

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.BEGIN, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_CONTENT, {
        textElementId: "edit-text",
        text: "Half-typed garbage",
        userModified: true,
        grouped: true,
      }),
    );
    expect(textEl(state, "edit-text").paragraphs[0].runs[0].text).toBe(
      "Half-typed garbage",
    );

    const historyBefore = state.past.length;
    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.CANCEL, {}));

    expect(textEl(state, "edit-text").paragraphs[0].runs[0].text).toBe("Original");
    expect(state.past.length).toBe(historyBefore);
    expect(state.pendingSnapshot).toBeNull();
  });
});
import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";

describe("format painter copy/paste across elements", () => {
  function stateWithTwoTextElements() {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "painter-source",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        paragraphs: [
          {
            id: "p-src",
            formatting: { weight: "bold", color: "#FF0000FF", size: "32px" },
            runs: [{ text: "Styled source" }],
          },
        ],
      },
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "painter-target",
        position: { x: 10, y: 100 },
        width: 200,
        height: 60,
        paragraphs: [
          { id: "p-tgt", formatting: {}, runs: [{ text: "Plain target" }] },
        ],
      },
    }));
    return state;
  }

  const findElement = (state, id) =>
    state.presentation.slideset.slides[0].contents.text.find(
      (el) => el.id === id,
    );

  test("copy stores the source formatting, paste applies it to the target and clears the clipboard", () => {
    let state = stateWithTwoTextElements();
    const sourceFormatting = findElement(state, "painter-source").paragraphs[0]
      .formatting;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.COPY, {
        elementId: "painter-source",
        formatting: sourceFormatting,
      }),
    );
    expect(state.formatPainterClipboard).toEqual({
      formatting: sourceFormatting,
      sourceElementId: "painter-source",
    });

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
        textElementId: "painter-target",
        formatting: { ...state.formatPainterClipboard.formatting },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.PASTE, {}),
    );

    const targetFormatting = findElement(state, "painter-target").paragraphs[0]
      .formatting;
    expect(targetFormatting.weight).toBe("bold");
    expect(targetFormatting.color).toBe("#FF0000FF");
    expect(targetFormatting.size).toBe("32px");
    expect(state.formatPainterClipboard).toBeNull();

    expect(findElement(state, "painter-source").paragraphs[0].formatting).toEqual(
      sourceFormatting,
    );
  });

  test("pasting formatting is undoable without restoring the clipboard", () => {
    let state = stateWithTwoTextElements();
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.COPY, {
        elementId: "painter-source",
        formatting: { weight: "bold" },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
        textElementId: "painter-target",
        formatting: { weight: "bold" },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.PASTE, {}),
    );

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));

    expect(
      findElement(state, "painter-target").paragraphs[0].formatting.weight,
    ).toBeUndefined();
    expect(state.formatPainterClipboard).toBeNull();
  });

  test("a second copy overwrites the previous clipboard", () => {
    let state = stateWithTwoTextElements();
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.COPY, {
        elementId: "painter-source",
        formatting: { weight: "bold" },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.FORMAT_PAINTER.COPY, {
        elementId: "painter-target",
        formatting: { italics: true },
      }),
    );

    expect(state.formatPainterClipboard).toEqual({
      formatting: { italics: true },
      sourceElementId: "painter-target",
    });
  });
});
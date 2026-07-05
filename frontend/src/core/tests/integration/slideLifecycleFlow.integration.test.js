import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import {
  serializePresentation,
  deserializePresentation,
} from "../../persistence/serializationOperations";
import { validateSlideset } from "../../operations/slidesetValidation";

describe("slide duplicate / reorder / delete through the reducer", () => {
  const slides = (state) => state.presentation.slideset.slides;

  test("SLIDE.DUPLICATE deep-copies the slide with fresh element and paragraph ids", () => {
    let state = createInitialEditorState();
    const source = slides(state)[0];
    const sourceElementIds = source.contents.text.map((el) => el.id);
    const sourceParagraphIds = source.contents.text.flatMap((el) =>
      (el.paragraphs ?? []).map((p) => p.id),
    );

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.DUPLICATE, {}),
    );

    expect(slides(state)).toHaveLength(2);
    expect(state.selectedSlideIndex).toBe(1);

    const copy = slides(state)[1];
    expect(
      copy.contents.text.map((el) => el.paragraphs[0].runs[0].text),
    ).toEqual(
      source.contents.text.map((el) => el.paragraphs[0].runs[0].text),
    );
    for (const el of copy.contents.text) {
      expect(sourceElementIds).not.toContain(el.id);
      for (const p of el.paragraphs ?? []) {
        expect(sourceParagraphIds).not.toContain(p.id);
      }
    }

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
        textElementId: copy.contents.text[0].id,
        formatting: { weight: "bold" },
      }),
    );
    expect(
      slides(state)[0].contents.text[0].paragraphs[0].formatting.weight,
    ).toBeUndefined();

    const { data, errors } = deserializePresentation(
      serializePresentation(state.presentation),
    );
    expect(errors).toEqual([]);
    expect(validateSlideset(data)).toEqual([]);
  });

  test("SLIDE.REORDER moves the slide and follows it with the selection", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));

    const idOfFirst = slides(state)[0].contents.text[0].id;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.REORDER, {
        fromIndex: 0,
        toIndex: 2,
      }),
    );

    expect(slides(state)[2].contents.text[0].id).toBe(idOfFirst);
    expect(state.selectedSlideIndex).toBe(2);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(slides(state)[0].contents.text[0].id).toBe(idOfFirst);
  });

  test("SLIDE.DELETE removes the selected slide but never the last one", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    expect(slides(state)).toHaveLength(2);
    expect(state.selectedSlideIndex).toBe(1);

    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.DELETE, {}));
    expect(slides(state)).toHaveLength(1);
    expect(state.selectedSlideIndex).toBe(0);

    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.DELETE, {}));
    expect(slides(state)).toHaveLength(1);
  });
});
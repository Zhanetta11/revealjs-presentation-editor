import { describe, test, expect } from "vitest";
import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import {
  serializePresentation,
  deserializePresentation,
} from "../../persistence/serialization/serializationOperations";
import { validateSlideset } from "../../operations/slidesetValidation";

describe("apply layout through the reducer", () => {
  const slide = (state) => state.presentation.slideset.slides[state.selectedSlideIndex];

  const slideTexts = (state) =>
    slide(state).contents.text.flatMap((el) =>
      (el.paragraphs ?? []).flatMap((p) => (p.runs ?? []).map((r) => r.text)),
    );

  test("LAYOUT.APPLY swaps the slide layout, keeps content, and materializes new placeholders", () => {
    let state = createInitialEditorState();
    expect(slide(state)["layout-id"]).toBe("title-content");
    expect(slideTexts(state)).toContain("My First Slide");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.APPLY, {
        layoutId: "two-content",
      }),
    );

    expect(slide(state)["layout-id"]).toBe("two-content");
    expect(slideTexts(state)).toContain("My First Slide");

    const layout = state.presentation.slideset.layouts.find(
      (l) => l["layout-id"] === "two-content",
    );
    const slideElements = [
      ...slide(state).contents.text,
      ...slide(state).contents.media,
    ];
    for (const placeholder of layout.placeholders) {
      expect(
        slideElements.some(
          (el) => el["placeholder-id"] === placeholder["placeholder-id"],
        ),
      ).toBe(true);
    }

    const { data, errors } = deserializePresentation(
      serializePresentation(state.presentation),
    );
    expect(errors).toEqual([]);
    expect(validateSlideset(data)).toEqual([]);
  });

  test("applying a layout is undoable back to the previous layout and elements", () => {
    let state = createInitialEditorState();
    const elementIdsBefore = slide(state).contents.text.map((el) => el.id);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.APPLY, { layoutId: "blank" }),
    );
    expect(slide(state)["layout-id"]).toBe("blank");

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));

    expect(slide(state)["layout-id"]).toBe("title-content");
    expect(slide(state).contents.text.map((el) => el.id)).toEqual(
      elementIdsBefore,
    );
  });

  test("applying an unknown layout id leaves the presentation unchanged", () => {
    let state = createInitialEditorState();
    const before = state.presentation;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.LAYOUT.APPLY, {
        layoutId: "does-not-exist",
      }),
    );

    expect(slide(state)["layout-id"]).toBe("title-content");
    expect(state.presentation.slideset.slides).toEqual(
      before.slideset.slides,
    );
  });
});
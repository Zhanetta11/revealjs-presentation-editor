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

describe("editor session flow (integration)", () => {
  test("add slide -> add text -> format -> add media -> theme change composes correctly", () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.ADD, {}),
    );
    expect(state.presentation.slideset.slides).toHaveLength(2);
    expect(state.selectedSlideIndex).toBe(1);

    const textElement = {
      id: "session-text-1",
      position: { x: 10, y: 10 },
      width: 300,
      height: 80,
      paragraphs: [
        { id: "p-1", formatting: {}, runs: [{ text: "Session text" }] },
      ],
    };
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.ADD, { textElement }),
    );
    expect(
      state.presentation.slideset.slides[1].contents.text.some(
        (el) => el.id === "session-text-1",
      ),
    ).toBe(true);
    expect(state.selectedElementId).toBe("session-text-1");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
        textElementId: "session-text-1",
        formatting: { weight: "bold" },
      }),
    );
    const formattedParagraph =
      state.presentation.slideset.slides[1].contents.text
        .find((el) => el.id === "session-text-1")
        .paragraphs[0];
    expect(formattedParagraph.formatting.weight).toBe("bold");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MEDIA.ADD, {
        mediaElement: {
          id: "session-media-1",
          "file-link": "photo.png",
          "media-type": "image",
        },
      }),
    );
    expect(
      state.presentation.slideset.slides[1].contents.media.some(
        (el) => el.id === "session-media-1",
      ),
    ).toBe(true);

    const originalColorTheme =
      state.presentation.slideset.master["color-theme"];
    const newColorTheme = originalColorTheme.map((entry) =>
      entry["css-variable-name"] === "bg-light"
        ? { ...entry, color: "#000000FF" }
        : entry,
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.UPDATE_THEME, {
        colorTheme: newColorTheme,
      }),
    );
    expect(
      state.presentation.slideset.master["color-theme"].find(
        (entry) => entry["css-variable-name"] === "bg-light",
      ).color,
    ).toBe("#000000FF");

    expect(state.past).toHaveLength(5);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(
      state.presentation.slideset.master["color-theme"].find(
        (entry) => entry["css-variable-name"] === "bg-light",
      ).color,
    ).toBe(originalColorTheme.find((e) => e["css-variable-name"] === "bg-light").color);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    expect(
      state.presentation.slideset.slides[1].contents.media.some(
        (el) => el.id === "session-media-1",
      ),
    ).toBe(false);
    expect(state.future).toHaveLength(2);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.REDO, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.REDO, {}));
    expect(
      state.presentation.slideset.slides[1].contents.media.some(
        (el) => el.id === "session-media-1",
      ),
    ).toBe(true);
    expect(
      state.presentation.slideset.master["color-theme"].find(
        (entry) => entry["css-variable-name"] === "bg-light",
      ).color,
    ).toBe("#000000FF");
    expect(state.future).toHaveLength(0);

    const json = serializePresentation(state.presentation);
    const { data, errors } = deserializePresentation(json);
    expect(errors).toEqual([]);
    expect(validateSlideset(data)).toEqual([]);
    expect(data.slideset.slides).toHaveLength(2);
    expect(
      data.slideset.slides[1].contents.text.find(
        (el) => el.id === "session-text-1",
      ).paragraphs[0].formatting.weight,
    ).toBe("bold");
    expect(
      data.slideset.slides[1].contents.media.some(
        (el) => el.id === "session-media-1",
      ),
    ).toBe(true);
    expect(
      data.slideset.master["color-theme"].find(
        (entry) => entry["css-variable-name"] === "bg-light",
      ).color,
    ).toBe("#000000FF");
  });

  test("PRESENTATION.LOAD replaces state and clears history", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    expect(state.past.length).toBeGreaterThan(0);

    const freshPresentation = createInitialEditorState().presentation;
    const json = serializePresentation(freshPresentation);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.PRESENTATION.LOAD, { jsonString: json }),
    );

    expect(state.presentation.slideset.slides).toHaveLength(1);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selectedSlideIndex).toBe(0);
  });

  test("cut then paste round-trips an element back into the slide via clipboard", () => {
    let state = createInitialEditorState();
    const originalTextIds = state.presentation.slideset.slides[0].contents.text.map(
      (el) => el.id,
    );
    const elementToCut = state.presentation.slideset.slides[0].contents.text[0];

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.CUT, {
        elements: [elementToCut],
      }),
    );
    expect(state.presentation.slideset.slides[0].contents.text).toHaveLength(
      originalTextIds.length - 1,
    );
    expect(
      state.presentation.slideset.slides[0].contents.text.some(
        (el) => el.id === elementToCut.id,
      ),
    ).toBe(false);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ELEMENT.PASTE, {}),
    );
    expect(state.presentation.slideset.slides[0].contents.text).toHaveLength(
      originalTextIds.length,
    );
    const pasted = state.presentation.slideset.slides[0].contents.text.find(
      (el) => !originalTextIds.includes(el.id),
    );
    expect(pasted).toBeDefined();
    expect(pasted.position.x).toBe((elementToCut.position?.x ?? 0) + 20);
    expect(pasted.position.y).toBe((elementToCut.position?.y ?? 0) + 20);
  });
});

import { describe, test, expect } from "vitest";
import { findMatches, batchReplaceAll } from "../../text/findReplace";
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
import { addSlide } from "../../operations/slideOperations";
import { addTextElement } from "../../operations/textOperations";

describe("find-replace across slides through the reducer's history transaction", () => {
  function buildPresentationWithThreeSlides() {
    let state = createInitialEditorState();

    const withOriginalText = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "slide0-extra",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        paragraphs: [
          { id: "p0", formatting: {}, runs: [{ text: "foo appears here" }] },
        ],
      },
    }));

    let next = editorReducer(withOriginalText, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    next = {
      ...next,
      presentation: addTextElement(next.presentation, 1, {
        id: "slide1-text",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        paragraphs: [
          { id: "p1", formatting: {}, runs: [{ text: "another foo here" }] },
        ],
      }),
    };

    next = editorReducer(next, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    next = {
      ...next,
      presentation: addTextElement(next.presentation, 2, {
        id: "slide2-text",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        paragraphs: [
          { id: "p2", formatting: {}, runs: [{ text: "no match here" }] },
        ],
      }),
    };

    return next;
  }

  test("replace-all across 3 slides mutates every match in a single history entry", () => {
    let state = buildPresentationWithThreeSlides();
    const slides = state.presentation.slideset.slides;

    const matches = findMatches(slides, "foo");
    expect(matches.length).toBe(2);
    expect(matches.some((m) => m.slideIndex === 0)).toBe(true);
    expect(matches.some((m) => m.slideIndex === 1)).toBe(true);
    expect(matches.some((m) => m.slideIndex === 2)).toBe(false);

    const operations = batchReplaceAll(matches, slides, "bar");
    expect(operations).toHaveLength(2);

    const historyLengthBefore = state.past.length;

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.BEGIN));

    const byElement = new Map();
    operations.forEach((op) => {
      const key = `${op.slideIndex}:${op.elementId}`;
      if (!byElement.has(key)) byElement.set(key, []);
      byElement.get(key).push(op);
    });
    byElement.forEach((elementOps) => {
      const { slideIndex, elementId } = elementOps[0];
      const slide = state.presentation.slideset.slides[slideIndex];
      const element = slide.contents.text.find((el) => el.id === elementId);
      const paragraphs = structuredClone(element.paragraphs ?? []);
      elementOps.forEach(({ paragraphIdx, runIdx, newText }) => {
        paragraphs[paragraphIdx].runs[runIdx].text = newText;
      });
      state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.UPDATE_PARAGRAPHS, {
        slideIndex,
        elementId,
        paragraphs,
        grouped: true,
      }));
    });

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.COMMIT));

    expect(
      state.presentation.slideset.slides[0].contents.text.find(
        (el) => el.id === "slide0-extra",
      ).paragraphs[0].runs[0].text,
    ).toBe("bar appears here");
    expect(
      state.presentation.slideset.slides[1].contents.text.find(
        (el) => el.id === "slide1-text",
      ).paragraphs[0].runs[0].text,
    ).toBe("another bar here");
    expect(
      state.presentation.slideset.slides[2].contents.text.find(
        (el) => el.id === "slide2-text",
      ).paragraphs[0].runs[0].text,
    ).toBe("no match here");

    expect(state.past.length).toBe(historyLengthBefore + 1);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO));
    expect(
      state.presentation.slideset.slides[0].contents.text.find(
        (el) => el.id === "slide0-extra",
      ).paragraphs[0].runs[0].text,
    ).toBe("foo appears here");
    expect(
      state.presentation.slideset.slides[1].contents.text.find(
        (el) => el.id === "slide1-text",
      ).paragraphs[0].runs[0].text,
    ).toBe("another foo here");

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.REDO));
    expect(
      state.presentation.slideset.slides[0].contents.text.find(
        (el) => el.id === "slide0-extra",
      ).paragraphs[0].runs[0].text,
    ).toBe("bar appears here");

    const json = serializePresentation(state.presentation);
    const { data, errors } = deserializePresentation(json);
    expect(errors).toEqual([]);
    expect(validateSlideset(data)).toEqual([]);
    expect(
      data.slideset.slides[1].contents.text.find(
        (el) => el.id === "slide1-text",
      ).paragraphs[0].runs[0].text,
    ).toBe("another bar here");
  });

  test("whole-word matching excludes partial matches (e.g. 'foobar' does not match 'foo')", () => {
    let state = createInitialEditorState();
    state = {
      ...state,
      presentation: addTextElement(state.presentation, 0, {
        id: "whole-word-el",
        position: { x: 0, y: 0 },
        width: 100,
        height: 50,
        paragraphs: [
          { id: "p", formatting: {}, runs: [{ text: "foo and foobar" }] },
        ],
      }),
    };

    const wholeWordMatches = findMatches(
      state.presentation.slideset.slides,
      "foo",
      { wholeWords: true },
    );
    expect(wholeWordMatches).toHaveLength(1);

    const looseMatches = findMatches(
      state.presentation.slideset.slides,
      "foo",
      { wholeWords: false },
    );
    expect(looseMatches).toHaveLength(2);
  });

  test("an empty batch (no matches) does not open a history transaction", () => {
    let state = addSlide(createInitialEditorState().presentation);
    let editorState = createInitialEditorState();
    editorState = { ...editorState, presentation: state };

    const matches = findMatches(editorState.presentation.slideset.slides, "zzz-not-present");
    expect(matches).toHaveLength(0);
    expect(batchReplaceAll(matches, editorState.presentation.slideset.slides, "x")).toHaveLength(0);
  });
});

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

describe("transitions, speaker notes, and backgrounds through reducer and export", () => {
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

  const exportedHtml = async (presentation) => {
    await exportToReveal(presentation);
    return capturedBlob.text();
  };

  test("changing the slide transition and duration lands as data-transition/-speed in the export", async () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.UPDATE_TRANSITION, {
        transition: "fade",
        duration: 0.3,
      }),
    );

    const contents = state.presentation.slideset.slides[0].contents;
    expect(contents.transition).toBe("fade");
    expect(contents.transitionDuration).toBe(0.3);

    const html = await exportedHtml(state.presentation);
    expect(html).toContain('data-transition="fade"');
    expect(html).toContain('data-transition-speed="fast"');
  });

  test("apply-transition-to-all stamps every exported slide section", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.APPLY_TRANSITION_TO_ALL, {
        transition: "zoom",
        duration: 1.5,
      }),
    );

    const html = await exportedHtml(state.presentation);
    const zoomCount = html.split('data-transition="zoom"').length - 1;
    const slowCount = html.split('data-transition-speed="slow"').length - 1;
    expect(zoomCount).toBe(3);
    expect(slowCount).toBe(3);
  });

  test("speaker notes end up in the reveal.js notes aside", async () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.UPDATE_NOTES, {
        notes: "Remember to mention the Q3 numbers",
      }),
    );

    const html = await exportedHtml(state.presentation);
    expect(html).toContain(
      '<aside class="notes">Remember to mention the Q3 numbers</aside>',
    );
  });

  test("a slide without notes exports no notes aside", async () => {
    const html = await exportedHtml(createInitialEditorState().presentation);
    expect(html).not.toContain('<aside class="notes">');
  });

  test("slide background changes are exported as the section background", async () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.UPDATE_BACKGROUND, {
        background: "#FFEE00FF",
      }),
    );
    expect(state.presentation.slideset.slides[0].contents.background).toBe(
      "#FFEE00FF",
    );

    const html = await exportedHtml(state.presentation);
    expect(html).toContain("background: #FFEE00FF");
  });

  test("apply-background-to-all recolors every slide and is undoable in one step", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.APPLY_BACKGROUND_TO_ALL, {
        background: "#00CCFFFF",
      }),
    );

    for (const slide of state.presentation.slideset.slides) {
      expect(slide.contents.background).toBe("#00CCFFFF");
    }

    const html = await exportedHtml(state.presentation);
    expect(html.split("background: #00CCFFFF").length - 1).toBe(2);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));
    for (const slide of state.presentation.slideset.slides) {
      expect(slide.contents.background).not.toBe("#00CCFFFF");
    }
  });
});
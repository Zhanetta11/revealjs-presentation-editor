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

describe("hidden slides through the reducer and export anchors", () => {
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

  test("TOGGLE_HIDDEN excludes the slide from export and toggling back restores it", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "hidden-marker",
        position: { x: 0, y: 0 },
        width: 200,
        height: 50,
        paragraphs: [
          { id: "hm-p", formatting: {}, runs: [{ formatting: {}, text: "Secret agenda item" }] },
        ],
      },
    }));

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.TOGGLE_HIDDEN, { slideIndex: 1 }),
    );
    expect(state.presentation.slideset.slides[1].hidden).toBe(true);

    let html = await exportedHtml(state.presentation);
    expect(html).not.toContain("Secret agenda item");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.TOGGLE_HIDDEN, { slideIndex: 1 }),
    );
    expect(state.presentation.slideset.slides[1].hidden).toBe(false);

    html = await exportedHtml(state.presentation);
    expect(html).toContain("Secret agenda item");
  });

  test("hiding a slide shifts the reveal.js anchor that internal links resolve to", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.SELECT, { slideIndex: 0 }),
    );
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "anchor-link-el",
        position: { x: 10, y: 10 },
        width: 300,
        height: 60,
        paragraphs: [
          { id: "al-p", formatting: {}, runs: [{ formatting: {}, text: "Go to summary" }] },
        ],
      },
    }));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RUN_LINK, {
        elementId: "anchor-link-el",
        paragraphIdx: 0,
        rangeStart: 6,
        rangeEnd: 13,
        link: { href: "#slide-3", target: "_self" },
      }),
    );

    let html = await exportedHtml(state.presentation);
    expect(html).toContain('href="#/2"');

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.TOGGLE_HIDDEN, { slideIndex: 1 }),
    );
    html = await exportedHtml(state.presentation);
    expect(html).toContain('href="#/1"');
    expect(html).not.toContain('href="#/2"');
  });

  test("hiding the link's own target degrades the link to plain styled text", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.SELECT, { slideIndex: 0 }),
    );
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "dead-link-el",
        position: { x: 10, y: 10 },
        width: 300,
        height: 60,
        paragraphs: [
          { id: "dl-p", formatting: {}, runs: [{ formatting: {}, text: "See appendix" }] },
        ],
      },
    }));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RUN_LINK, {
        elementId: "dead-link-el",
        paragraphIdx: 0,
        rangeStart: 4,
        rangeEnd: 12,
        link: { href: "#slide-2", target: "_self" },
      }),
    );
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.TOGGLE_HIDDEN, { slideIndex: 1 }),
    );

    const html = await exportedHtml(state.presentation);
    expect(html).toContain("appendix");
    expect(html).not.toMatch(/<a [^>]*>appendix<\/a>/);
  });
});
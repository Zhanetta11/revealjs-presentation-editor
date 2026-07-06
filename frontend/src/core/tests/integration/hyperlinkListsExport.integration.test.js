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

describe("hyperlinks and lists through reducer and export", () => {
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

  function addTextTo(state, id, text) {
    return editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id,
        position: { x: 10, y: 10 },
        width: 400,
        height: 80,
        "z-index": 1,
        paragraphs: [
          { id: `${id}-p`, formatting: {}, runs: [{ formatting: {}, text }] },
        ],
      },
    }));
  }

  test("an external hyperlink on a text range exports as a safe target=_blank anchor", async () => {
    let state = createInitialEditorState();
    state = addTextTo(state, "link-el", "Visit our website today");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RUN_LINK, {
        elementId: "link-el",
        paragraphIdx: 0,
        rangeStart: 10,
        rangeEnd: 17,
        link: { href: "https://example.com/", target: "_blank" },
      }),
    );

    const runs = state.presentation.slideset.slides[0].contents.text.find(
      (el) => el.id === "link-el",
    ).paragraphs[0].runs;
    const linkedRun = runs.find((run) => run.link);
    expect(linkedRun.text).toBe("website");
    expect(linkedRun.link.href).toBe("https://example.com/");

    const html = await exportedHtml(state.presentation);
    expect(html).toMatch(
      /<a href="https:\/\/example\.com\/" target="_blank" rel="noopener noreferrer"[^>]*>website<\/a>/,
    );
  });

  test("an internal slide link is rewritten to a reveal.js anchor at export time", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.SLIDE.SELECT, { slideIndex: 0 }),
    );
    state = addTextTo(state, "internal-link-el", "Jump to details");

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RUN_LINK, {
        elementId: "internal-link-el",
        paragraphIdx: 0,
        rangeStart: 8,
        rangeEnd: 15,
        link: { href: "#slide-2", target: "_self" },
      }),
    );

    const html = await exportedHtml(state.presentation);
    expect(html).toMatch(/<a href="#\/1" target="_self"[^>]*>details<\/a>/);
    expect(html).not.toContain('href="#slide-2"');
  });

  test("bullet list formatting on paragraphs exports bullet markers", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "bullets-el",
        position: { x: 10, y: 10 },
        width: 400,
        height: 120,
        "z-index": 1,
        paragraphs: [
          { id: "b-p1", formatting: {}, runs: [{ formatting: {}, text: "First point" }] },
          { id: "b-p2", formatting: {}, runs: [{ formatting: {}, text: "Second point" }] },
        ],
      },
    }));

    for (const paragraphIdx of [0, 1]) {
      state = editorReducer(
        state,
        createEditorEvent(EditorEventType.TEXT.UPDATE_PARAGRAPH_FORMATTING, {
          elementId: "bullets-el",
          paragraphIdx,
          formatting: { "list-type": "bullets" },
        }),
      );
    }

    const html = await exportedHtml(state.presentation);
    expect(html).toContain("First point");
    expect(html).toContain("Second point");
    expect(html.split(">•</span>").length - 1).toBeGreaterThanOrEqual(2);
  });

  test("numbered list formatting exports sequential number markers", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "numbered-el",
        position: { x: 10, y: 10 },
        width: 400,
        height: 120,
        "z-index": 1,
        paragraphs: [
          { id: "n-p1", formatting: {}, runs: [{ formatting: {}, text: "Step one" }] },
          { id: "n-p2", formatting: {}, runs: [{ formatting: {}, text: "Step two" }] },
        ],
      },
    }));

    for (const paragraphIdx of [0, 1]) {
      state = editorReducer(
        state,
        createEditorEvent(EditorEventType.TEXT.UPDATE_PARAGRAPH_FORMATTING, {
          elementId: "numbered-el",
          paragraphIdx,
          formatting: { "list-type": "numbered" },
        }),
      );
    }

    const html = await exportedHtml(state.presentation);
    expect(html).toContain(">1.</span>");
    expect(html).toContain(">2.</span>");
  });
});
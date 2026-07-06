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

describe("master elements through reducer and export", () => {
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

  const masterTextElements = (state) =>
    state.presentation.slideset.master.elements.text;

  test("a text element added to the master appears on every exported slide", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    expect(state.presentation.slideset.slides).toHaveLength(3);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.ADD_ELEMENT, {
        elementType: "text",
        element: {
          id: "master-logo-text",
          position: { x: 1100, y: 20 },
          width: 160,
          height: 40,
          "z-index": 1,
          paragraphs: [
            {
              id: "master-logo-p",
              formatting: { size: "16px" },
              runs: [{ formatting: {}, text: "ACME Corp Confidential" }],
            },
          ],
        },
      }),
    );

    expect(
      masterTextElements(state).some((el) => el.id === "master-logo-text"),
    ).toBe(true);

    const html = await exportedHtml(state.presentation);
    expect(html.split("ACME Corp Confidential").length - 1).toBe(3);
  });

  test("deleting a master element removes it from every exported slide", async () => {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.ADD_ELEMENT, {
        elementType: "text",
        element: {
          id: "master-temp",
          position: { x: 0, y: 0 },
          width: 100,
          height: 30,
          paragraphs: [
            { id: "mt-p", formatting: {}, runs: [{ formatting: {}, text: "Temporary stamp" }] },
          ],
        },
      }),
    );

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.DELETE_ELEMENT, {
        elementType: "text",
        elementId: "master-temp",
      }),
    );
    expect(
      masterTextElements(state).some((el) => el.id === "master-temp"),
    ).toBe(false);

    const html = await exportedHtml(state.presentation);
    expect(html).not.toContain("Temporary stamp");
  });

  test("TOGGLE_FOOTERS adds master footer elements and toggling again removes them", () => {
    let state = createInitialEditorState();
    const countBefore = masterTextElements(state).length;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.TOGGLE_FOOTERS, {}),
    );
    const withFooters = masterTextElements(state);
    expect(withFooters.length).toBeGreaterThan(countBefore);

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.TOGGLE_FOOTERS, {}),
    );
    expect(masterTextElements(state)).toHaveLength(countBefore);
  });

  test("changing the master font cascades into exported text that has no own font", async () => {
    let state = createInitialEditorState();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.UPDATE_FORMATTING, {
        formatting: { font: "Georgia" },
      }),
    );
    expect(state.presentation.slideset.master.formatting.font).toBe("Georgia");

    const html = await exportedHtml(state.presentation);
    expect(html).toContain("font-family: Georgia");
  });
});
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

vi.mock("../../persistence/storageAdapter", () => ({ storageAdapter }));

import {
  editorReducer,
  createInitialEditorState,
} from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import { exportToReveal } from "../../export/exportToReveal";

describe("range formatting -> run spans -> export integration", () => {
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

  function stateWithRangeTarget() {
    let state = createInitialEditorState();
    return editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "range-target",
        position: { x: 10, y: 10 },
        width: 400,
        height: 80,
        "z-index": 1,
        paragraphs: [
          {
            id: "p-range",
            formatting: {},
            runs: [{ formatting: {}, text: "Highlight this word here" }],
          },
        ],
      },
    }));
  }

  const targetRuns = (state) =>
    state.presentation.slideset.slides[0].contents.text.find(
      (el) => el.id === "range-target",
    ).paragraphs[0].runs;

  test("coloring a character range splits runs and exports an inline-styled span", async () => {
    let state = stateWithRangeTarget();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RANGE_FORMATTING, {
        elementId: "range-target",
        paragraphIdx: 0,
        rangeStart: 10,
        rangeEnd: 14,
        formatting: { color: "#FF0000FF", weight: "bold" },
      }),
    );

    const runs = targetRuns(state);
    expect(runs.map((run) => run.text)).toEqual([
      "Highlight ",
      "this",
      " word here",
    ]);
    expect(runs[1].formatting.color).toBe("#FF0000FF");
    expect(runs[1].formatting.weight).toBe("bold");
    expect(runs[0].formatting.color).toBeUndefined();
    expect(runs[2].formatting.color).toBeUndefined();

    await exportToReveal(state.presentation);

    const html = await capturedBlob.text();
    expect(html).toMatch(
      /<span style="[^"]*color: #FF0000FF[^"]*">this<\/span>/,
    );
    expect(html).toMatch(/font-weight: bold[^"]*">this<\/span>/);
    expect(html).toContain("Highlight ");
    expect(html).toContain(" word here");
  });

  test("range formatting is undoable back to a single unformatted run", () => {
    let state = stateWithRangeTarget();
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.TEXT.UPDATE_RANGE_FORMATTING, {
        elementId: "range-target",
        paragraphIdx: 0,
        rangeStart: 0,
        rangeEnd: 9,
        formatting: { color: "#00FF00FF" },
      }),
    );
    expect(targetRuns(state).length).toBeGreaterThan(1);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));

    const runs = targetRuns(state);
    expect(runs).toHaveLength(1);
    expect(runs[0].formatting.color).toBeUndefined();
  });
});
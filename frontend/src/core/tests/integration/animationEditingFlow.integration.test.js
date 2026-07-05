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
import { createAnimation, reorderAnimation } from "../../operations/animationOperations";
import { exportToReveal } from "../../export/exportToReveal";

describe("animation editing lifecycle through the reducer and export", () => {
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

  function stateWithTwoAnimatedElements() {
    let state = createInitialEditorState();
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "anim-el-a",
        position: { x: 10, y: 10 },
        width: 200,
        height: 60,
        "z-index": 1,
        paragraphs: [{ id: "pa", formatting: {}, runs: [{ text: "First animated" }] }],
      },
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.TEXT.ADD, {
      textElement: {
        id: "anim-el-b",
        position: { x: 10, y: 100 },
        width: 200,
        height: 60,
        "z-index": 2,
        paragraphs: [{ id: "pb", formatting: {}, runs: [{ text: "Second animated" }] }],
      },
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.ANIMATION.ADD, {
      animation: createAnimation("anim-el-a", "grow", 1),
    }));
    state = editorReducer(state, createEditorEvent(EditorEventType.ANIMATION.ADD, {
      animation: createAnimation("anim-el-b", "fade-up", 2),
    }));
    return state;
  }

  const animations = (state) =>
    state.presentation.slideset.slides[state.selectedSlideIndex].contents
      .animations;

  test("ANIMATION.UPDATE changes the effect and the export reflects it", async () => {
    let state = stateWithTwoAnimatedElements();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ANIMATION.UPDATE, {
        animationId: "anim-el-a",
        updates: { effect: "fade-out" },
      }),
    );

    expect(animations(state).find((a) => a.id === "anim-el-a").effect).toBe(
      "fade-out",
    );

    await exportToReveal(state.presentation);

    const html = await capturedBlob.text();
    expect(html).toContain('class="fragment fade-out"');
    expect(html).not.toContain('class="fragment grow"');
  });

  test("ANIMATION.DELETE renumbers the remaining sequences and the export follows", async () => {
    let state = stateWithTwoAnimatedElements();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ANIMATION.DELETE, {
        animationId: "anim-el-a",
      }),
    );

    const remaining = animations(state);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("anim-el-b");
    expect(remaining[0].sequence).toBe(1);

    await exportToReveal(state.presentation);

    const html = await capturedBlob.text();
    expect(html).toContain('data-fragment-index="1"');
    expect(html).not.toContain('data-fragment-index="2"');
    expect(html).toContain("First animated");
  });

  test("reorderAnimation swaps sequences through ANIMATION.UPDATE dispatches", () => {
    let state = stateWithTwoAnimatedElements();

    const updates = reorderAnimation(animations(state), "anim-el-b", -1);
    expect(updates).toHaveLength(2);
    for (const { id, sequence } of updates) {
      state = editorReducer(
        state,
        createEditorEvent(EditorEventType.ANIMATION.UPDATE, {
          animationId: id,
          updates: { sequence },
        }),
      );
    }

    expect(animations(state).find((a) => a.id === "anim-el-b").sequence).toBe(1);
    expect(animations(state).find((a) => a.id === "anim-el-a").sequence).toBe(2);
  });

  test("deleting an animation is undoable with its original sequence restored", () => {
    let state = stateWithTwoAnimatedElements();

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.ANIMATION.DELETE, {
        animationId: "anim-el-a",
      }),
    );
    expect(animations(state)).toHaveLength(1);

    state = editorReducer(state, createEditorEvent(EditorEventType.HISTORY.UNDO, {}));

    expect(animations(state)).toHaveLength(2);
    expect(animations(state).find((a) => a.id === "anim-el-a").sequence).toBe(1);
    expect(animations(state).find((a) => a.id === "anim-el-b").sequence).toBe(2);
  });
});
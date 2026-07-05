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
import { applyTheme } from "../../operations/themeOperations";
import { exportToReveal } from "../../export/exportToReveal";

describe("master theme + dimensions export cascade", () => {
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

  test("MASTER.UPDATE_THEME_COLOR through the reducer lands in the exported :root variables", async () => {
    let state = createInitialEditorState();
    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.UPDATE_THEME_COLOR, {
        colorVariable: "text-dark",
        hexColor: "#123456",
      }),
    );

    await exportToReveal(state.presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("--text-dark: #123456FF");
    expect(html).toContain("var(--text-dark");
  });

  test("applying a design theme swaps the exported color theme wholesale", async () => {
    let presentation = createInitialEditorState().presentation;
    presentation = applyTheme(presentation, "ocean");

    const expectedBgLight = presentation.slideset.master["color-theme"].find(
      (entry) => entry["css-variable-name"] === "bg-light",
    ).color;
    const expectedAccent1 = presentation.slideset.master["color-theme"].find(
      (entry) => entry["css-variable-name"] === "accent1",
    ).color;

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain(`--bg-light: ${expectedBgLight}`);
    expect(html).toContain(`--accent1: ${expectedAccent1}`);
  });

  test("slide text with no own formatting inherits the layout placeholder's formatting in the export", async () => {
    const presentation = createInitialEditorState().presentation;

    const titleElement = presentation.slideset.slides[0].contents.text.find(
      (el) => el["placeholder-id"] === "title-placeholder",
    );
    expect(titleElement.paragraphs[0].formatting).toEqual({});

    const layout = presentation.slideset.layouts.find(
      (l) => l["layout-id"] === presentation.slideset.slides[0]["layout-id"],
    );
    const placeholderFormatting = layout.placeholders.find(
      (p) => p["placeholder-id"] === "title-placeholder",
    ).formatting;
    expect(placeholderFormatting.size).toBe("44px");

    await exportToReveal(presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("font-size: 44px");
    expect(html).toContain("font-weight: bold");
    expect(html).toContain("text-align: center");
  });

  test("MASTER.UPDATE_DIMENSIONS rescales slide elements and the export geometry consistently", async () => {
    let state = createInitialEditorState();
    const originalTitle = state.presentation.slideset.slides[0].contents.text.find(
      (el) => el["placeholder-id"] === "title-placeholder",
    );
    const originalWidth = originalTitle.width;
    const originalX = originalTitle.position.x;

    state = editorReducer(
      state,
      createEditorEvent(EditorEventType.MASTER.UPDATE_DIMENSIONS, {
        slideDimensions: { width: 640, height: 360 },
        aspectRatio: "16:9",
        dimensionUnits: "px",
      }),
    );

    const scaledTitle = state.presentation.slideset.slides[0].contents.text.find(
      (el) => el["placeholder-id"] === "title-placeholder",
    );
    expect(scaledTitle.width).toBe(Math.round(originalWidth / 2));
    expect(scaledTitle.position.x).toBe(Math.round(originalX / 2));

    const scaledPlaceholder = state.presentation.slideset.layouts
      .find((l) => l["layout-id"] === state.presentation.slideset.slides[0]["layout-id"])
      .placeholders.find((p) => p["placeholder-id"] === "title-placeholder");
    expect(scaledPlaceholder.width).toBe(Math.round(originalWidth / 2));

    await exportToReveal(state.presentation);

    const html = await capturedBlob.text();
    expect(html).toContain("width: 640,");
    expect(html).toContain("height: 360,");
    expect(html).toContain("width: 640px");
    expect(html).toContain(`width: ${Math.round(originalWidth / 2)}px`);
  });
});
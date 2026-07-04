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
      getAllPresentationIds: vi.fn(async () =>
        [...records.keys()]
          .filter((k) => k.startsWith("presentation-"))
          .map((k) => k.slice("presentation-".length)),
      ),
    },
  };
});

vi.mock("../../persistence/storageAdapter", () => ({ storageAdapter }));

import { createEventBus } from "../../events/eventBus";
import { createInitialEditorState, editorReducer } from "../../store/editorStore";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import { storageGet } from "../../persistence/persistenceFacade";
import {
  getIndex,
  createPresentation,
  savePresentation,
  loadPresentation,
  deletePresentation,
  presentationKey,
} from "../../persistence/presentationsLibrary";
import { deserializePresentation } from "../../persistence/serializationOperations";
import { importPresentationFromJson } from "../../persistence/importPresentation";
import { createDefaultPresentation } from "../../model/defaultPresentation";

function createEditorHarness(storageKey) {
  let state = createInitialEditorState();
  const getState = () => state;
  const dispatchAndCommit = async (event) => {
    state = editorReducer(state, event);
    return state;
  };
  const eventBus = createEventBus(dispatchAndCommit, getState, { storageKey });
  return { eventBus, getState };
}

describe("event bus -> autosave -> storage integration", () => {
  const storageKey = "presentation-test-doc";

  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("adding a slide is not persisted until the debounce delay elapses", async () => {
    const { eventBus } = createEditorHarness(storageKey);

    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    expect(await storageGet(storageKey)).toBeNull();

    await vi.advanceTimersByTimeAsync(2000);

    const persisted = await storageGet(storageKey);
    expect(persisted).not.toBeNull();
  });

  test("the persisted JSON round-trips into the same slide count as the live state", async () => {
    const { eventBus, getState } = createEditorHarness(storageKey);

    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    await vi.advanceTimersByTimeAsync(2000);

    const persisted = await storageGet(storageKey);
    const { data, errors } = deserializePresentation(persisted);

    expect(errors).toEqual([]);
    expect(data.slideset.slides).toHaveLength(
      getState().presentation.slideset.slides.length,
    );
  });

  test("saving the presentation updates the presentations index entry", async () => {
    const { eventBus } = createEditorHarness(storageKey);

    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    await vi.advanceTimersByTimeAsync(2000);

    const index = await getIndex();
    expect(index.some((entry) => entry.id === "test-doc")).toBe(true);
  });

  test("PRESENTATION.SAVE persists immediately, bypassing the debounce", async () => {
    const { eventBus } = createEditorHarness(storageKey);

    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    await eventBus.dispatch(
      createEditorEvent(EditorEventType.PRESENTATION.SAVE, {}),
    );

    expect(await storageGet(storageKey)).not.toBeNull();
  });

  test("disabling autosave stops further automatic persistence", async () => {
    const { eventBus, getState } = createEditorHarness(storageKey);

    await eventBus.dispatch(
      createEditorEvent(EditorEventType.PRESENTATION.TOGGLE_AUTOSAVE, {}),
    );
    expect(getState().autosaveEnabled).toBe(false);

    await eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.ADD, {}));
    await vi.advanceTimersByTimeAsync(5000);

    expect(await storageGet(storageKey)).toBeNull();
  });

  test("slide selection alone does not trigger a save", async () => {
    const { eventBus } = createEditorHarness(storageKey);

    await eventBus.dispatch(
      createEditorEvent(EditorEventType.SLIDE.SELECT, { slideIndex: 0 }),
    );
    await vi.advanceTimersByTimeAsync(5000);

    expect(await storageGet(storageKey)).toBeNull();
  });
});

describe("presentation library lifecycle integration", () => {
  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
  });

  test("create -> save -> load round-trips the same presentation data", async () => {
    const id = await createPresentation("My Deck");
    const presentation = createDefaultPresentation();

    await savePresentation(id, presentation);
    const loaded = await loadPresentation(id);
    const { data, errors } = deserializePresentation(loaded);

    expect(errors).toEqual([]);
    expect(data.slideset.slides).toHaveLength(presentation.slideset.slides.length);
    expect(data.slideset.title).toBe(presentation.slideset.title);
    expect(records.has(presentationKey(id))).toBe(true);
  });

  test("saving updates the index with the presentation title", async () => {
    const id = await createPresentation("Untitled Presentation");
    const presentation = createDefaultPresentation();
    presentation.slideset.title = "Quarterly Review";

    await savePresentation(id, presentation);

    const index = await getIndex();
    const entry = index.find((e) => e.id === id);
    expect(entry).toBeDefined();
    expect(entry.title).toBe("Quarterly Review");
  });

  test("deleting a presentation removes it from both storage and the index", async () => {
    const id = await createPresentation("Temp Deck");
    await savePresentation(id, createDefaultPresentation());

    await deletePresentation(id);

    expect(await loadPresentation(id)).toBeNull();
    const index = await getIndex();
    expect(index.some((entry) => entry.id === id)).toBe(false);
  });

  test("importing a JSON file creates and persists a new presentation", async () => {
    const source = createDefaultPresentation();
    source.slideset.title = "Imported Deck";
    const jsonText = JSON.stringify(source);

    const id = await importPresentationFromJson(jsonText);

    const loaded = await loadPresentation(id);
    const { data } = deserializePresentation(loaded);
    expect(data.slideset.title).toBe("Imported Deck");

    const index = await getIndex();
    expect(
      index.some((entry) => entry.id === id && entry.title === "Imported Deck"),
    ).toBe(true);
  });

  test("importing invalid JSON is rejected instead of silently creating a presentation", async () => {
    await expect(importPresentationFromJson("{ not valid json")).rejects.toThrow(
      /Invalid presentation file/,
    );
    expect(await getIndex()).toHaveLength(0);
  });

  test("importing JSON without a slideset is rejected", async () => {
    await expect(
      importPresentationFromJson(JSON.stringify({ notASlideset: true })),
    ).rejects.toThrow(/Invalid presentation file/);
  });
});
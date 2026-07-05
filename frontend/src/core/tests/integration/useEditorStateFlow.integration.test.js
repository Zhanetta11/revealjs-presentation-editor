import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

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

import { useEditorState } from "../../../hooks/editor/useEditorState";
import { EditorEventType, createEditorEvent } from "../../events/editorEvents";
import { createDefaultPresentation } from "../../model/defaultPresentation";
import {
  serializePresentation,
  deserializePresentation,
} from "../../persistence/serializationOperations";

describe("useEditorState hook integration", () => {
  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
  });

  test("hydrates presentation state from previously persisted storage on mount", async () => {
    const seeded = createDefaultPresentation();
    seeded.slideset.title = "Reloaded Deck";
    records.set("presentation", serializePresentation(seeded));

    const { result, unmount } = renderHook(() => useEditorState(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.state.presentation.slideset.title).toBe("Reloaded Deck");
    unmount();
  });

  test("starts with no saved presentation when storage is empty", async () => {
    const { result, unmount } = renderHook(() => useEditorState(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.state.presentation.slideset.slides).toHaveLength(1);
    expect(result.current.saveStatus).toBe("idle");
    unmount();
  });

  test("dispatching through the hook's eventBus updates committed state and eventually autosaves", async () => {
    const { result, unmount } = renderHook(() => useEditorState(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.ADD, {}),
      );
    });

    expect(result.current.state.presentation.slideset.slides).toHaveLength(2);
    expect(records.has("presentation")).toBe(false);

    await waitFor(() => expect(result.current.saveStatus).toBe("saved"), {
      timeout: 3000,
    });

    const persisted = records.get("presentation");
    expect(persisted).toBeDefined();
    const { data, errors } = deserializePresentation(persisted);
    expect(errors).toEqual([]);
    expect(data.slideset.slides).toHaveLength(2);

    unmount();
  }, 8000);

  test("uses a presentation-id-scoped storage key when a presentationId is supplied", async () => {
    const seeded = createDefaultPresentation();
    seeded.slideset.title = "Specific Deck";
    records.set("presentation-abc123", serializePresentation(seeded));

    const { result, unmount } = renderHook(() => useEditorState("abc123"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.state.presentation.slideset.title).toBe("Specific Deck");
    expect(records.has("presentation")).toBe(false);
    unmount();
  });
});
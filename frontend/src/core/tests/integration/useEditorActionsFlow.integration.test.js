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
      getAllPresentationIds: vi.fn(async () => []),
    },
  };
});

vi.mock("../../persistence/storageAdapter", () => ({ storageAdapter }));

import { useEditorState } from "../../../hooks/useEditorState";
import { useEditorActions } from "../../../hooks/useEditorActions";
import { useSlides } from "../../../hooks/useSlides";

function useComposedEditor(presentationId) {
  const { state, eventBus, isLoading } = useEditorState(presentationId);
  const { slides, selectedSlide, selectedSlideIndex, selectedElementId } =
    useSlides(state);
  const actions = useEditorActions(
    eventBus,
    selectedSlideIndex,
    slides.length,
    presentationId,
  );
  return { isLoading, slides, selectedSlide, selectedSlideIndex, selectedElementId, actions };
}

describe("useEditorState + useEditorActions + useSlides composition", () => {
  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
  });

  test("addSlide dispatched through useEditorActions is reflected in the useSlides projection", async () => {
    const { result, unmount } = renderHook(() => useComposedEditor(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.slides).toHaveLength(1);

    act(() => {
      result.current.actions.addSlide();
    });

    expect(result.current.slides).toHaveLength(2);
    expect(result.current.selectedSlideIndex).toBe(1);
    expect(result.current.selectedSlide).toBe(result.current.slides[1]);

    unmount();
  });

  test("addTextElement, undo, and redo round-trip through the useSlides projection", async () => {
    const { result, unmount } = renderHook(() => useComposedEditor(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const textElement = {
      id: "actions-flow-text-1",
      position: { x: 5, y: 5 },
      width: 150,
      height: 40,
      paragraphs: [
        { id: "p-1", formatting: {}, runs: [{ text: "Added via actions" }] },
      ],
    };

    act(() => {
      result.current.actions.addTextElement(textElement);
    });

    expect(
      result.current.selectedSlide.contents.text.some(
        (el) => el.id === "actions-flow-text-1",
      ),
    ).toBe(true);
    expect(result.current.selectedElementId).toBe("actions-flow-text-1");

    act(() => {
      result.current.actions.undo();
    });

    expect(
      result.current.selectedSlide.contents.text.some(
        (el) => el.id === "actions-flow-text-1",
      ),
    ).toBe(false);

    act(() => {
      result.current.actions.redo();
    });

    expect(
      result.current.selectedSlide.contents.text.some(
        (el) => el.id === "actions-flow-text-1",
      ),
    ).toBe(true);

    unmount();
  });

  test("setSelectedSlideId changes which slide useSlides reports as selected", async () => {
    const { result, unmount } = renderHook(() => useComposedEditor(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.actions.addSlide();
    });
    expect(result.current.slides).toHaveLength(2);
    expect(result.current.selectedSlideIndex).toBe(1);

    act(() => {
      result.current.actions.setSelectedSlideId(0);
    });

    expect(result.current.selectedSlideIndex).toBe(0);
    expect(result.current.selectedSlide).toBe(result.current.slides[0]);
    expect(result.current.selectedElementId).toBeNull();

    unmount();
  });
});
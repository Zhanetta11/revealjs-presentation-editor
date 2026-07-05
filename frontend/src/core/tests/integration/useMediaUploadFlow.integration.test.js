import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
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
import { useMediaUpload } from "../../../hooks/useMediaUpload";

class FakeImage {
  set src(value) {
    this._src = value;
    queueMicrotask(() => {
      this.naturalWidth = 800;
      this.naturalHeight = 600;
      this.onload?.();
    });
  }

  get src() {
    return this._src;
  }
}

function useComposedMediaUpload(presentationId) {
  const { state, eventBus, isLoading } = useEditorState(presentationId);
  const { slides, selectedSlide, selectedSlideIndex } = useSlides(state);
  const actions = useEditorActions(
    eventBus,
    selectedSlideIndex,
    slides.length,
    presentationId,
  );
  const { handleImageUpload } = useMediaUpload(actions.addMedia, 1280, 720);
  return { isLoading, slides, selectedSlide, handleImageUpload };
}

describe("useMediaUpload -> mediaStorage -> useEditorActions integration", () => {
  let originalImage;

  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
    originalImage = global.Image;
    global.Image = FakeImage;
  });

  afterEach(() => {
    global.Image = originalImage;
  });

  test("uploading an image stores the file and adds a media element sized to fit the slide", async () => {
    const { result, unmount } = renderHook(() => useComposedMediaUpload(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedSlide.contents.media).toHaveLength(0);

    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    const event = { target: { files: [file], value: "photo.png" } };

    await act(async () => {
      await result.current.handleImageUpload(event);
    });

    expect(result.current.selectedSlide.contents.media).toHaveLength(1);
    const media = result.current.selectedSlide.contents.media[0];
    expect(media["media-type"]).toBe("image");
    expect(media["file-link"]).toMatch(/^indexeddb:\/\//);

    expect(media.width).toBeLessThanOrEqual(1280 * 0.3);
    expect(media.height).toBeLessThanOrEqual(720 * 0.3);
    expect(Math.round((media.width / media.height) * 100)).toBe(
      Math.round((800 / 600) * 100),
    );

    const key = media["file-link"].replace("indexeddb://", "");
    expect(records.has(key)).toBe(true);

    expect(event.target.value).toBe("");

    unmount();
  });

  test("a non-image file is ignored", async () => {
    const { result, unmount } = renderHook(() => useComposedMediaUpload(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    const event = { target: { files: [file], value: "notes.txt" } };

    await act(async () => {
      await result.current.handleImageUpload(event);
    });

    expect(result.current.selectedSlide.contents.media).toHaveLength(0);
    expect(records.size).toBe(0);

    unmount();
  });
});
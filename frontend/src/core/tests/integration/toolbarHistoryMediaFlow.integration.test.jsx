import { describe, test, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

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

vi.mock("../../persistence/storage/storageAdapter", () => ({ storageAdapter }));

import EditorPage from "../../../pages/EditorPage";

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

describe("toolbar history buttons + media upload integration (real EditorPage)", () => {
  let originalImage;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    records.clear();
    vi.clearAllMocks();
    originalImage = globalThis.Image;
    globalThis.Image = FakeImage;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  function renderEditor(presentationId) {
    return render(
      <MemoryRouter initialEntries={[`/editor/${presentationId}`]}>
        <Routes>
          <Route path="/editor/:presentationId" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  async function waitForLoaded() {
    await waitFor(() =>
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument(),
    );
  }

  const canvasElementCount = () =>
    document.querySelectorAll("[data-element-id]").length;

  test("Undo/Redo toolbar buttons walk history and the canvas follows", async () => {
    renderEditor("history-flow");
    await waitForLoaded();

    const undoButton = () => screen.getByTitle("Undo (Ctrl+Z)");
    const redoButton = () => screen.getByTitle("Redo (Ctrl+Y)");

    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();

    const countBefore = canvasElementCount();

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    fireEvent.click(screen.getByRole("button", { name: /Text Box/i }));
    await waitFor(() => expect(canvasElementCount()).toBe(countBefore + 1));

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(undoButton()).toBeEnabled();
    expect(redoButton()).toBeDisabled();

    fireEvent.click(undoButton());
    await waitFor(() => expect(canvasElementCount()).toBe(countBefore));
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeEnabled();

    fireEvent.click(redoButton());
    await waitFor(() => expect(canvasElementCount()).toBe(countBefore + 1));
    expect(undoButton()).toBeEnabled();
    expect(redoButton()).toBeDisabled();
  });

  test("uploading a picture through the Insert tab renders a media element on the canvas", async () => {
    const { container } = renderEditor("media-upload-flow");
    await waitForLoaded();

    const countBefore = canvasElementCount();

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    const fileInput = container.querySelector('input[accept="image/*"]');
    expect(fileInput).not.toBeNull();

    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(canvasElementCount()).toBe(countBefore + 1));

    const mediaKeys = [...records.keys()].filter((key) => key.startsWith("media/"));
    expect(mediaKeys).toHaveLength(1);
    expect(document.querySelector(".canvas-media-wrapper")).not.toBeNull();
  });
});
import { describe, test, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
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
import { createDefaultPresentation } from "../../model/defaultPresentation";
import { addSlide } from "../../operations/slideOperations";
import { serializePresentation } from "../../persistence/serialization/serializationOperations";

describe("toolbar + canvas + slide list integration (real EditorPage)", () => {
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

  test("clicking Text Box on the toolbar's Insert tab adds an element the canvas renders", async () => {
    renderEditor("toolbar-flow-add-text");
    await waitForLoaded();

    const elementCountBefore =
      document.querySelectorAll("[data-element-id]").length;
    expect(elementCountBefore).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    fireEvent.click(screen.getByRole("button", { name: /Text Box/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("[data-element-id]").length).toBe(
        elementCountBefore + 1,
      );
    });
  });

  test("selecting a different slide in SlideList swaps the elements EditorCanvas renders", async () => {
    const presentationId = "toolbar-flow-slide-switch";
    let presentation = createDefaultPresentation();
    presentation = addSlide(presentation);
    records.set(
      `presentation-${presentationId}`,
      serializePresentation(presentation),
    );

    const firstSlideElementIds = presentation.slideset.slides[0].contents.text
      .map((el) => el.id)
      .sort();
    const secondSlideElementIds = presentation.slideset.slides[1].contents.text
      .map((el) => el.id)
      .sort();
    expect(firstSlideElementIds).not.toEqual(secondSlideElementIds);

    renderEditor(presentationId);
    await waitForLoaded();

    const canvasIdsInitially = () =>
      [...document.querySelectorAll("[data-element-id]")]
        .map((el) => el.getAttribute("data-element-id"))
        .sort();
    expect(canvasIdsInitially()).toEqual(firstSlideElementIds);

    fireEvent.click(screen.getByTitle("Slide 2"));

    await waitFor(() => {
      expect(canvasIdsInitially()).toEqual(secondSlideElementIds);
    });

    fireEvent.click(screen.getByTitle("First Slide"));

    await waitFor(() => {
      expect(canvasIdsInitially()).toEqual(firstSlideElementIds);
    });
  });
});

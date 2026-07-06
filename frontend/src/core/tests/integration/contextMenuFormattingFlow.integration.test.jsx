import { describe, test, expect, vi, beforeEach, beforeAll } from "vitest";
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

describe("context menu -> font dialog -> formatting integration (real EditorPage)", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    global.ResizeObserver = class {
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

  function rightClickTextElement(index = 0) {
    const wrapper = document.querySelectorAll(
      ".text-draggable[data-element-id]",
    )[index];
    expect(wrapper).toBeDefined();
    const editable = wrapper.querySelector("[contenteditable]") ?? wrapper;
    fireEvent.contextMenu(editable);
    return wrapper;
  }

  test("applying bold via the context menu's Font dialog updates element formatting in state", async () => {
    renderEditor("context-menu-format");
    await waitForLoaded();

    rightClickTextElement(1);
    const fontItem = await screen.findByText("Font...");
    fireEvent.click(fontItem.closest("button"));

    const dialog = await screen.findByRole("dialog", { name: "Font" });
    expect(dialog).toBeInTheDocument();
    const boldCheckbox = screen.getByLabelText(/bold/i);
    expect(boldCheckbox).not.toBeChecked();

    fireEvent.click(boldCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Font" })).not.toBeInTheDocument(),
    );

    rightClickTextElement(1);
    const fontItemAgain = await screen.findByText("Font...");
    fireEvent.click(fontItemAgain.closest("button"));

    await screen.findByRole("dialog", { name: "Font" });
    expect(screen.getByLabelText(/bold/i)).toBeChecked();
  });

  test("Cut from the text context menu removes the element from the canvas", async () => {
    renderEditor("context-menu-cut");
    await waitForLoaded();

    const countBefore = document.querySelectorAll("[data-element-id]").length;

    const wrapper = rightClickTextElement();
    const elementId = wrapper.getAttribute("data-element-id");

    const cutItem = await screen.findByText("Cut");
    fireEvent.click(cutItem.closest("button"));

    await waitFor(() => {
      expect(document.querySelectorAll("[data-element-id]").length).toBe(
        countBefore - 1,
      );
    });
    expect(
      document.querySelector(`[data-element-id="${elementId}"]`),
    ).toBeNull();
  });
});
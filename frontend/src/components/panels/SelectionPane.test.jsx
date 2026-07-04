import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectionPane from "./SelectionPane";

const slide = {
  contents: {
    text: [{ id: "t1", role: "title", "z-index": 2 }],
    media: [
      { id: "m1", "z-index": 1 },
      { id: "v1", "media-type": "video", "z-index": 3, hidden: true },
    ],
  },
};

const renderPane = (props = {}) =>
  render(
    <SelectionPane
      slide={slide}
      selectedElementIds={[]}
      onSelectElement={vi.fn()}
      onClose={vi.fn()}
      onSetVisibility={vi.fn()}
      onMoveLayer={vi.fn()}
      {...props}
    />,
  );

describe("SelectionPane — rendering", () => {
  test("shows 'No objects' for a slide without elements", () => {
    renderPane({ slide: { contents: { text: [], media: [] } } });
    expect(screen.getByText("No objects")).toBeInTheDocument();
  });

  test("lists elements top-most (highest z-index) first", () => {
    const { container } = renderPane();
    const labels = [...container.querySelectorAll(".selection-pane-label")].map(
      (el) => el.textContent,
    );
    expect(labels[0]).toContain("Video");
    expect(labels[1]).toContain("Title");
    expect(labels[2]).toContain("Graphic");
  });

  test("selected element row gets selected class", () => {
    const { container } = renderPane({ selectedElementIds: ["t1"] });
    const selectedRows = container.querySelectorAll(
      ".selection-pane-row.selected",
    );
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0].textContent).toContain("Title");
  });
});

describe("SelectionPane — selection", () => {
  test("clicking a row selects the element without toggle", () => {
    const onSelectElement = vi.fn();
    renderPane({ onSelectElement });
    fireEvent.click(screen.getByText(/Title/));
    expect(onSelectElement).toHaveBeenCalledWith("t1", { toggle: false });
  });

  test("ctrl-clicking a row selects the element with toggle", () => {
    const onSelectElement = vi.fn();
    renderPane({ onSelectElement });
    fireEvent.click(screen.getByText(/Title/), { ctrlKey: true });
    expect(onSelectElement).toHaveBeenCalledWith("t1", { toggle: true });
  });
});

describe("SelectionPane — visibility", () => {
  test("'Show All' makes all elements visible", () => {
    const onSetVisibility = vi.fn();
    renderPane({ onSetVisibility });
    fireEvent.click(screen.getByRole("button", { name: "Show All" }));
    expect(onSetVisibility).toHaveBeenCalledWith(["v1", "t1", "m1"], false);
  });

  test("'Hide All' hides all elements", () => {
    const onSetVisibility = vi.fn();
    renderPane({ onSetVisibility });
    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));
    expect(onSetVisibility).toHaveBeenCalledWith(["v1", "t1", "m1"], true);
  });

  test("eye button toggles a single hidden element without selecting it", () => {
    const onSetVisibility = vi.fn();
    const onSelectElement = vi.fn();
    renderPane({ onSetVisibility, onSelectElement });
    fireEvent.click(screen.getByTitle("Show object"));
    expect(onSetVisibility).toHaveBeenCalledWith(["v1"], false);
    expect(onSelectElement).not.toHaveBeenCalled();
  });
});

describe("SelectionPane — layer order & close", () => {
  test("arrow buttons are disabled without a selection", () => {
    renderPane({ selectedElementIds: [] });
    expect(screen.getByTitle("Move forward")).toBeDisabled();
    expect(screen.getByTitle("Move backward")).toBeDisabled();
  });

  test("arrow buttons call onMoveLayer when an element is selected", () => {
    const onMoveLayer = vi.fn();
    renderPane({ selectedElementIds: ["t1"], onMoveLayer });
    fireEvent.click(screen.getByTitle("Move forward"));
    expect(onMoveLayer).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByTitle("Move backward"));
    expect(onMoveLayer).toHaveBeenCalledWith(1);
  });

  test("close button calls onClose", () => {
    const onClose = vi.fn();
    renderPane({ onClose });
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

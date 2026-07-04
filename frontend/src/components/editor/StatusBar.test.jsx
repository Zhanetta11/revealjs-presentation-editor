import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusBar from "./StatusBar";

const renderBar = (props = {}) =>
  render(
    <StatusBar
      selectedSlideIndex={2}
      totalSlides={10}
      zoom={80}
      onZoomChange={vi.fn()}
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onToggleNotes={vi.fn()}
      onToggleComments={vi.fn()}
      {...props}
    />,
  );

describe("StatusBar — slide counter", () => {
  test("shows 1-based current slide and total", () => {
    renderBar();
    expect(screen.getByText("Slide 3 of 10")).toBeInTheDocument();
  });
});

describe("StatusBar — save status", () => {
  test("shows no save label for idle status", () => {
    const { container } = renderBar({ saveStatus: "idle" });
    expect(container.querySelector(".save-status")).toBeNull();
  });

  test("shows 'Unsaved changes' for pending status", () => {
    renderBar({ saveStatus: "pending" });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  test("shows 'Saving…' for saving status", () => {
    renderBar({ saveStatus: "saving" });
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  test("shows 'Save failed' for error status", () => {
    renderBar({ saveStatus: "error" });
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  test("shows a saved label for saved status", () => {
    renderBar({ saveStatus: "saved" });
    expect(screen.getByText(/^Saved/)).toBeInTheDocument();
  });
});

describe("StatusBar — zoom controls", () => {
  test("displays rounded zoom value with percent sign", () => {
    renderBar({ zoom: 79.6 });
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  test("zoom slider reflects zoom prop", () => {
    renderBar({ zoom: 80 });
    expect(screen.getByRole("slider")).toHaveValue("80");
  });

  test("changing the slider calls onZoomChange with a number", () => {
    const onZoomChange = vi.fn();
    renderBar({ onZoomChange });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "125" } });
    expect(onZoomChange).toHaveBeenCalledWith(125);
  });

  test("zoom buttons call onZoomIn / onZoomOut", () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    renderBar({ onZoomIn, onZoomOut });
    fireEvent.click(screen.getByTitle("Zoom In"));
    fireEvent.click(screen.getByTitle("Zoom Out"));
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
  });
});

describe("StatusBar — notes & comments toggles", () => {
  test("Notes button calls onToggleNotes and shows active state", () => {
    const onToggleNotes = vi.fn();
    renderBar({ onToggleNotes, showNotes: true });
    const notesButton = screen.getByRole("button", { name: "Notes" });
    expect(notesButton.className).toContain("active");
    fireEvent.click(notesButton);
    expect(onToggleNotes).toHaveBeenCalledOnce();
  });

  test("Comments button calls onToggleComments", () => {
    const onToggleComments = vi.fn();
    renderBar({ onToggleComments });
    fireEvent.click(screen.getByTitle("Toggle comments panel"));
    expect(onToggleComments).toHaveBeenCalledOnce();
  });

  test("Comments button shows count only when there are comments", () => {
    renderBar({ commentCount: 3 });
    expect(screen.getByText(/Comments \(3\)/)).toBeInTheDocument();
  });
});

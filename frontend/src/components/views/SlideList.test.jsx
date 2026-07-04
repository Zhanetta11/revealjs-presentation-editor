import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SlideList from "./SlideList";

// SlideThumbnail renders full slide content — not relevant for list behavior
vi.mock("../slides/SlideThumbnail", () => ({
  default: () => <div data-testid="slide-thumbnail" />,
}));

beforeAll(() => {
  // not implemented in jsdom
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const slides = [
  { title: { content: "Intro" } },
  { title: { content: "Agenda" }, hidden: true },
  {},
];

const renderList = (props = {}) =>
  render(
    <SlideList
      slides={slides}
      selectedSlideId={0}
      onSelectSlide={vi.fn()}
      onReorderSlide={vi.fn()}
      onDeleteSlide={vi.fn()}
      slideWidth={1280}
      slideHeight={720}
      presentation={{}}
      {...props}
    />,
  );

describe("SlideList — rendering", () => {
  test("renders one row with number and thumbnail per slide", () => {
    renderList();
    expect(screen.getAllByTestId("slide-thumbnail")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("uses slide title as item tooltip and falls back to slide number", () => {
    renderList();
    expect(screen.getByTitle("Intro")).toBeInTheDocument();
    expect(screen.getByTitle("Slide 3")).toBeInTheDocument();
  });

  test("selected slide item has active class", () => {
    renderList({ selectedSlideId: 0 });
    expect(screen.getByTitle("Intro").className).toContain("active");
    expect(screen.getByTitle("Slide 3").className).not.toContain("active");
  });

  test("hidden slide gets hidden-slide class and (hidden) tooltip", () => {
    renderList();
    const hiddenItem = screen.getByTitle("Agenda (hidden)");
    expect(hiddenItem.className).toContain("hidden-slide");
  });
});

describe("SlideList — selection & deletion", () => {
  test("clicking a slide calls onSelectSlide with its index", () => {
    const onSelectSlide = vi.fn();
    renderList({ onSelectSlide });
    fireEvent.click(screen.getByTitle("Slide 3"));
    expect(onSelectSlide).toHaveBeenCalledWith(2);
  });

  test("Delete key selects the slide and calls onDeleteSlide", () => {
    const onSelectSlide = vi.fn();
    const onDeleteSlide = vi.fn();
    renderList({ onSelectSlide, onDeleteSlide });
    fireEvent.keyDown(screen.getByTitle("Agenda (hidden)"), { key: "Delete" });
    expect(onSelectSlide).toHaveBeenCalledWith(1);
    expect(onDeleteSlide).toHaveBeenCalledOnce();
  });

  test("Delete key does nothing when only one slide is left", () => {
    const onDeleteSlide = vi.fn();
    renderList({
      slides: [{ title: { content: "Only" } }],
      onDeleteSlide,
    });
    fireEvent.keyDown(screen.getByTitle("Only"), { key: "Delete" });
    expect(onDeleteSlide).not.toHaveBeenCalled();
  });
});

describe("SlideList — drag & drop reorder", () => {
  test("dropping a dragged slide on another calls onReorderSlide and selects target", () => {
    const onReorderSlide = vi.fn();
    const onSelectSlide = vi.fn();
    renderList({ onReorderSlide, onSelectSlide });

    const dataTransfer = { effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByTitle("Intro"), { dataTransfer });
    fireEvent.dragOver(screen.getByTitle("Slide 3"), { dataTransfer });
    fireEvent.drop(screen.getByTitle("Slide 3"), { dataTransfer });

    expect(onReorderSlide).toHaveBeenCalledWith(0, 2);
    expect(onSelectSlide).toHaveBeenCalledWith(2);
  });

  test("dropping a slide on itself does not reorder", () => {
    const onReorderSlide = vi.fn();
    renderList({ onReorderSlide });

    const dataTransfer = { effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByTitle("Intro"), { dataTransfer });
    fireEvent.drop(screen.getByTitle("Intro"), { dataTransfer });

    expect(onReorderSlide).not.toHaveBeenCalled();
  });
});

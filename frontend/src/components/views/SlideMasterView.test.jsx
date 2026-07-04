import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SlideMasterRibbon } from "./SlideMasterView";

const presentation = {
  slideset: {
    master: {
      formatting: {},
      "slide-dimensions": { width: 1280, height: 720 },
      "color-theme": [],
    },
    layouts: [{ "layout-id": "layout-1", name: "Layout 1", placeholders: [] }],
    fonts: [],
  },
};

const openPlaceholderMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: /Insert\s*Placeholder/i }));
};

describe("SlideMasterRibbon placeholder commands", () => {
  test("Text creates a text placeholder rather than a decorative text element", () => {
    const onAddTextPlaceholder = vi.fn();
    const onAddContentPlaceholder = vi.fn();

    render(
      <SlideMasterRibbon
        presentation={presentation}
        selectedMasterLayoutId="layout-1"
        onAddTextPlaceholder={onAddTextPlaceholder}
        onAddContentPlaceholder={onAddContentPlaceholder}
      />,
    );

    openPlaceholderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    expect(onAddTextPlaceholder).toHaveBeenCalledOnce();
    expect(onAddContentPlaceholder).not.toHaveBeenCalled();
  });

  test("Text on the master (no layout) inserts a free text box, not a placeholder", () => {
    const onAddTextPlaceholder = vi.fn();
    const onAddTextElement = vi.fn();

    render(
      <SlideMasterRibbon
        presentation={presentation}
        selectedMasterLayoutId={null}
        onAddTextPlaceholder={onAddTextPlaceholder}
        onAddTextElement={onAddTextElement}
      />,
    );

    openPlaceholderMenu();
    const textButton = screen.getByRole("button", { name: "Text" });
    expect(textButton).not.toBeDisabled();
    fireEvent.click(textButton);

    expect(onAddTextElement).toHaveBeenCalledOnce();
    expect(onAddTextPlaceholder).not.toHaveBeenCalled();
  });

  test("Content placeholder command is disabled when no layout is selected", () => {
    render(
      <SlideMasterRibbon
        presentation={presentation}
        selectedMasterLayoutId={null}
        onAddContentPlaceholder={vi.fn()}
      />,
    );

    openPlaceholderMenu();

    expect(screen.getByRole("button", { name: "Content" })).toBeDisabled();
  });
});

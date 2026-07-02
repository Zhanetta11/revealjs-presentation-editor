import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CanvasContextMenu from "./CanvasContextMenu";

const renderMenu = (props = {}) =>
  render(
    <CanvasContextMenu
      x={100}
      y={100}
      hasSelection={false}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("CanvasContextMenu — canvas context", () => {
  test("shows Undo and Redo items", () => {
    renderMenu({ contextType: "canvas" });
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText("Redo")).toBeInTheDocument();
  });

  test("Undo is disabled when canUndo is false", () => {
    renderMenu({ contextType: "canvas", canUndo: false });
    expect(screen.getByText("Undo").closest("button")).toBeDisabled();
  });

  test("Undo is enabled when canUndo is true", () => {
    renderMenu({ contextType: "canvas", canUndo: true });
    expect(screen.getByText("Undo").closest("button")).not.toBeDisabled();
  });

  test("calls onUndo and onClose when Undo is clicked", async () => {
    const onUndo = vi.fn();
    const onClose = vi.fn();
    renderMenu({ contextType: "canvas", canUndo: true, onUndo, onClose });
    fireEvent.click(screen.getByText("Undo").closest("button"));
    expect(onUndo).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("does not show text-only search input", () => {
    renderMenu({ contextType: "canvas" });
    expect(screen.queryByPlaceholderText("Search the menus")).not.toBeInTheDocument();
  });
});

describe("CanvasContextMenu — text context", () => {
  test("shows search input for text context", () => {
    renderMenu({ contextType: "text" });
    expect(screen.getByPlaceholderText("Search the menus")).toBeInTheDocument();
  });

  test("does not show Undo/Redo for text context", () => {
    renderMenu({ contextType: "text" });
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
    expect(screen.queryByText("Redo")).not.toBeInTheDocument();
  });

  test("shows Hyperlink... when existingHyperlink is null", () => {
    renderMenu({ contextType: "text", existingHyperlink: null, onHyperlink: vi.fn() });
    expect(screen.getByText("Hyperlink...")).toBeInTheDocument();
  });

  test("shows Edit Link / Remove Link when existingHyperlink is set", () => {
    renderMenu({
      contextType: "text",
      existingHyperlink: { href: "https://example.com" },
      onHyperlink: vi.fn(),
    });
    expect(screen.getByText("Edit Link")).toBeInTheDocument();
    expect(screen.getByText("Remove Link")).toBeInTheDocument();
    expect(screen.queryByText("Hyperlink...")).not.toBeInTheDocument();
  });

  test("hides hyperlink items when no onHyperlink handler is provided (Slide Master)", () => {
    renderMenu({ contextType: "text", existingHyperlink: null });
    expect(screen.queryByText("Hyperlink...")).not.toBeInTheDocument();
  });

  test("search filters menu items", () => {
    renderMenu({ contextType: "text" });
    fireEvent.change(screen.getByPlaceholderText("Search the menus"), {
      target: { value: "font" },
    });
    expect(screen.getByText("Font...")).toBeInTheDocument();
    expect(screen.queryByText("Paragraph...")).not.toBeInTheDocument();
  });

  test.each([
    ["Use Destination Theme", "destination"],
    ["Keep Source Formatting", "source"],
    ["Keep Text Only", "text"],
  ])("%s calls the matching text paste mode", async (label, mode) => {
    const onPasteText = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    renderMenu({ contextType: "text", onPasteText, onClose });

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() =>
      expect(onPasteText).toHaveBeenCalledWith(undefined, mode),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test("Picture calls the picture paste handler", async () => {
    const onPastePicture = vi.fn().mockResolvedValue(true);
    renderMenu({ contextType: "text", onPastePicture });

    fireEvent.click(screen.getByRole("button", { name: "Picture" }));

    await waitFor(() =>
      expect(onPastePicture).toHaveBeenCalledWith(undefined),
    );
  });

  test("keeps the menu open and reports unavailable clipboard content", async () => {
    const onPasteText = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    renderMenu({ contextType: "text", onPasteText, onClose });

    fireEvent.click(
      screen.getByRole("button", { name: "Use Destination Theme" }),
    );

    expect(
      await screen.findByText(
        "Clipboard content is not available for this paste option.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CanvasContextMenu — dialog switching", () => {
  test("switches to FontDialog when Font... is clicked", () => {
    renderMenu({ contextType: "text" });
    fireEvent.click(screen.getByText("Font..."));
    expect(screen.getByRole("dialog", { name: "Font" })).toBeInTheDocument();
  });

  test("switches to ParagraphDialog when Paragraph... is clicked", () => {
    renderMenu({ contextType: "text" });
    fireEvent.click(screen.getByText("Paragraph..."));
    expect(screen.getByRole("dialog", { name: "Paragraph" })).toBeInTheDocument();
  });

  test("switches to HyperlinkDialog when Hyperlink... is clicked", () => {
    renderMenu({ contextType: "text", existingHyperlink: null, onHyperlink: vi.fn() });
    fireEvent.click(screen.getByText("Hyperlink..."));
    expect(screen.getByRole("form", { name: "Hyperlink" })).toBeInTheDocument();
  });
});

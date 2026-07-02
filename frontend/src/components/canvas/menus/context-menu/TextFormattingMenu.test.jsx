import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TextFormattingMenu from "./TextFormattingMenu";

const renderMenu = (props = {}) => {
  const defaults = {
    elementId: "el-1",
    formatting: {},
    matches: () => true,
    submenu: null,
    setSubmenu: vi.fn(),
    setDialog: vi.fn(),
    run: vi.fn((fn) => fn?.()),
    onExitEditText: vi.fn(),
    onNewComment: vi.fn(),
    applyFormatting: vi.fn(),
  };
  return render(<TextFormattingMenu {...defaults} {...props} />);
};

describe("TextFormattingMenu — hyperlink section", () => {
  test("shows Hyperlink... when existingLink is null", () => {
    renderMenu({ existingLink: null });
    expect(screen.getByText("Hyperlink...")).toBeInTheDocument();
    expect(screen.queryByText("Edit Link")).not.toBeInTheDocument();
  });

  test("shows Edit/Open/Copy/Remove Link when existingLink is set", () => {
    renderMenu({ existingLink: { href: "https://example.com" } });
    expect(screen.getByText("Edit Link")).toBeInTheDocument();
    expect(screen.getByText("Open Link")).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
    expect(screen.getByText("Remove Link")).toBeInTheDocument();
    expect(screen.queryByText("Hyperlink...")).not.toBeInTheDocument();
  });

  test("clicking Hyperlink... calls setDialog('hyperlink')", () => {
    const setDialog = vi.fn();
    renderMenu({ existingLink: null, setDialog });
    fireEvent.click(screen.getByText("Hyperlink..."));
    expect(setDialog).toHaveBeenCalledWith("hyperlink");
  });

  test("clicking Edit Link calls setDialog('hyperlink')", () => {
    const setDialog = vi.fn();
    renderMenu({ existingLink: { href: "https://example.com" }, setDialog });
    fireEvent.click(screen.getByText("Edit Link"));
    expect(setDialog).toHaveBeenCalledWith("hyperlink");
  });

  test("clicking Remove Link calls run with onRemoveLink", () => {
    const onRemoveLink = vi.fn();
    const run = vi.fn((fn) => fn?.());
    renderMenu({ existingLink: { href: "https://example.com" }, onRemoveLink, run });
    fireEvent.click(screen.getByText("Remove Link"));
    expect(run).toHaveBeenCalled();
    expect(onRemoveLink).toHaveBeenCalled();
  });

  test("clicking Open Link calls window.open with the href", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => {});
    renderMenu({ existingLink: { href: "https://example.com" } });
    fireEvent.click(screen.getByText("Open Link"));
    expect(open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  test("clicking Open Link on a slide link navigates instead of opening a window", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => {});
    const onNavigateToSlide = vi.fn();
    renderMenu({ existingLink: { href: "#slide-3" }, onNavigateToSlide });
    fireEvent.click(screen.getByText("Open Link"));
    expect(onNavigateToSlide).toHaveBeenCalledWith(2);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("TextFormattingMenu — visibility via matches", () => {
  test("hides Hyperlink section when matches('Hyperlink') returns false", () => {
    renderMenu({ matches: (key) => key !== "Hyperlink" });
    expect(screen.queryByText("Hyperlink...")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Link")).not.toBeInTheDocument();
  });

  test("hides Font item when matches('Font') returns false", () => {
    renderMenu({ matches: (key) => key !== "Font" });
    expect(screen.queryByText("Font...")).not.toBeInTheDocument();
  });

  test("shows Font... when matches('Font') returns true", () => {
    renderMenu({ matches: (key) => key === "Font" });
    expect(screen.getByText("Font...")).toBeInTheDocument();
  });

  test("clicking Font... calls setDialog('font')", () => {
    const setDialog = vi.fn();
    renderMenu({ matches: (key) => key === "Font", setDialog });
    fireEvent.click(screen.getByText("Font..."));
    expect(setDialog).toHaveBeenCalledWith("font");
  });
});

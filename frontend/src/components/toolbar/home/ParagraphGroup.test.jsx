import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ParagraphGroup from "./ParagraphGroup";

const renderGroup = (props = {}) =>
  render(
    <ParagraphGroup
      isTextSelected
      onFormatChange={vi.fn()}
      {...props}
    />,
  );

describe("ParagraphGroup — alignment buttons", () => {
  test("renders all four alignment buttons", () => {
    renderGroup();
    expect(screen.getByTitle("Align left")).toBeInTheDocument();
    expect(screen.getByTitle("Align center")).toBeInTheDocument();
    expect(screen.getByTitle("Align right")).toBeInTheDocument();
    expect(screen.getByTitle("Align justify")).toBeInTheDocument();
  });

  test("left align button has active class by default", () => {
    renderGroup({ currentFormatting: { align: "left" } });
    expect(screen.getByTitle("Align left").className).toContain("active");
  });

  test("center align button has active class when align is center", () => {
    renderGroup({ currentFormatting: { align: "center" } });
    expect(screen.getByTitle("Align center").className).toContain("active");
  });

  test("clicking center calls onFormatChange with align: center", () => {
    const onFormatChange = vi.fn();
    renderGroup({ onFormatChange });
    fireEvent.click(screen.getByTitle("Align center"));
    expect(onFormatChange).toHaveBeenCalledWith({ align: "center" });
  });

  test("alignment buttons are disabled when isTextSelected is false", () => {
    renderGroup({ isTextSelected: false });
    expect(screen.getByTitle("Align left")).toBeDisabled();
    expect(screen.getByTitle("Align center")).toBeDisabled();
  });

  test("onFormatChange is NOT called when buttons are disabled", () => {
    const onFormatChange = vi.fn();
    renderGroup({ isTextSelected: false, onFormatChange });
    fireEvent.click(screen.getByTitle("Align right"));
    expect(onFormatChange).not.toHaveBeenCalled();
  });
});

describe("ParagraphGroup — indent buttons", () => {
  test("Decrease indent is disabled at indent level 0", () => {
    renderGroup({ currentFormatting: { "indent-level": 0 } });
    expect(screen.getByTitle("Decrease indent")).toBeDisabled();
  });

  test("Decrease indent is enabled when indent level > 0", () => {
    renderGroup({ currentFormatting: { "indent-level": 1 } });
    expect(screen.getByTitle("Decrease indent")).not.toBeDisabled();
  });

  test("clicking Increase indent calls onFormatChange with indent-level + 1", () => {
    const onFormatChange = vi.fn();
    renderGroup({
      currentFormatting: { "indent-level": 1 },
      onFormatChange,
    });
    fireEvent.click(screen.getByTitle("Increase indent"));
    expect(onFormatChange).toHaveBeenCalledWith({ "indent-level": 2 });
  });

  test("clicking Decrease indent calls onFormatChange with indent-level - 1", () => {
    const onFormatChange = vi.fn();
    renderGroup({
      currentFormatting: { "indent-level": 2 },
      onFormatChange,
    });
    fireEvent.click(screen.getByTitle("Decrease indent"));
    expect(onFormatChange).toHaveBeenCalledWith({ "indent-level": 1 });
  });
});

describe("ParagraphGroup — list buttons", () => {
  test("Bulleted list button has active class when list-type is bullets", () => {
    renderGroup({ currentFormatting: { "list-type": "bullets" } });
    expect(screen.getByTitle("Bulleted list").className).toContain("active");
  });

  test("clicking Bulleted list activates bullets with default marker", () => {
    const onFormatChange = vi.fn();
    renderGroup({ currentFormatting: {}, onFormatChange });
    fireEvent.click(screen.getByTitle("Bulleted list"));
    expect(onFormatChange).toHaveBeenCalledWith(
      expect.objectContaining({ "list-type": "bullets" }),
    );
  });

  test("clicking active Bulleted list deactivates it", () => {
    const onFormatChange = vi.fn();
    renderGroup({
      currentFormatting: { "list-type": "bullets" },
      onFormatChange,
    });
    fireEvent.click(screen.getByTitle("Bulleted list"));
    expect(onFormatChange).toHaveBeenCalledWith(
      expect.objectContaining({ "list-type": "none" }),
    );
  });

  test("clicking active Numbered list stores an explicit none override", () => {
    const onFormatChange = vi.fn();
    renderGroup({
      currentFormatting: { "list-type": "numbered" },
      onFormatChange,
    });
    fireEvent.click(screen.getByTitle("Numbered list"));
    expect(onFormatChange).toHaveBeenCalledWith(
      expect.objectContaining({ "list-type": "none" }),
    );
  });
});

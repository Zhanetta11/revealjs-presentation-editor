import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ParagraphDialog from "./ParagraphDialog";

const renderDialog = (props = {}) =>
  render(<ParagraphDialog onApply={vi.fn()} onClose={vi.fn()} {...props} />);

describe("ParagraphDialog", () => {
  test("renders dialog with alignment select and OK/Cancel buttons", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Paragraph" })).toBeInTheDocument();
    expect(screen.getByLabelText(/alignment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("calls onClose when × button is clicked", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("calls onApply and onClose when OK is clicked", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onApply, onClose });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("pre-fills alignment from formatting.align", () => {
    renderDialog({ formatting: { align: "center" } });
    expect(screen.getByLabelText(/alignment/i).value).toBe("center");
  });

  test("onApply receives selected alignment", () => {
    const onApply = vi.fn();
    renderDialog({ onApply, formatting: { align: "left" } });
    fireEvent.change(screen.getByLabelText(/alignment/i), {
      target: { value: "right" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ align: "right" }),
    );
  });

  test("onApply receives margin string from Before/After inputs", () => {
    const onApply = vi.fn();
    renderDialog({ onApply });
    // spinbuttons order: [0] indent "Before text", [1] "By", [2] spacing "Before", [3] "After", [4] "At"
    const beforeInput = screen.getAllByRole("spinbutton")[2];
    fireEvent.change(beforeInput, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ margin: expect.stringContaining("12px") }),
    );
  });

  test("onApply stores Before text as a rendered distance", () => {
    const onApply = vi.fn();
    renderDialog({ onApply });
    const beforeTextInput = screen.getAllByRole("spinbutton")[0];

    fireEvent.change(beforeTextInput, { target: { value: "36" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ "before-text": 36 }),
    );
  });

  test("onApply receives line-spacing as string", () => {
    const onApply = vi.fn();
    renderDialog({ onApply, formatting: { "line-spacing": "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ "line-spacing": "1.5" }),
    );
  });

  test("pre-fills line spacing mode from formatting.line-spacing", () => {
    renderDialog({ formatting: { "line-spacing": "2" } });
    expect(screen.getByLabelText(/line spacing/i).value).toBe("double");
  });

  test("Line Spacing preset controls At field like Word", () => {
    renderDialog();
    const lineSpacingSelect = screen.getByLabelText(/line spacing/i);
    const atInput = screen.getByLabelText(/^at:/i);

    expect(atInput).not.toBeDisabled();

    fireEvent.change(lineSpacingSelect, { target: { value: "single" } });
    expect(atInput).toBeDisabled();
    expect(atInput.value).toBe("1");

    fireEvent.change(lineSpacingSelect, { target: { value: "double" } });
    expect(atInput).toBeDisabled();
    expect(atInput.value).toBe("2");

    fireEvent.change(lineSpacingSelect, { target: { value: "multiple" } });
    expect(atInput).not.toBeDisabled();
  });

  test("onApply uses selected line spacing preset", () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.change(screen.getByLabelText(/line spacing/i), {
      target: { value: "single" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ "line-spacing": "1" }),
    );
  });

  test("Special controls whether By is enabled", () => {
    renderDialog();
    const specialSelect = screen.getByLabelText(/special/i);
    const byInput = screen.getByLabelText(/by/i);

    expect(byInput).toBeDisabled();

    fireEvent.change(specialSelect, { target: { value: "first-line" } });
    expect(byInput).not.toBeDisabled();

    fireEvent.change(specialSelect, { target: { value: "none" } });
    expect(byInput).toBeDisabled();
  });

  test("onApply includes special indent settings", () => {
    const onApply = vi.fn();
    renderDialog({ onApply });

    fireEvent.change(screen.getByLabelText(/special/i), {
      target: { value: "hanging" },
    });
    fireEvent.change(screen.getByLabelText(/by/i), {
      target: { value: "18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        "special-indent": "hanging",
        "special-indent-by": 18,
        "text-indent": "-18px",
      }),
    );
  });

  test("selecting no special indent explicitly clears inherited indentation", () => {
    const onApply = vi.fn();
    renderDialog({
      onApply,
      formatting: {
        "special-indent": "first-line",
        "special-indent-by": 18,
        "text-indent": "18px",
      },
    });

    fireEvent.change(screen.getByLabelText(/special/i), {
      target: { value: "none" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        "special-indent": "none",
        "special-indent-by": 0,
        "text-indent": "0px",
      }),
    );
  });

  test("does not overwrite unchanged mixed paragraph values", () => {
    const onApply = vi.fn();
    renderDialog({
      onApply,
      formatting: {
        align: "mixed",
        "before-text": "mixed",
        margin: "mixed",
        "line-spacing": "mixed",
        "special-indent": "mixed",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply).toHaveBeenCalledWith({});
  });
});

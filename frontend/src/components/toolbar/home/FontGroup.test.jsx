import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FontGroup from "./FontGroup";

const CUSTOM_FONT = "MyCustomFont";

const basePresentation = {
  slideset: {
    fonts: [{ "font-id": CUSTOM_FONT, "font-file": "myfont.ttf" }],
  },
};

const renderGroup = (props = {}) =>
  render(
    <FontGroup
      fonts={["Arial", CUSTOM_FONT]}
      isTextSelected
      onFormatChange={vi.fn()}
      {...props}
    />,
  );

describe("FontGroup — remove font button", () => {
  test("remove button is disabled when no font is selected", () => {
    renderGroup({ currentFormatting: {} });
    expect(
      screen.getByRole("button", { name: /remove uploaded font/i }),
    ).toBeDisabled();
  });

  test("remove button is disabled for a default font", () => {
    renderGroup({
      currentFormatting: { font: "Arial" },
      presentation: basePresentation,
      onFontRemove: vi.fn(),
    });
    expect(
      screen.getByRole("button", { name: /remove uploaded font/i }),
    ).toBeDisabled();
  });

  test("remove button is enabled for an uploaded custom font", () => {
    renderGroup({
      currentFormatting: { font: CUSTOM_FONT },
      presentation: basePresentation,
      onFontRemove: vi.fn(),
    });
    expect(
      screen.getByRole("button", { name: /remove uploaded font/i }),
    ).not.toBeDisabled();
  });

  test("remove button is disabled when onFontRemove is not provided", () => {
    renderGroup({
      currentFormatting: { font: CUSTOM_FONT },
      presentation: basePresentation,
    });
    expect(
      screen.getByRole("button", { name: /remove uploaded font/i }),
    ).toBeDisabled();
  });

  test("clicking remove button shows confirm and calls onFontRemove on confirm", async () => {
    const onFontRemove = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderGroup({
      currentFormatting: { font: CUSTOM_FONT },
      presentation: basePresentation,
      onFontRemove,
    });
    fireEvent.click(screen.getByRole("button", { name: /remove uploaded font/i }));
    await waitFor(() => expect(onFontRemove).toHaveBeenCalledWith(CUSTOM_FONT));
    expect(window.confirm).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  test("clicking remove button does NOT call onFontRemove when confirm is cancelled", async () => {
    const onFontRemove = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderGroup({
      currentFormatting: { font: CUSTOM_FONT },
      presentation: basePresentation,
      onFontRemove,
    });
    fireEvent.click(screen.getByRole("button", { name: /remove uploaded font/i }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(onFontRemove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("FontGroup — formatting buttons", () => {
  test("Bold button has active class when weight is bold", () => {
    renderGroup({ currentFormatting: { weight: "bold" } });
    expect(screen.getByTitle("Bold").className).toContain("active");
  });

  test("Bold button does not have active class when weight is normal", () => {
    renderGroup({ currentFormatting: { weight: "normal" } });
    expect(screen.getByTitle("Bold").className).not.toContain("active");
  });

  test("clicking Bold calls onFormatChange with weight: bold", () => {
    const onFormatChange = vi.fn();
    renderGroup({ currentFormatting: { weight: "normal" }, onFormatChange });
    fireEvent.click(screen.getByTitle("Bold"));
    expect(onFormatChange).toHaveBeenCalledWith({ weight: "bold" });
  });

  test("formatting buttons are disabled when isTextSelected is false", () => {
    renderGroup({ isTextSelected: false });
    expect(screen.getByTitle("Bold")).toBeDisabled();
    expect(screen.getByTitle("Italic")).toBeDisabled();
    expect(screen.getByTitle("Underline")).toBeDisabled();
  });
});

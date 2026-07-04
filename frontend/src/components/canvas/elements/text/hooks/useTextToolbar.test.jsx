import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useTextToolbar from "./useTextToolbar";

describe("useTextToolbar", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("preserves live text editing when the popup reselects its element", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.className = "text-editable";
    editable.textContent = "Selected text";
    document.body.appendChild(editable);

    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);

    const onSelect = vi.fn();
    const rememberSelection = vi.fn();
    const { result } = renderHook(() =>
      useTextToolbar({
        editableRef: { current: editable },
        elementRef: { current: wrapper },
        textElementId: "text-1",
        isPrimarySelected: true,
        clearSelectionSignal: 0,
        onSelect,
        rememberSelection,
      }),
    );

    act(() => {
      result.current.open();
    });

    expect(onSelect).toHaveBeenCalledWith("text-1", {
      preserveTextEditing: true,
    });
  });
});

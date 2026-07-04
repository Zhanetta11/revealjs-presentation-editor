import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import useTextSelection from "./useTextSelection";

const createEditable = () => {
  const editable = document.createElement("div");
  const paragraph = document.createElement("div");
  paragraph.dataset.paragraphIndex = "0";
  paragraph.textContent = "Title placeholder";
  editable.appendChild(paragraph);
  document.body.appendChild(editable);
  return { editable, textNode: paragraph.firstChild };
};

const selectText = (textNode, start, end) => {
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
};

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

describe("useTextSelection lifecycle", () => {
  test("clears a stored range and accepts a fresh live range afterwards", async () => {
    const { editable, textNode } = createEditable();
    const editableRef = { current: editable };
    const onSaveSelection = vi.fn();
    const { result, rerender } = renderHook(
      ({ clearSelectionSignal }) =>
        useTextSelection({
          editableRef,
          textElementId: "title-placeholder",
          clearSelectionSignal,
          onSaveSelection,
        }),
      { initialProps: { clearSelectionSignal: 0 } },
    );

    selectText(textNode, 0, 5);
    act(() => result.current.saveCurrentSelection());

    expect(result.current.savedSelection).toEqual({
      paragraphIdx: 0,
      rangeStart: 0,
      endParagraphIdx: 0,
      rangeEnd: 5,
    });
    expect(onSaveSelection).toHaveBeenLastCalledWith(
      "title-placeholder",
      expect.objectContaining({ rangeStart: 0, rangeEnd: 5 }),
    );

    rerender({ clearSelectionSignal: 1 });
    await waitFor(() => expect(result.current.savedSelection).toBeNull());

    selectText(textNode, 6, 17);
    act(() => result.current.saveCurrentSelection());

    expect(result.current.savedSelection).toEqual({
      paragraphIdx: 0,
      rangeStart: 6,
      endParagraphIdx: 0,
      rangeEnd: 17,
    });
  });

  test("explicit blur-style clearing notifies the controller with null", () => {
    const { editable, textNode } = createEditable();
    const onSaveSelection = vi.fn();
    const { result } = renderHook(() =>
      useTextSelection({
        editableRef: { current: editable },
        textElementId: "body-placeholder",
        clearSelectionSignal: 0,
        onSaveSelection,
      }),
    );

    selectText(textNode, 0, 4);
    act(() => result.current.saveCurrentSelection());
    act(() => result.current.clearSavedSelection());

    expect(result.current.savedSelection).toBeNull();
    expect(onSaveSelection).toHaveBeenLastCalledWith(
      "body-placeholder",
      null,
    );
  });
});

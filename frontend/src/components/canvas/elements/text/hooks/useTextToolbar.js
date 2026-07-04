import { useCallback, useEffect, useRef, useState } from "react";
import { getSelectionOffsets } from "../../../../../core/text/domSelectionManager";

const TOOLBAR_WIDTH = 590;

export default function useTextToolbar({
  editableRef,
  elementRef,
  textElementId,
  isPrimarySelected,
  clearSelectionSignal,
  onSelect,
  rememberSelection,
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const selectionFrameRef = useRef(null);

  const updatePosition = useCallback(
    (anchorPoint = null) => {
      window.setTimeout(() => {
        const editable = editableRef.current;
        const wrapper = elementRef.current;
        const selection = window.getSelection();
        let rect = null;

        if (anchorPoint) {
          rect = {
            top: anchorPoint.y,
            bottom: anchorPoint.y,
            left: anchorPoint.x,
          };
        }
        if (editable && selection?.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (!rect && editable.contains(range.startContainer)) {
            const rangeRect = range.getBoundingClientRect();
            if (rangeRect && !(rangeRect.top === 0 && rangeRect.left === 0)) {
              rect = rangeRect;
            }
          }
        }
        if (!rect && wrapper) rect = wrapper.getBoundingClientRect();
        if (!rect) return;

        const toolbarHeight = 80;
        const topAbove = rect.top - toolbarHeight - 8;
        const top = topAbove > 0 ? topAbove : rect.bottom + 8;
        const left = Math.max(
          8,
          Math.min(rect.left, window.innerWidth - TOOLBAR_WIDTH - 8),
        );
        setPosition((previous) =>
          previous.top === top && previous.left === left
            ? previous
            : { top, left },
        );
      }, 0);
    },
    [editableRef, elementRef],
  );

  const open = useCallback(
    (anchorPoint = null) => {
      onSelect(textElementId, { preserveTextEditing: true });
      setIsOpen(true);
      updatePosition(anchorPoint);
    },
    [onSelect, textElementId, updatePosition],
  );

  const syncWithSelection = useCallback(() => {
    const editable = editableRef.current;
    if (!editable || document.activeElement !== editable) return;
    if (document.activeElement?.closest?.(".format-toolbar")) return;

    const selection = window.getSelection();
    const hasTextSelection =
      selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      editable.contains(selection.getRangeAt(0).startContainer) &&
      editable.contains(selection.getRangeAt(0).endContainer);

    if (!hasTextSelection) {
      setIsOpen(false);
      return;
    }

    const offsets = getSelectionOffsets(editable);
    if (!offsets) return;
    rememberSelection(offsets);
    open();
  }, [editableRef, open, rememberSelection]);

  useEffect(() => {
    if (isPrimarySelected && isOpen) updatePosition();
  }, [isPrimarySelected, isOpen, updatePosition]);

  useEffect(() => {
    if (clearSelectionSignal === 0) return undefined;
    const timeoutId = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [clearSelectionSignal]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (selectionFrameRef.current) {
        cancelAnimationFrame(selectionFrameRef.current);
      }
      selectionFrameRef.current = requestAnimationFrame(() => {
        selectionFrameRef.current = null;
        syncWithSelection();
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionFrameRef.current) {
        cancelAnimationFrame(selectionFrameRef.current);
      }
    };
  }, [syncWithSelection]);

  return {
    position,
    isOpen,
    setIsOpen,
    open,
    updatePosition,
    syncWithSelection,
  };
}

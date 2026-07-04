import { useCallback, useEffect, useState } from "react";
import { isRedoShortcut, isUndoShortcut } from "../../core/events/keyboardShortcuts";
import { getSlideElement } from "../../core/operations/slideOperations";
import { createZOrderUpdates } from "../../core/operations/zOrderOperations";

export function useEditorCommandsController({
  selectedSlide,
  selectedSlideIndex,
  selectedElementId,
  selectedElementIds,
  selectedElements,
  selectedTextElement,
  editingTextElementId,
  layoutTextIds,
  selectedMasterLayoutId,
  clearTextEditingState,
  selectElement,
  selectElements,
  updateElement,
  updateElements,
  updateElementPosition,
  deleteSelectedElements,
  toggleSlideHidden,
  applyTransitionToAll,
  currentTransition,
  currentDuration,
  updateTextElementParagraphs,
  addLayout,
  setIsSlideMasterOpen,
  setSelectedMasterLayoutId,
  updateMasterElement,
  beginHistory,
  commitHistory,
  undo,
  redo,
}) {
  const [objectSelectionMode, setObjectSelectionMode] = useState(false);

  const arrangeSelectedElement = useCallback(
    (mode) => {
      if (selectedElementIds.length === 0 || !selectedSlide) return;
      const updates = createZOrderUpdates(
        selectedSlide,
        selectedElementIds,
        mode,
      );
      if (updates.length > 0) updateElements(updates);
    },
    [selectedElementIds, selectedSlide, updateElements],
  );
  const handleBringToFront = useCallback(
    () => arrangeSelectedElement("front"),
    [arrangeSelectedElement],
  );
  const handleSendToBack = useCallback(
    () => arrangeSelectedElement("back"),
    [arrangeSelectedElement],
  );
  const handleBringForward = useCallback(
    () => arrangeSelectedElement("forward"),
    [arrangeSelectedElement],
  );
  const handleSendBackward = useCallback(
    () => arrangeSelectedElement("backward"),
    [arrangeSelectedElement],
  );
  const handleRotateRight = useCallback(() => {
    if (selectedElements.length === 0) return;
    beginHistory();
    selectedElements.forEach((element) => {
      updateElement(element.id, {
        rotation: (Number(element.rotation ?? 0) + 90) % 360,
      });
    });
    commitHistory();
  }, [selectedElements, updateElement, beginHistory, commitHistory]);

  const handleElementSelect = useCallback(
    (elementId, options = {}) => {
      const event = options?.nativeEvent ?? options;
      const isLiveTextPointer = Boolean(
        event?.target?.closest?.('.text-editable[contenteditable="true"]'),
      );
      const preserveTextEditing = options?.preserveTextEditing === true;
      if (
        !preserveTextEditing &&
        (!isLiveTextPointer || elementId !== selectedElementId)
      ) {
        clearTextEditingState();
      }
      selectElement(elementId, {
        toggle: Boolean(
          options?.toggle ||
            event?.ctrlKey ||
            event?.metaKey ||
            event?.shiftKey,
        ),
        preserveIfSelected: options?.preserveIfSelected,
      });
    },
    [clearTextEditingState, selectElement, selectedElementId],
  );

  const handleMoveElement = useCallback(
    (elementId, x, y) => {
      const element = getSlideElement(selectedSlide, elementId);
      if (!element) return;
      const isGroupMove =
        selectedElementIds.length > 1 &&
        selectedElementIds.includes(elementId);
      if (!isGroupMove) {
        updateElementPosition(elementId, x, y);
        return;
      }
      const deltaX = x - (element.position?.x ?? 0);
      const deltaY = y - (element.position?.y ?? 0);
      beginHistory();
      selectedElements.forEach((selected) => {
        updateElementPosition(
          selected.id,
          (selected.position?.x ?? 0) + deltaX,
          (selected.position?.y ?? 0) + deltaY,
        );
      });
      commitHistory();
    },
    [
      beginHistory,
      commitHistory,
      selectedElementIds,
      selectedElements,
      selectedSlide,
      updateElementPosition,
    ],
  );

  const handleSetElementsVisibility = useCallback(
    (elementIds, hidden) =>
      updateElements(
        elementIds.map((elementId) => ({
          elementId,
          updates: { hidden },
        })),
      ),
    [updateElements],
  );
  const handleMoveSelectionLayer = useCallback(
    (direction) =>
      arrangeSelectedElement(direction < 0 ? "forward" : "backward"),
    [arrangeSelectedElement],
  );
  const handleDeleteSelection = useCallback(() => {
    const layoutIds = selectedElementIds.filter((id) =>
      layoutTextIds.has(id),
    );
    const regularIds = selectedElementIds.filter(
      (id) => !layoutTextIds.has(id),
    );
    layoutIds.forEach((id) => updateElement(id, { hidden: true }));
    if (regularIds.length > 0) deleteSelectedElements(regularIds);
  }, [
    deleteSelectedElements,
    layoutTextIds,
    selectedElementIds,
    updateElement,
  ]);

  const handleSelectAll = useCallback(() => {
    if (
      selectedTextElement &&
      editingTextElementId === selectedTextElement.id
    ) {
      const editable = document.querySelector(
        `[data-element-id="${selectedTextElement.id}"] [contenteditable="true"]`,
      );
      if (editable) {
        const range = document.createRange();
        range.selectNodeContents(editable);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        editable.focus();
        return;
      }
    }
    selectElements([
      ...(selectedSlide?.contents?.text ?? []),
      ...(selectedSlide?.contents?.media ?? []),
    ].map((element) => element.id));
  }, [
    editingTextElementId,
    selectedSlide,
    selectedTextElement,
    selectElements,
  ]);
  const handleSelectObjects = useCallback(
    () => setObjectSelectionMode((active) => !active),
    [],
  );
  const handleToggleSlideHidden = useCallback(
    () => toggleSlideHidden(selectedSlideIndex),
    [toggleSlideHidden, selectedSlideIndex],
  );
  const handleApplyTransitionToAll = useCallback(
    () => applyTransitionToAll(currentTransition, currentDuration),
    [applyTransitionToAll, currentTransition, currentDuration],
  );
  const handleChangeParagraphs = useCallback(
    (elementId, paragraphs, grouped = false, userModified = true) =>
      updateTextElementParagraphs(
        selectedSlideIndex,
        elementId,
        paragraphs,
        grouped,
        userModified,
      ),
    [updateTextElementParagraphs, selectedSlideIndex],
  );
  const handleAddLayout = useCallback(
    () => addLayout(selectedMasterLayoutId),
    [addLayout, selectedMasterLayoutId],
  );
  const handleCloseSlideMasterView = useCallback(() => {
    setIsSlideMasterOpen(false);
    setSelectedMasterLayoutId(null);
  }, [setIsSlideMasterOpen, setSelectedMasterLayoutId]);
  const handleUpdateMasterElementPosition = useCallback(
    (id, x, y) => updateMasterElement(id, { position: { x, y } }),
    [updateMasterElement],
  );
  const handleUpdateMasterElementSize = useCallback(
    (id, width, height) =>
      updateMasterElement(id, { width, height }),
    [updateMasterElement],
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (isUndoShortcut(event)) {
        event.preventDefault();
        undo();
      } else if (isRedoShortcut(event)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    objectSelectionMode,
    handleBringToFront,
    handleSendToBack,
    handleBringForward,
    handleSendBackward,
    handleRotateRight,
    handleElementSelect,
    handleMoveElement,
    handleSetElementsVisibility,
    handleMoveSelectionLayer,
    handleDeleteSelection,
    handleSelectAll,
    handleSelectObjects,
    handleToggleSlideHidden,
    handleApplyTransitionToAll,
    handleChangeParagraphs,
    handleAddLayout,
    handleCloseSlideMasterView,
    handleUpdateMasterElementPosition,
    handleUpdateMasterElementSize,
  };
}

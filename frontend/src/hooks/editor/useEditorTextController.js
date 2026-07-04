import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { computeFormattingState } from "../../core/operations/formattingState";
import {
  getSelectedLink,
  getSelectedPlainText,
} from "./editorControllerHelpers";
import { useApplyFormatting } from "./useApplyFormatting";

export function useEditorTextController({
  presentation,
  selectedSlide,
  selectedElementId,
  activeTextElement,
  activeElementId,
  isSlideMasterOpen,
  updateTextRangeFormatting,
  updateTextElementFormatting,
  updateParagraphFormatting,
}) {
  const [masterActiveSelection, setMasterActiveSelection] = useState(null);
  const [editingTextElementId, setEditingTextElementId] = useState(null);
  const editingTextElementIdRef = useRef(null);
  const [pendingFormatting, setPendingFormatting] = useState({});
  const activeSelectionRef = useRef(null);
  const [activeSelection, setActiveSelection] = useState(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);

  useEffect(() => {
    if (
      activeSelectionRef.current &&
      activeSelectionRef.current.elementId !== selectedElementId
    ) {
      activeSelectionRef.current = null;
      setActiveSelection(null);
    }
  }, [selectedElementId]);

  useEffect(() => {
    if (!selectedElementId) return;
    const handler = (event) => {
      if (!activeSelectionRef.current) return;
      const inToolbar =
        event.target.closest?.(".format-toolbar") ||
        event.target.closest?.(".toolbar-ribbon") ||
        event.target.closest?.(".toolbar") ||
        event.target.closest?.(".bg-palette-popup") ||
        event.target.closest?.(".sz-dropdown") ||
        event.target.closest?.(".canvas-context-menu") ||
        event.target.closest?.(".text-context-dialog");
      const inElement = event.target.closest?.(
        `[data-element-id="${selectedElementId}"]`,
      );
      if (!inElement && !inToolbar) {
        activeSelectionRef.current = null;
        setActiveSelection(null);
        setClearSelectionSignal((value) => value + 1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedElementId]);

  const activeSelectionForFormatting = isSlideMasterOpen
    ? masterActiveSelection
    : activeSelection;
  const { currentFormatting, hasRealSelection } = computeFormattingState({
    presentation,
    selectedSlide,
    activeTextEl: activeTextElement,
    activeElementId,
    activeSelectionForFormatting,
    isSlideMasterOpen,
    isEditingSelected: editingTextElementId === activeElementId,
    pendingFormatting,
  });
  const selectedHyperlinkText = useMemo(
    () =>
      hasRealSelection
        ? getSelectedPlainText(
            activeTextElement,
            activeSelectionForFormatting,
          )
        : "",
    [
      activeTextElement,
      activeSelectionForFormatting,
      hasRealSelection,
    ],
  );
  const selectedHyperlinkLink = useMemo(
    () =>
      hasRealSelection
        ? getSelectedLink(
            activeTextElement,
            activeSelectionForFormatting,
          )
        : null,
    [
      activeTextElement,
      activeSelectionForFormatting,
      hasRealSelection,
    ],
  );
  const applyFormatting = useApplyFormatting({
    activeSelectionRef,
    editingTextElementIdRef,
    currentFormatting,
    updateTextRangeFormatting,
    updateTextElementFormatting,
    updateParagraphFormatting,
    setPendingFormatting,
  });

  const clearTextEditingState = useCallback(() => {
    editingTextElementIdRef.current = null;
    setEditingTextElementId(null);
    activeSelectionRef.current = null;
    setActiveSelection(null);
    setMasterActiveSelection(null);
    setPendingFormatting({});
    setClearSelectionSignal((signal) => signal + 1);
  }, []);

  const handleStartEditing = useCallback((id) => {
    if (editingTextElementIdRef.current !== id) {
      setPendingFormatting({});
    }
    editingTextElementIdRef.current = id;
    setEditingTextElementId(id);
  }, []);

  const handleStopEditing = useCallback((id) => {
    if (editingTextElementIdRef.current === id) {
      editingTextElementIdRef.current = null;
    }
    setEditingTextElementId((current) =>
      current === id ? null : current,
    );
    if (activeSelectionRef.current?.elementId === id) {
      activeSelectionRef.current = null;
      setActiveSelection(null);
    }
    setMasterActiveSelection((current) =>
      current?.elementId === id ? null : current,
    );
    setPendingFormatting({});
    setClearSelectionSignal((signal) => signal + 1);
  }, []);

  const handleSaveSelection = useCallback((elementId, offsets) => {
    if (
      offsets &&
      editingTextElementIdRef.current !== elementId
    ) {
      return;
    }
    const selection = offsets ? { elementId, ...offsets } : null;
    activeSelectionRef.current = selection;
    setActiveSelection(selection);
    const isRealSelection =
      offsets &&
      !(
        offsets.paragraphIdx ===
          (offsets.endParagraphIdx ?? offsets.paragraphIdx) &&
        offsets.rangeStart === offsets.rangeEnd
      );
    if (isRealSelection) setPendingFormatting({});
  }, []);

  const handleMasterSaveSelection = useCallback(
    (elementId, offsets) => {
      if (
        offsets &&
        editingTextElementIdRef.current !== elementId
      ) {
        return;
      }
      setMasterActiveSelection(
        offsets ? { elementId, ...offsets } : null,
      );
    },
    [],
  );

  return {
    activeSelectionRef,
    activeSelection,
    setActiveSelection,
    masterActiveSelection,
    editingTextElementId,
    pendingFormatting,
    setPendingFormatting,
    clearSelectionSignal,
    currentFormatting,
    hasRealSelection,
    selectedHyperlinkText,
    selectedHyperlinkLink,
    applyFormatting,
    clearTextEditingState,
    handleStartEditing,
    handleStopEditing,
    handleSaveSelection,
    handleMasterSaveSelection,
  };
}

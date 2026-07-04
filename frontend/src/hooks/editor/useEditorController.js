import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEditorState } from "./useEditorState";
import { useSlides } from "./useSlides";
import { useEditorActions } from "./useEditorActions";
import { useEditorViewState } from "./useEditorViewState";
import { usePresentationFonts } from "../usePresentationFonts";
import { useFindReplace } from "../useFindReplace";
import { useEditorTextController } from "./useEditorTextController";
import { useEditorCommandsController } from "./useEditorCommandsController";
import { useEditorUiController } from "./useEditorUiController";
import { useEditorPersistenceController } from "./useEditorPersistenceController";
import { useEditorClipboard } from "./useEditorClipboard";
import { useEditorMediaController } from "./useEditorMediaController";
import { useSlideMasterController } from "./useSlideMasterController";
import { findMasterTextElement } from "../../core/operations/formattingState";
import { EditorEventType, createEditorEvent } from "../../core/events/editorEvents";
import { getSlideSize } from "../../core/render/slidesetRenderUtils";
import { getSlideElement } from "../../core/operations/slideOperations";
import { getElementLabel } from "../../core/operations/elementOperations";
import { getPresentationTitle } from "../../core/utils/presentationUtils";
import { getSlideTransition } from "../../core/model/transitionDefaults";
import { isElectron, getElectronAPI } from "../../core/platform/electron";
import { isQuotaExceededError } from "../../core/persistence/storageErrors";
import { createTextElementDefaults } from "../../core/model/masterDefaults";
import { createLayoutPlaceholder } from "../../core/model/defaultLayouts";
import { updateThemeBackground } from "../../core/model/designThemes";
import { clampSlideDimension } from "../../core/model/slideSizes";
import { toHex9 } from "../../core/utils/colorUtils";
import { getLayoutDisplayList } from "../../core/operations/layoutOperations";

export function useEditorController() {
  const { presentationId } = useParams();
  const navigate = useNavigate();

  const [ctrl_cropSignal, setCtrlCropSignal] = useState(0);
  const [previewMediaEffects, setPreviewMediaEffects] = useState(null);
  const [previewMediaStyleId, setPreviewMediaStyleId] = useState(null);
  const [composeSession, setComposeSession] = useState(0);
  const [isSlideMasterOpen, setIsSlideMasterOpen] = useState(false);
  const [masterName, setMasterName] = useState("Office Theme");
  const [selectedMasterElementId, setSelectedMasterElementId] = useState(null);
  const [selectedMasterLayoutId, setSelectedMasterLayoutId] = useState(null);
  const [findReplaceMode, setFindReplaceMode] = useState("find");

  const viewState = useEditorViewState();
  const {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    handleCanvasZoom,
    activeTab,
    setActiveTab,
    showNotes,
    toggleNotes,
    currentView,
    setCurrentView,
    isPreviewOpen,
    openPreview,
    closePreview,
    previewEffect,
    setPreviewEffect,
    triggerAnimationPreview,
    triggerTransitionPreview,
  } = viewState;

  const quotaWarningShownRef = useRef(false);
  const handleSaveError = useCallback(async (error) => {
    if (!isQuotaExceededError(error) || quotaWarningShownRef.current) return;
    quotaWarningShownRef.current = true;
    if (isElectron()) {
      await getElectronAPI().showError("Save Failed", error.message);
    } else {
      window.alert(`Save failed: ${error.message}`);
    }
  }, []);

  const {
    state,
    eventBus,
    isLoading,
    saveStatus: autosaveStatus,
    presentationSource,
    setPresentationSource,
  } = useEditorState(presentationId, { onSaveError: handleSaveError });
  const saveStatus = presentationSource.status === "committing"
    ? "saving"
    : autosaveStatus;

  useEffect(() => {
    if (saveStatus === "saved") quotaWarningShownRef.current = false;
  }, [saveStatus]);
  const {
    presentation,
    slides,
    selectedSlide,
    selectedSlideIndex,
    selectedElementId,
    selectedElementIds,
  } = useSlides(state);

  const actions = useEditorActions(
    eventBus,
    selectedSlideIndex,
    slides.length,
    presentationId,
  );
  const {
    setSelectedSlideId,
    selectElement,
    selectElements,
    addSlide,
    deleteSlide,
    duplicateSlide,
    moveSlideUp,
    moveSlideDown,
    reorderSlide,
    savePresentation: dispatchSavePresentation,
    toggleAutosave,
    resetPresentation,
    addTextElement,
    updateTextElementContent,
    updateTextElementFormatting,
    updateParagraphFormatting,
    updateTextElementParagraphs,
    updateTextRangeFormatting,
    updateRunLink,
    updateElementPosition,
    updateElementSize,
    updateElement,
    updateElementSilent,
    updateElements,
    addFont,
    removeFont,
    addMedia,
    updateMedia,
    renamePresentation,
    deleteTextElement,
    toggleSlideHidden,
    deleteMedia,
    updateSlideBackground,
    updateSlideNotes,
    updateSlideTransition,
    updateTransitionDuration,
    applyTransitionToAll,
    applyLayout,
    resetLayout,
    addLayout,
    updateLayout,
    deleteLayout,
    renameLayout,
    applyLayoutFont,
    addLayoutElement,
    deleteLayoutElement,
    addLayoutPlaceholder,
    removeLayoutPlaceholder,
    updateLayoutItem,
    updateLayoutTextFormattingAction,
    updateMasterTheme,
    updateMasterFormatting,
    updateMasterDimensions,
    updateMasterTextContent,
    updateMasterTextFormatting,
    addMasterElement,
    updateMasterElement,
    deleteMasterElement,
    toggleTitle,
    toggleFooters,
    formatPainterCopy,
    formatPainterPaste,
    addAnimation,
    addAnimationForElement,
    updateAnimation,
    reorderAnimations,
    deleteAnimation,
    beginHistory,
    commitHistory,
    cancelHistory,
    undo,
    redo,
    copyElement,
    pasteElement,
    cutElement,
    deleteSelectedElements,
    addComment,
    deleteComment,
  } = actions;
  const {
    previewStartSlide,
    handleOpenPreviewFromBeginning,
    handleOpenPreviewFromCurrent,
    showComments,
    setShowComments,
    showSelectionPane,
    setShowSelectionPane,
    showFormatBackground,
    setShowFormatBackground,
    showAltText,
    setShowAltText,
  } = useEditorUiController({
    openPreview,
    presentation,
    selectedSlideIndex,
  });
  const savePresentation = useCallback(
    async (options = {}) => {
      try {
        await dispatchSavePresentation();
        return { success: true };
      } catch (error) {
        const message = error?.message ?? "The presentation could not be saved.";
        if (options?.silent !== true) {
          if (isElectron()) {
            await getElectronAPI().showError("Save Failed", message);
          } else {
            window.alert(`Save failed: ${message}`);
          }
        }
        return { success: false, error };
      }
    },
    [dispatchSavePresentation],
  );

  const handleFindNavigate = useCallback(
    (slideIndex, elementId) => {
      setSelectedSlideId(slideIndex);
      selectElement(elementId);
    },
    [setSelectedSlideId, selectElement],
  );

  const handleReplaceText = useCallback(
    (slideIndex, elementId, paragraphIdx, runIdx, newText) => {
      const element = (slides[slideIndex]?.contents?.text ?? []).find(
        (item) => item.id === elementId,
      );
      if (!element) return;
      const paragraphs = structuredClone(element.paragraphs ?? []);
      const run = paragraphs[paragraphIdx]?.runs?.[runIdx];
      if (!run) return;
      run.text = newText;
      updateTextElementParagraphs(slideIndex, elementId, paragraphs);
    },
    [slides, updateTextElementParagraphs],
  );

  const handleReplaceAllText = useCallback(
    (operations) => {
      const grouped = new Map();
      operations.forEach((operation) => {
        const key = `${operation.slideIndex}:${operation.elementId}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(operation);
      });

      beginHistory();
      grouped.forEach((elementOperations) => {
        const { slideIndex, elementId } = elementOperations[0];
        const element = (slides[slideIndex]?.contents?.text ?? []).find(
          (item) => item.id === elementId,
        );
        if (!element) return;
        const paragraphs = structuredClone(element.paragraphs ?? []);
        elementOperations.forEach(({ paragraphIdx, runIdx, newText }) => {
          const run = paragraphs[paragraphIdx]?.runs?.[runIdx];
          if (run) run.text = newText;
        });
        updateTextElementParagraphs(slideIndex, elementId, paragraphs, true);
      });
      commitHistory();
    },
    [slides, updateTextElementParagraphs, beginHistory, commitHistory],
  );

  const findReplace = useFindReplace(
    slides,
    handleFindNavigate,
    handleReplaceText,
    handleReplaceAllText,
  );
  const openFindReplace = findReplace.open;

  usePresentationFonts(presentation);

  useEffect(() => {
    if (currentView === "reading") {
      const id = setTimeout(() => {
        handleOpenPreviewFromCurrent();
        setCurrentView("normal");
      }, 0);
      return () => clearTimeout(id);
    }
  }, [
    currentView,
    handleOpenPreviewFromCurrent,
    setCurrentView,
  ]);

  const layouts = getLayoutDisplayList(presentation);

  const { width: slideWidth, height: slideHeight } = useMemo(
    () => getSlideSize(presentation),
    [presentation],
  );

  const { transition: currentTransition, duration: currentDuration } = useMemo(
    () => getSlideTransition(selectedSlide),
    [selectedSlide],
  );

  const presentationTitle = useMemo(
    () => getPresentationTitle(presentation),
    [presentation],
  );

  const selectedTextEl = selectedElementId
    ? (selectedSlide?.contents?.text ?? []).find(
        (t) => t.id === selectedElementId,
      )
    : null;

  const masterSelectedTextEl = isSlideMasterOpen
    ? findMasterTextElement(
        presentation,
        selectedMasterLayoutId,
        selectedMasterElementId,
      )
    : null;

  const activeTextEl = isSlideMasterOpen
    ? masterSelectedTextEl
    : selectedTextEl;
  const activeElementId = isSlideMasterOpen
    ? selectedMasterElementId
    : selectedElementId;
  const {
    activeSelectionRef,
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
  } = useEditorTextController({
    presentation,
    selectedSlide,
    selectedElementId,
    activeTextElement: activeTextEl,
    activeElementId,
    isSlideMasterOpen,
    updateTextRangeFormatting,
    updateTextElementFormatting,
    updateParagraphFormatting,
  });

  const selectedElementRaw = isSlideMasterOpen
    ? (() => {
        const master = presentation?.slideset?.master;
        const mediaEl = (master?.elements?.media ?? []).find((m) => m.id === selectedMasterElementId);
        if (mediaEl) return mediaEl;
        if (selectedMasterLayoutId) {
          const layout = (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === selectedMasterLayoutId);
          return (layout?.elements?.media ?? []).find((m) => m.id === selectedMasterElementId) ?? null;
        }
        return null;
      })()
    : getSlideElement(selectedSlide, selectedElementId);
  const {
    handleChangePicture,
    handleApplyBgFillImage,
    activeImageUpload,
    activeVideoUpload,
    exportPresentation,
    handleExportZip,
    handlePlaceholderImageUpload,
    handlePlaceholderVideoUpload,
  } = useEditorMediaController({
    presentation,
    selectedMediaElement:
      selectedElementRaw?.paragraphs ? null : selectedElementRaw,
    slideWidth,
    slideHeight,
    eventBus,
    isSlideMasterOpen,
    selectedMasterLayoutId,
    addMedia,
    updateMedia,
    updateElement,
    addLayoutElement,
    addMasterElement,
    beginHistory,
    commitHistory,
  });

  useEffect(() => {
    if (activeTab !== "Picture Format") return;
    const isMedia = selectedElementRaw && !selectedElementRaw.paragraphs;
    if (!isMedia) setActiveTab("Home");
  }, [selectedElementRaw, activeTab, setActiveTab]);

  useEffect(() => {
    const isImage = selectedElementRaw && !selectedElementRaw.paragraphs && selectedElementRaw["media-type"] !== "video";
    if (!isImage) setShowAltText(false);
  }, [selectedElementRaw, setShowAltText]);

  const selectedElementsRaw = useMemo(
    () =>
      selectedElementIds
        .map((id) => getSlideElement(selectedSlide, id))
        .filter(Boolean),
    [selectedSlide, selectedElementIds],
  );
  const layoutTextIds = useMemo(() => {
    const layoutId = selectedSlide?.["layout-id"];
    if (!layoutId) return new Set();
    const layout = (presentation?.slideset?.layouts ?? []).find(
      (item) => item["layout-id"] === layoutId,
    );
    return new Set((layout?.elements?.text ?? []).map((element) => element.id));
  }, [selectedSlide, presentation?.slideset?.layouts]);
  const {
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
  } = useEditorCommandsController({
    selectedSlide,
    selectedSlideIndex,
    selectedElementId,
    selectedElementIds,
    selectedElements: selectedElementsRaw,
    selectedTextElement: selectedTextEl,
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
  });
  const {
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteText,
    handlePastePicture,
  } = useEditorClipboard({
    selectedSlide,
    selectedElementId,
    selectedElements: selectedElementsRaw,
    selectedTextElement: selectedTextEl,
    selectedSlideIndex,
    presentation,
    clipboard: state.clipboard,
    currentFormatting,
    activeSelectionRef,
    setActiveSelection,
    setPendingFormatting,
    updateTextElementParagraphs,
    slideWidth,
    slideHeight,
    addMedia,
    updateElement,
    beginHistory,
    commitHistory,
    copyElement,
    cutElement,
    pasteElement,
  });
  const selectedElement = useMemo(
    () =>
      selectedElementRaw
        ? {
            id: selectedElementRaw.id,
            label: getElementLabel(selectedElementRaw),
          }
        : null,
    [selectedElementRaw],
  );

  const activePendingFormatting =
    editingTextElementId === selectedElementId ? pendingFormatting : {};

  const handleApplyBackground = useCallback(
    (hex) => {
      const colorTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
      const decorations = presentation?.slideset?.master?.decorations;
      updateMasterTheme(
        updateThemeBackground(colorTheme, toHex9(hex)),
        decorations,
      );
    },
    [presentation, updateMasterTheme],
  );

  const themeColorTxnRef = useRef({ active: false, timer: null });
  const handleUpdateThemeColor = useCallback(
    (colorVariable, hexColor) => {
      const txn = themeColorTxnRef.current;
      if (!txn.active) {
        txn.active = true;
        beginHistory();
      }
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_THEME_COLOR, {
          colorVariable,
          hexColor,
        }),
      );
      if (txn.timer) clearTimeout(txn.timer);
      txn.timer = setTimeout(() => {
        txn.active = false;
        txn.timer = null;
        commitHistory();
      }, 500);
    },
    [eventBus, beginHistory, commitHistory],
  );

  const handleApplyBackgroundToAll = useCallback(
    (background) => {
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.APPLY_BACKGROUND_TO_ALL, { background }),
      );
    },
    [eventBus],
  );


  const handleUpdateDimensions = useCallback(
    (dimensions, aspectRatio, units) => {
      const w = clampSlideDimension(dimensions.width, 1280);
      const h = clampSlideDimension(dimensions.height, 720);
      updateMasterDimensions({ width: w, height: h }, aspectRatio, units);
    },
    [updateMasterDimensions],
  );

  const promoteLayoutElement = useCallback(
    (el, type) => {
      beginHistory();
      if (type === "media") {
        addMedia({ ...el });
      } else {
        addTextElement({ ...el });
      }
      handleElementSelect(el.id);
      commitHistory();
    },
    [addMedia, addTextElement, handleElementSelect, beginHistory, commitHistory],
  );

  const suppressLayoutPlaceholder = useCallback(
    (el) => {
      if (!el) return;
      const phId = el["placeholder-id"] ?? el.id;
      addTextElement({
        id: phId,
        "placeholder-id": phId,
        hidden: true,
        position: el.position ?? { x: 0, y: 0 },
        width: el.width ?? 0,
        height: el.height ?? 0,
        rotation: 0,
        "z-index": el["z-index"] ?? 1,
        background: "transparent",
        paragraphs: [],
      });
    },
    [addTextElement],
  );

  const handleDeleteTextElement = useCallback(
    (id) => {
      if (layoutTextIds.has(id)) {
        updateElement(id, { hidden: true });
      } else {
        deleteTextElement(id);
      }
    },
    [layoutTextIds, updateElement, deleteTextElement],
  );

  const handleAddTextElement = useCallback(
    () => addTextElement(createTextElementDefaults(10, "")),
    [addTextElement],
  );

  const handleAddMasterTextElement = useCallback(() => {
    if (selectedMasterLayoutId) {
      addLayoutElement(
        selectedMasterLayoutId,
        "text",
        createTextElementDefaults(4, "Layout text"),
      );
    } else {
      addMasterElement("text", createTextElementDefaults(10, "Master text"));
    }
  }, [selectedMasterLayoutId, addLayoutElement, addMasterElement]);

  const handleAddTextPlaceholder = useCallback(() => {
    if (!selectedMasterLayoutId) return;
    const layout = (presentation?.slideset?.layouts ?? []).find(
      (item) => item["layout-id"] === selectedMasterLayoutId,
    );
    const offset = (layout?.placeholders?.length ?? 0) * 20;
    addLayoutPlaceholder(
      selectedMasterLayoutId,
      createLayoutPlaceholder({
        placeholderId: `text-placeholder-${crypto.randomUUID().slice(0, 8)}`,
        x: 120 + offset,
        y: 220 + offset,
        width: 560,
        height: 160,
        type: "text",
        role: "body",
        padding: "12px",
        promptText: "Click to edit text",
      }),
    );
  }, [selectedMasterLayoutId, presentation?.slideset?.layouts, addLayoutPlaceholder]);

  const handleAddContentPlaceholder = useCallback(() => {
    if (!selectedMasterLayoutId) return;
    const layout = (presentation?.slideset?.layouts ?? []).find(
      (l) => l["layout-id"] === selectedMasterLayoutId,
    );
    const offset = (layout?.placeholders?.length ?? 0) * 20;
    addLayoutPlaceholder(
      selectedMasterLayoutId,
      createLayoutPlaceholder({
        placeholderId: `content-placeholder-${crypto.randomUUID().slice(0, 8)}`,
        x: 120 + offset,
        y: 220 + offset,
        width: 560,
        height: 320,
        type: "text",
        role: "body",
        padding: "12px",
      }),
    );
  }, [selectedMasterLayoutId, presentation?.slideset?.layouts, addLayoutPlaceholder]);

  const activeAddTextElement = isSlideMasterOpen
    ? handleAddMasterTextElement
    : handleAddTextElement;

  const handleNewComment = useCallback(() => {
    setShowComments(true);
    setComposeSession((s) => s + 1);
  }, [setShowComments]);

  const handleHyperlink = useCallback(
    (elementId, hyperlink, selectionSnapshot = null) => {
      const targetId = elementId ?? selectedElementId;
      const isExpanded = (s) =>
        s &&
        (s.paragraphIdx !== (s.endParagraphIdx ?? s.paragraphIdx) ||
          s.rangeStart !== s.rangeEnd);
      const rawSelection =
        (isExpanded(selectionSnapshot) ? selectionSnapshot : null) ??
        (isExpanded(activeSelectionRef.current)
          ? activeSelectionRef.current
          : null) ??
        selectionSnapshot;
      const selection = rawSelection
        ? {
            ...rawSelection,
            elementId: rawSelection.elementId ?? targetId,
          }
        : null;
      const rawHref =
        typeof hyperlink === "string" ? hyperlink : hyperlink?.href;
      const linkType =
        typeof hyperlink === "string" ? "web" : (hyperlink?.type ?? "web");
      const trimmedHref = rawHref?.trim() ?? "";
      const normalizedHref =
        linkType === "email" && !trimmedHref.startsWith("mailto:")
          ? `mailto:${trimmedHref}`
          : linkType === "web" &&
              trimmedHref &&
              !/^(https?:|mailto:|blob:|file:|indexeddb:|#|\/)/i.test(trimmedHref)
            ? `https://${trimmedHref}`
            : trimmedHref;
      if (
        !targetId ||
        !normalizedHref ||
        selection?.elementId !== targetId ||
        selection.paragraphIdx !==
          (selection.endParagraphIdx ?? selection.paragraphIdx) ||
        selection.rangeStart === selection.rangeEnd
      ) {
        return false;
      }

      updateRunLink(
        targetId,
        selection.paragraphIdx,
        Math.min(selection.rangeStart, selection.rangeEnd),
        Math.max(selection.rangeStart, selection.rangeEnd),
        {
          href: normalizedHref,
          target: "_blank",
          screenTip:
            typeof hyperlink === "string" ? "" : (hyperlink?.screenTip ?? ""),
          type: linkType,
        },
      );
      return true;
    },
    [activeSelectionRef, selectedElementId, updateRunLink],
  );

  const handleRemoveHyperlink = useCallback(
    (elementId, selectionSnapshot = null) => {
      const targetId = elementId ?? selectedElementId;
      const isExp = (s) =>
        s &&
        (s.paragraphIdx !== (s.endParagraphIdx ?? s.paragraphIdx) ||
          s.rangeStart !== s.rangeEnd);
      const rawSelection =
        (isExp(selectionSnapshot) ? selectionSnapshot : null) ??
        (isExp(activeSelectionRef.current) ? activeSelectionRef.current : null) ??
        selectionSnapshot;
      const selection = rawSelection
        ? { ...rawSelection, elementId: rawSelection.elementId ?? targetId }
        : null;
      if (
        !targetId ||
        !selection ||
        selection.elementId !== targetId ||
        selection.rangeStart === selection.rangeEnd
      )
        return false;
      updateRunLink(
        targetId,
        selection.paragraphIdx,
        Math.min(selection.rangeStart, selection.rangeEnd),
        Math.max(selection.rangeStart, selection.rangeEnd),
        null,
      );
      return true;
    },
    [activeSelectionRef, selectedElementId, updateRunLink],
  );

  const {
    linkedFolderPath,
    handleSave,
    handleSaveAs,
    handleClosePresentation,
    handleNew,
    handleOpenRecentProject,
    handleElectronOpen,
    handleLoadFile,
    handleDeleteAndGoHome,
  } = useEditorPersistenceController({
    presentationId,
    presentation,
    presentationSource,
    setPresentationSource,
    renamePresentation,
    savePresentation,
    autosaveStatus,
    eventBus,
    autosaveEnabled: state.autosaveEnabled,
    navigate,
  });

  const masterTextIds = useMemo(
    () => new Set((presentation?.slideset?.master?.elements?.text ?? []).map((el) => el.id)),
    [presentation?.slideset?.master?.elements?.text],
  );
  const masterMediaIds = useMemo(
    () => new Set((presentation?.slideset?.master?.elements?.media ?? []).map((el) => el.id)),
    [presentation?.slideset?.master?.elements?.media],
  );
  const selectedMasterLayout = useMemo(
    () =>
      selectedMasterLayoutId
        ? (presentation?.slideset?.layouts ?? []).find(
            (l) => l["layout-id"] === selectedMasterLayoutId,
          ) ?? null
        : null,
    [presentation?.slideset?.layouts, selectedMasterLayoutId],
  );
  const {
    activeMasterSlide,
    handleMasterBringToFront,
    handleMasterBringForward,
    handleMasterSendBackward,
    handleMasterSendToBack,
    masterViewChangeText,
    masterViewChangeParagraphs,
    masterViewFormatText,
    masterViewMoveText,
    masterViewResizeText,
    masterViewMoveMedia,
    masterViewResizeMedia,
    masterViewAutoFitText,
    masterViewAutoFitMedia,
    masterViewDeleteText,
    masterViewDeleteMedia,
    masterViewDeleteSelection,
  } = useSlideMasterController({
    presentation,
    selectedMasterLayoutId,
    selectedMasterLayout,
    selectedMasterElementId,
    masterTextIds,
    masterMediaIds,
    beginHistory,
    commitHistory,
    updateLayoutItem,
    updateMasterElement,
    updateMasterTextContent,
    updateLayoutTextFormattingAction,
    updateMasterTextFormatting,
    removeLayoutPlaceholder,
    deleteLayoutElement,
    deleteMasterElement,
  });

  const handleFormatChange = useCallback(
    (updates) => {
      if (!activeElementId) return;
      if (isSlideMasterOpen) {
        masterViewFormatText(activeElementId, updates);
        return;
      }
      if (!activeTextEl) return;
      applyFormatting(selectedElementId, updates);
    },
    [
      activeElementId,
      activeTextEl,
      isSlideMasterOpen,
      masterViewFormatText,
      applyFormatting,
      selectedElementId,
    ],
  );

  const handleChangeCase = useCallback(
    (mode) => {
      const targetEl = isSlideMasterOpen ? masterSelectedTextEl : selectedTextEl;
      if (!targetEl) return;

      const transform = (text) => {
        if (mode === "lower") return text.toLocaleLowerCase();
        if (mode === "upper") return text.toLocaleUpperCase();
        if (mode === "toggle") {
          return [...text]
            .map((character) =>
              character === character.toLocaleUpperCase()
                ? character.toLocaleLowerCase()
                : character.toLocaleUpperCase(),
            )
            .join("");
        }
        if (mode === "title") {
          return text.toLocaleLowerCase().replace(
            /(^|[\s([{'"“‘-])(\p{L})/gu,
            (_, prefix, letter) => prefix + letter.toLocaleUpperCase(),
          );
        }
        if (mode === "sentence") {
          return text
            .toLocaleLowerCase()
            .replace(
              /(^|[.!?]\s+)(\p{L})/gu,
              (_, prefix, letter) => prefix + letter.toLocaleUpperCase(),
            );
        }
        return text;
      };

      const selection = isSlideMasterOpen
        ? masterActiveSelection
        : activeSelectionRef.current;
      const hasSelection =
        selection?.elementId === targetEl.id &&
        !(
          selection.paragraphIdx ===
            (selection.endParagraphIdx ?? selection.paragraphIdx) &&
          selection.rangeStart === selection.rangeEnd
        );
      const paragraphs = structuredClone(targetEl.paragraphs ?? []);

      paragraphs.forEach((paragraph, paragraphIndex) => {
        if (
          hasSelection &&
          (paragraphIndex < selection.paragraphIdx ||
            paragraphIndex >
              (selection.endParagraphIdx ?? selection.paragraphIdx))
        ) {
          return;
        }

        const paragraphLength = (paragraph.runs ?? []).reduce(
          (total, run) => total + (run.text?.length ?? 0),
          0,
        );
        const start =
          hasSelection && paragraphIndex === selection.paragraphIdx
            ? selection.rangeStart
            : 0;
        const end =
          hasSelection &&
          paragraphIndex ===
            (selection.endParagraphIdx ?? selection.paragraphIdx)
            ? selection.rangeEnd
            : paragraphLength;

        const fullText = (paragraph.runs ?? []).map((run) => run.text ?? "").join("");
        const transformedText =
          fullText.slice(0, start) +
          transform(fullText.slice(start, end)) +
          fullText.slice(end);
        let offset = 0;
        paragraph.runs = (paragraph.runs ?? []).map((run) => {
          const runText = run.text ?? "";
          const runStart = offset;
          const runEnd = runStart + runText.length;
          offset = runEnd;
          return { ...run, text: transformedText.slice(runStart, runEnd) };
        });
      });

      if (isSlideMasterOpen) {
        masterViewChangeParagraphs(targetEl.id, paragraphs);
      } else {
        updateTextElementParagraphs(
          selectedSlideIndex,
          targetEl.id,
          paragraphs,
        );
      }
    },
    [
      activeSelectionRef,
      isSlideMasterOpen,
      masterSelectedTextEl,
      masterActiveSelection,
      masterViewChangeParagraphs,
      selectedTextEl,
      selectedSlideIndex,
      updateTextElementParagraphs,
    ],
  );

  const handleMasterElementSelect = useCallback(
    (elementId, options = {}) => {
      const event = options?.nativeEvent ?? options;
      const isLiveTextPointer = Boolean(
        event?.target?.closest?.('.text-editable[contenteditable="true"]'),
      );
      const preserveTextEditing = options?.preserveTextEditing === true;
      if (
        !preserveTextEditing &&
        (!isLiveTextPointer || elementId !== selectedMasterElementId)
      ) {
        clearTextEditingState();
      }
      setSelectedMasterElementId(elementId);
    },
    [clearTextEditingState, selectedMasterElementId],
  );

  const openFind = useCallback(() => {
    setFindReplaceMode("find");
    openFindReplace();
  }, [openFindReplace]);

  const openReplace = useCallback(() => {
    setFindReplaceMode("replace");
    openFindReplace();
  }, [openFindReplace]);

  return {
    isLoading,
    saveStatus,
    linkedFolderPath,
    presentationSource,

    state,
    presentation,
    slides,
    selectedSlide,
    selectedSlideIndex,
    selectedElementId,
    selectedElementIds,
    selectedElementsRaw,
    layouts,
    slideWidth,
    slideHeight,
    currentTransition,
    currentDuration,
    presentationTitle,
    selectedTextEl,
    masterSelectedTextEl,
    selectedElement,
    selectedMediaElement: selectedElementRaw?.paragraphs ? null : selectedElementRaw ?? null,
    handleChangePicture,
    cropSignal: ctrl_cropSignal,
    triggerCrop: useCallback(() => setCtrlCropSignal((n) => n + 1), []),
    previewMediaEffects,
    setPreviewMediaEffects,
    previewMediaStyleId,
    setPreviewMediaStyleId,
    currentFormatting,
    selectedHyperlinkText,
    selectedHyperlinkLink,
    hasRealSelection,
    activePendingFormatting,

    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    handleCanvasZoom,
    activeTab,
    setActiveTab,
    showNotes,
    toggleNotes,
    currentView,
    setCurrentView,
    isPreviewOpen,
    closePreview,
    previewEffect,
    setPreviewEffect,
    triggerAnimationPreview,
    triggerTransitionPreview,
    previewStartSlide,

    showComments,
    setShowComments,
    composeSession,
    isSlideMasterOpen,
    setIsSlideMasterOpen,
    masterName,
    setMasterName,
    selectedMasterElementId,
    setSelectedMasterElementId,
    handleMasterElementSelect,
    selectedMasterLayoutId,
    setSelectedMasterLayoutId,
    clearSelectionSignal,
    editingTextElementId,
    findReplaceMode,
    findReplace,
    showSelectionPane,
    setShowSelectionPane,
    showFormatBackground,
    setShowFormatBackground,
    showAltText,
    setShowAltText,
    objectSelectionMode,

    handleApplyBackground,
    handleApplyBackgroundToAll,
    handleApplyBgFillImage,
    handleApplySlideBackground: updateSlideBackground,
    handleUpdateDimensions,
    handleUpdateThemeColor,
    activeImageUpload,
    activeVideoUpload,
    activeAddTextElement,
    handleAddMasterTextElement,
    handleAddTextPlaceholder,
    handleAddContentPlaceholder,
    exportPresentation,
    handleExportZip,
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteText,
    handlePastePicture,
    handlePlaceholderImageUpload,
    handlePlaceholderVideoUpload,
    handleDeleteSelection,
    handleNewComment,
    handleHyperlink,
    handleRemoveHyperlink,
    handleSave,
    handleSaveAs,
    handleClosePresentation,
    handleNew,
    handleOpenRecentProject,
    handleElectronOpen,
    handleLoadFile,
    handleDeleteAndGoHome,
    handleFormatChange,
    handleChangeCase,
    handleStartEditing,
    handleStopEditing,
    handleSaveSelection,
    handleMasterSaveSelection,
    handleOpenPreviewFromBeginning,
    handleOpenPreviewFromCurrent,
    openFind,
    openReplace,
    handleSelectAll,
    handleSelectObjects,
    handleElementSelect,
    handleMoveElement,
    handleSetElementsVisibility,
    handleMoveSelectionLayer,
    handleToggleSlideHidden,
    handleApplyTransitionToAll,
    handleChangeParagraphs,
    handleCloseSlideMasterView,
    handleUpdateMasterElementPosition,
    handleUpdateMasterElementSize,
    activeMasterSlide,
    handleMasterBringToFront,
    handleMasterBringForward,
    handleMasterSendBackward,
    handleMasterSendToBack,
    masterViewChangeText,
    masterViewChangeParagraphs,
    masterViewFormatText,
    masterViewMoveText,
    masterViewResizeText,
    masterViewMoveMedia,
    masterViewResizeMedia,
    masterViewAutoFitText,
    masterViewAutoFitMedia,
    masterViewDeleteText,
    masterViewDeleteMedia,
    masterViewDeleteSelection,
    handleBringToFront,
    handleSendToBack,
    handleBringForward,
    handleSendBackward,
    handleRotateRight,
    applyFormatting,

    setSelectedSlideId,
    selectElement,
    selectElements,
    addSlide,
    deleteSlide,
    duplicateSlide,
    moveSlideUp,
    moveSlideDown,
    reorderSlide,
    savePresentation,
    toggleAutosave,
    resetPresentation,
    updateTextElementContent,
    updateTextElementFormatting,
    updateTextRangeFormatting,
    updateRunLink,
    updateElementPosition,
    updateElementSize,
    updateElement,
    updateElementSilent,
    updateElements,
    addFont,
    removeFont,
    addMedia,
    updateMedia,
    deleteTextElement: handleDeleteTextElement,
    deleteMedia,
    updateSlideNotes,
    updateSlideTransition,
    updateTransitionDuration,
    applyLayout,
    resetLayout,
    addLayout: handleAddLayout,
    updateLayout,
    deleteLayout,
    renameLayout,
    applyLayoutFont,
    addLayoutElement,
    deleteLayoutElement,
    addLayoutPlaceholder,
    removeLayoutPlaceholder,
    updateLayoutItem,
    updateLayoutTextFormattingAction,
    updateMasterTheme,
    updateMasterFormatting,
    updateMasterDimensions,
    updateMasterTextContent,
    updateMasterTextFormatting,
    addMasterElement,
    updateMasterElement,
    deleteMasterElement,
    toggleTitle,
    toggleFooters,
    formatPainterCopy,
    formatPainterPaste,
    addAnimation,
    addAnimationForElement,
    updateAnimation,
    reorderAnimations,
    deleteAnimation,
    beginHistory,
    commitHistory,
    cancelHistory,
    undo,
    redo,
    addComment,
    deleteComment,
    setPendingFormatting,
    promoteLayoutElement,
    suppressLayoutPlaceholder,
  };
}

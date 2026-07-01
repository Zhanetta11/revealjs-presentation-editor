import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isUndoShortcut, isRedoShortcut } from "../core/events/keyboardShortcuts";
import { useParams, useNavigate } from "react-router-dom";
import { useEditorState } from "./useEditorState";
import { useSlides } from "./useSlides";
import { useEditorActions } from "./useEditorActions";
import { useEditorViewState } from "./useEditorViewState";
import { useMediaUpload } from "./useMediaUpload";
import { usePresentationFonts } from "./usePresentationFonts";
import { useFindReplace } from "./useFindReplace";
import { useApplyFormatting } from "./useApplyFormatting";
import { findMasterTextElement, computeFormattingState } from "../core/operations/formattingState";
import { EditorEventType, createEditorEvent } from "../core/events/editorEvents";
import { getSlideSize } from "../core/render/slidesetRenderUtils";
import { getSlideElement } from "../core/operations/slideOperations";
import { getElementLabel } from "../core/operations/elementOperations";
import { createZOrderUpdates } from "../core/operations/zOrderOperations";
import {
  createImageMediaElement,
  createVideoMediaElement,
} from "../core/operations/mediaOperations";
import { getPresentationTitle } from "../core/utils/presentationUtils";
import { getSlideTransition } from "../core/model/transitionDefaults";
import { importPresentationFromJson } from "../core/persistence/importPresentation";
import { isElectron, getElectronAPI } from "../core/platform/electron";
import { createTextElementDefaults } from "../core/model/masterDefaults";
import { updateThemeBackground } from "../core/model/designThemes";
import { updateMasterThemeColor } from "../core/operations/themeOperations";
import { clampSlideDimension } from "../core/model/slideSizes";
import { toHex9 } from "../core/utils/colorUtils";
import { getLayoutDisplayList } from "../core/operations/layoutOperations";
import { buildMasterPseudoSlide, buildLayoutPseudoSlide } from "../core/operations/masterOperations";
import {
  exportToReveal,
  exportToRevealZip,
} from "../core/export/exportToReveal";
import {
  deletePresentation,
  createPresentation,
  downloadPresentationAsJson,
  storeMediaFile,
} from "../core/persistence/persistenceFacade";
import { buildProjectManifest } from "../core/persistence/projectFolder";
import { supportsFileSystemAccess } from "../core/platform/fileSystemAccess";
import { saveProjectToBrowserFolder, getBrowserLinkedFolderName } from "../core/persistence/browserProjectFolder";
import {
  htmlToClipboardParagraphs,
  insertClipboardParagraphs,
  plainTextToClipboardParagraphs,
} from "../core/text/clipboardText";

const paragraphText = (paragraph) =>
  (paragraph?.runs ?? []).map((run) => run.text ?? "").join("");

const getSelectedLink = (textElement, selection) => {
  if (!textElement || !selection) return null;
  const para = textElement.paragraphs?.[selection.paragraphIdx];
  if (!para) return null;
  const start = Math.min(selection.rangeStart, selection.rangeEnd);
  const end = Math.max(selection.rangeStart, selection.rangeEnd);
  let offset = 0;
  for (const run of para.runs ?? []) {
    const runEnd = offset + run.text.length;
    if (runEnd > start && offset < end) return run.link ?? null;
    offset = runEnd;
  }
  return null;
};

const getSelectedPlainText = (textElement, selection) => {
  if (!textElement || !selection) return "";
  const startParagraphIdx = Math.min(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const endParagraphIdx = Math.max(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const lines = [];
  for (let pIdx = startParagraphIdx; pIdx <= endParagraphIdx; pIdx++) {
    const text = paragraphText(textElement.paragraphs?.[pIdx]);
    const start = pIdx === selection.paragraphIdx ? selection.rangeStart : 0;
    const end =
      pIdx === (selection.endParagraphIdx ?? selection.paragraphIdx)
        ? selection.rangeEnd
        : text.length;
    lines.push(text.slice(Math.min(start, end), Math.max(start, end)));
  }
  return lines.join("\n");
};

const readImageDimensionsFromFile = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 300, height: 200 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

const readVideoDimensionsFromFile = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ width: 480, height: 270 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });

const fitImageToSlide = (width, height, slideWidth, slideHeight) => {
  const maxW = slideWidth * 0.35;
  const maxH = slideHeight * 0.35;
  if (width <= maxW && height <= maxH) return { width, height };
  const scale = Math.min(maxW / width, maxH / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const readClipboardPayload = async () => {
  const payload = { text: "", html: "", imageBlob: null, imageType: "" };
  try {
    const items = await navigator.clipboard?.read?.();
    for (const item of items ?? []) {
      if (!payload.imageBlob) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          payload.imageBlob = await item.getType(imageType);
          payload.imageType = imageType;
        }
      }
      if (!payload.html && item.types.includes("text/html"))
        payload.html = await (await item.getType("text/html")).text();
      if (!payload.text && item.types.includes("text/plain"))
        payload.text = await (await item.getType("text/plain")).text();
    }
  } catch {}
  if (!payload.text) {
    try {
      payload.text = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {}
  }
  return payload;
};

const renderClipboardParagraphsToPngFile = async (
  paragraphs,
  fallbackFormatting = {},
) => {
  if (!paragraphs?.length) return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const padding = 20;
  const lineGap = 6;
  const lines = paragraphs.map((paragraph) => {
    const runs = paragraph.runs?.length
      ? paragraph.runs
      : [{ text: "", formatting: {} }];
    const measured = runs.map((run) => {
      const formatting = { ...fallbackFormatting, ...(run.formatting ?? {}) };
      const size = Math.max(8, Number.parseFloat(formatting.size) || 24);
      const font = formatting.font || "Arial";
      const weight =
        formatting.weight === true || formatting.weight === "bold"
          ? "bold"
          : formatting.weight || "normal";
      const italics =
        formatting.italics === true || formatting.italics === "italic"
          ? "italic"
          : "normal";
      const fontSpec = `${italics} ${weight} ${size}px ${font}`;
      context.font = fontSpec;
      return {
        run,
        formatting,
        size,
        fontSpec,
        width: context.measureText(run.text ?? "").width,
      };
    });
    return {
      runs: measured,
      width: measured.reduce((sum, entry) => sum + entry.width, 0),
      height: Math.max(...measured.map((entry) => entry.size * 1.3), 24),
    };
  });

  canvas.width = Math.max(
    1,
    Math.ceil(Math.max(...lines.map((line) => line.width), 1) + padding * 2),
  );
  canvas.height = Math.max(
    1,
    Math.ceil(
      lines.reduce((sum, line) => sum + line.height, 0) +
        lineGap * Math.max(0, lines.length - 1) +
        padding * 2,
    ),
  );
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "alphabetic";

  let y = padding;
  for (const line of lines) {
    let x = padding;
    const baseline = y + line.height * 0.82;
    for (const entry of line.runs) {
      context.font = entry.fontSpec;
      if (
        entry.formatting.highlight &&
        entry.formatting.highlight !== "transparent"
      ) {
        context.fillStyle = entry.formatting.highlight;
        context.fillRect(x, y, entry.width, line.height);
      }
      context.fillStyle = entry.formatting.color || "#000000";
      context.fillText(entry.run.text ?? "", x, baseline);
      const decoration = entry.formatting["text-decoration"] ?? "";
      context.strokeStyle = context.fillStyle;
      context.lineWidth = Math.max(1, entry.size / 18);
      if (decoration.includes("underline")) {
        context.beginPath();
        context.moveTo(x, baseline + entry.size * 0.1);
        context.lineTo(x + entry.width, baseline + entry.size * 0.1);
        context.stroke();
      }
      if (decoration.includes("line-through")) {
        context.beginPath();
        context.moveTo(x, baseline - entry.size * 0.3);
        context.lineTo(x + entry.width, baseline - entry.size * 0.3);
        context.stroke();
      }
      x += entry.width;
    }
    y += line.height + lineGap;
  }

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  return blob
    ? {
        file: new File([blob], "clipboard-text.png", { type: "image/png" }),
        naturalSize: { width: canvas.width, height: canvas.height },
      }
    : null;
};

export function useEditorController() {
  const { presentationId } = useParams();
  const navigate = useNavigate();

  const [previewStartSlide, setPreviewStartSlide] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [ctrl_cropSignal, setCtrlCropSignal] = useState(0);
  const [previewMediaEffects, setPreviewMediaEffects] = useState(null);
  const [previewMediaStyleId, setPreviewMediaStyleId] = useState(null);
  const [composeSession, setComposeSession] = useState(0);
  const [isSlideMasterOpen, setIsSlideMasterOpen] = useState(false);
  const [masterName, setMasterName] = useState("Office Theme");
  const [selectedMasterElementId, setSelectedMasterElementId] = useState(null);
  const [selectedMasterLayoutId, setSelectedMasterLayoutId] = useState(null);
  const [masterActiveSelection, setMasterActiveSelection] = useState(null);
  const [editingTextElementId, setEditingTextElementId] = useState(null);
  const editingTextElementIdRef = useRef(null);
  const [pendingFormatting, setPendingFormatting] = useState({});
  const activeSelectionRef = useRef(null);
  const [activeSelection, setActiveSelection] = useState(null);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);
  const [findReplaceMode, setFindReplaceMode] = useState("find");
  const [showSelectionPane, setShowSelectionPane] = useState(false);
  const [objectSelectionMode, setObjectSelectionMode] = useState(false);

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

  const { state, eventBus, isLoading, saveStatus } = useEditorState(presentationId);
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
    const handler = (e) => {
      if (!activeSelectionRef.current) return;
      const inToolbar =
        e.target.closest?.(".format-toolbar") ||
        e.target.closest?.(".toolbar-ribbon") ||
        e.target.closest?.(".toolbar") ||
        e.target.closest?.(".bg-palette-popup") ||
        e.target.closest?.(".sz-dropdown") ||
        e.target.closest?.(".canvas-context-menu") ||
        e.target.closest?.(".text-context-dialog");
      const inElement = e.target.closest?.(
        `[data-element-id="${selectedElementId}"]`,
      );
      if (!inElement && !inToolbar) {
        activeSelectionRef.current = null;
        setActiveSelection(null);
        setClearSelectionSignal((n) => n + 1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedElementId]);

useEffect(() => {
  if (currentView === "reading") {
    const id = setTimeout(() => {
      setPreviewStartSlide(selectedSlideIndex);
      openPreview();
      setCurrentView("normal");
    }, 0);
    return () => clearTimeout(id);
  }
}, [currentView, selectedSlideIndex, openPreview, setCurrentView]);

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
  const activeSelectionForFormatting = isSlideMasterOpen
    ? masterActiveSelection
    : activeSelection;
  const isEditingSelected = isSlideMasterOpen
    ? !!masterActiveSelection
    : editingTextElementId === selectedElementId;

  const { currentFormatting, hasRealSelection } = computeFormattingState({
    presentation,
    selectedSlide,
    activeTextEl,
    activeElementId,
    activeSelectionForFormatting,
    isSlideMasterOpen,
    isEditingSelected,
    pendingFormatting,
  });
  const selectedHyperlinkText = useMemo(
    () =>
      hasRealSelection
        ? getSelectedPlainText(activeTextEl, activeSelectionForFormatting)
        : "",
    [activeTextEl, activeSelectionForFormatting, hasRealSelection],
  );
  const selectedHyperlinkLink = useMemo(
    () =>
      hasRealSelection
        ? getSelectedLink(activeTextEl, activeSelectionForFormatting)
        : null,
    [activeTextEl, activeSelectionForFormatting, hasRealSelection],
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

  useEffect(() => {
    if (activeTab !== "Picture Format") return;
    const isMedia = selectedElementRaw && !selectedElementRaw.paragraphs;
    if (!isMedia) setActiveTab("Home");
  }, [selectedElementRaw, activeTab, setActiveTab]);

  const selectedElementsRaw = useMemo(
    () =>
      selectedElementIds
        .map((id) => getSlideElement(selectedSlide, id))
        .filter(Boolean),
    [selectedSlide, selectedElementIds],
  );
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

  const handleChangePicture = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      const el = selectedElementRaw;
      if (!el?.id) return;

      const objectUrl = URL.createObjectURL(file);
      const naturalDims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(objectUrl); };
        img.onerror = () => { resolve({ w: 300, h: 200 }); URL.revokeObjectURL(objectUrl); };
        img.src = objectUrl;
      });

      const maxW = slideWidth * 0.3;
      const maxH = slideHeight * 0.3;
      const scale = Math.min(1, maxW / naturalDims.w, maxH / naturalDims.h);
      const displayW = Math.round(naturalDims.w * scale);
      const displayH = Math.round(naturalDims.h * scale);

      const { key } = await storeMediaFile(file);
      updateMedia(el.id, {
        "file-link": `indexeddb://${key}`,
        width: displayW,
        height: displayH,
        "source-width": naturalDims.w,
        "source-height": naturalDims.h,
        crop: null,
      });
    },
    [selectedElementRaw, updateMedia, slideWidth, slideHeight],
  );
  const handleRotateRight = useCallback(() => {
    if (selectedElementsRaw.length === 0) return;
    beginHistory();
    selectedElementsRaw.forEach((element) => {
      updateElement(element.id, {
        rotation: (Number(element.rotation ?? 0) + 90) % 360,
      });
    });
    commitHistory();
  }, [selectedElementsRaw, updateElement, beginHistory, commitHistory]);

  const handleElementSelect = useCallback(
    (elementId, options = {}) => {
      const event = options?.nativeEvent ?? options;
      const toggle = Boolean(
        options?.toggle || event?.ctrlKey || event?.metaKey || event?.shiftKey,
      );
      selectElement(elementId, {
        toggle,
        preserveIfSelected: options?.preserveIfSelected,
      });
    },
    [selectElement],
  );

  const handleMoveElement = useCallback(
    (elementId, x, y) => {
      const element = getSlideElement(selectedSlide, elementId);
      if (!element) return;
      const isGroupMove =
        selectedElementIds.length > 1 && selectedElementIds.includes(elementId);
      if (!isGroupMove) {
        updateElementPosition(elementId, x, y);
        return;
      }
      const deltaX = x - (element.position?.x ?? 0);
      const deltaY = y - (element.position?.y ?? 0);
      beginHistory();
      selectedElementsRaw.forEach((selected) => {
        updateElementPosition(
          selected.id,
          (selected.position?.x ?? 0) + deltaX,
          (selected.position?.y ?? 0) + deltaY,
        );
      });
      commitHistory();
    },
    [
      selectedSlide,
      selectedElementIds,
      selectedElementsRaw,
      updateElementPosition,
      beginHistory,
      commitHistory,
    ],
  );

  const handleSetElementsVisibility = useCallback(
    (elementIds, hidden) => {
      updateElements(
        elementIds.map((elementId) => ({
          elementId,
          updates: { hidden },
        })),
      );
    },
    [updateElements],
  );

  const handleMoveSelectionLayer = useCallback(
    (direction) => {
      arrangeSelectedElement(direction < 0 ? "forward" : "backward");
    },
    [arrangeSelectedElement],
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

  const handleUpdateThemeColor = useCallback(
    (colorVariable, hexColor) => {
      const updatedPresentation = updateMasterThemeColor(
        presentation,
        colorVariable,
        hexColor
      );
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_THEME, {
          colorTheme: updatedPresentation.slideset.master["color-theme"],
          decorations: presentation?.slideset?.master?.decorations,
        }),
      );
    },
    [presentation, eventBus],
  );

  const handleApplyBackgroundToAll = useCallback(
    (background) => {
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.APPLY_BACKGROUND_TO_ALL, { background }),
      );
    },
    [eventBus],
  );

  const handleApplyBgFillImage = useCallback(
    async (file, currentSettings) => {
      if (!file || !file.type.startsWith("image/")) return;
      const { key } = await storeMediaFile(file);
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_BACKGROUND, {
          background: { type: "image", "file-link": `indexeddb://${key}`, ...(currentSettings ?? {}) },
        }),
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

  const layoutTextIds = useMemo(() => {
    const layoutId = selectedSlide?.["layout-id"];
    if (!layoutId) return new Set();
    const layout = (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === layoutId);
    return new Set((layout?.elements?.text ?? []).map((el) => el.id));
  }, [selectedSlide, presentation?.slideset?.layouts]);

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

  const { handleImageUpload, handleVideoUpload } = useMediaUpload(addMedia, slideWidth, slideHeight);

  const handleAddTextElement = useCallback(
    () => addTextElement(createTextElementDefaults(10, "")),
    [addTextElement],
  );

  const masterAddMedia = useCallback(
    (mediaElement) => {
      if (selectedMasterLayoutId) {
        addLayoutElement(selectedMasterLayoutId, "media", mediaElement);
      } else {
        addMasterElement("media", mediaElement);
      }
    },
    [selectedMasterLayoutId, addLayoutElement, addMasterElement],
  );
  const {
    handleImageUpload: handleMasterImageUpload,
    handleVideoUpload: handleMasterVideoUpload,
  } = useMediaUpload(masterAddMedia, slideWidth, slideHeight);

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

  const activeImageUpload = isSlideMasterOpen
    ? handleMasterImageUpload
    : handleImageUpload;
  const activeVideoUpload = isSlideMasterOpen
    ? handleMasterVideoUpload
    : handleVideoUpload;
  const activeAddTextElement = isSlideMasterOpen
    ? handleAddMasterTextElement
    : handleAddTextElement;

  const exportPresentation = useCallback(
    () => exportToReveal(presentation),
    [presentation],
  );
  const handleExportZip = useCallback(
    () => exportToRevealZip(presentation),
    [presentation],
  );

  const handleCopy = useCallback(
    (elementOrEvent) => {
      if (selectedElementsRaw.length > 1 && !elementOrEvent?.id) {
        copyElement(selectedElementsRaw);
        return;
      }
      const element = elementOrEvent?.id
        ? elementOrEvent
        : getSlideElement(selectedSlide, selectedElementId);
      if (element) copyElement(element);
    },
    [
      selectedSlide,
      selectedElementId,
      selectedElementsRaw,
      copyElement,
    ],
  );

  const handleCut = useCallback(
    (elementOrEvent) => {
      if (selectedElementsRaw.length > 1 && !elementOrEvent?.id) {
        cutElement(selectedElementsRaw);
        return;
      }
      const element = elementOrEvent?.id
        ? elementOrEvent
        : getSlideElement(selectedSlide, selectedElementId);
      if (element) cutElement(element);
    },
    [selectedSlide, selectedElementId, selectedElementsRaw, cutElement],
  );

  const handlePaste = useCallback(() => pasteElement(), [pasteElement]);

  const handlePasteText = useCallback(
    async (elementId, mode = "destination") => {
      const targetId = elementId ?? selectedElementId;
      const textElement =
        targetId === selectedTextEl?.id
          ? selectedTextEl
          : (selectedSlide?.contents?.text ?? []).find((el) => el.id === targetId);
      if (!targetId || !textElement) return false;
      const activeSelection = activeSelectionRef.current;
      const lastParagraphIdx = Math.max(
        0,
        (textElement.paragraphs?.length ?? 1) - 1,
      );
      const lastOffset = paragraphText(
        textElement.paragraphs?.[lastParagraphIdx],
      ).length;
      const selection =
        activeSelection?.elementId === targetId
          ? activeSelection
          : {
              elementId: targetId,
              paragraphIdx: lastParagraphIdx,
              rangeStart: lastOffset,
              endParagraphIdx: lastParagraphIdx,
              rangeEnd: lastOffset,
            };

      const payload = await readClipboardPayload();
      const internalClipboard = Array.isArray(state.clipboard)
        ? state.clipboard
        : state.clipboard
          ? [state.clipboard]
          : [];
      const internalText = internalClipboard.find(
        (element) => element["media-type"] === undefined,
      );
      const htmlParagraphs = payload.html
        ? htmlToClipboardParagraphs(payload.html)
        : [];
      const htmlPlainText = htmlParagraphs
        .map((paragraph) => paragraphText(paragraph))
        .join("\n");
      const internalPlainText = (internalText?.paragraphs ?? [])
        .map((paragraph) => paragraphText(paragraph))
        .join("\n");
      const clipboardText =
        payload.text || htmlPlainText || internalPlainText;

      let clipboardParagraphs = [];
      if (mode === "source" && htmlParagraphs.length)
        clipboardParagraphs = htmlParagraphs;
      if (
        mode === "source" &&
        clipboardParagraphs.length === 0 &&
        internalText?.paragraphs?.length
      )
        clipboardParagraphs = structuredClone(internalText.paragraphs);
      if (clipboardParagraphs.length === 0 && clipboardText) {
        clipboardParagraphs = plainTextToClipboardParagraphs(
          clipboardText,
          mode === "text" ? {} : currentFormatting,
        );
      }
      if (clipboardParagraphs.length === 0) return false;

      const result = insertClipboardParagraphs(
        textElement.paragraphs,
        selection,
        clipboardParagraphs,
      );
      if (!result) return false;

      updateTextElementParagraphs(
        selectedSlideIndex,
        targetId,
        result.paragraphs,
        false,
      );
      const nextSelection = { elementId: targetId, ...result.selection };
      activeSelectionRef.current = nextSelection;
      setActiveSelection(nextSelection);
      setPendingFormatting({});
      return true;
    },
    [
      selectedElementId,
      selectedTextEl,
      selectedSlide,
      currentFormatting,
      updateTextElementParagraphs,
      selectedSlideIndex,
      state.clipboard,
    ],
  );

  const handlePastePicture = useCallback(async (targetElementId) => {
    const targetEl = targetElementId
      ? ((selectedSlide?.contents?.text ?? []).find((el) => el.id === targetElementId) ?? selectedTextEl)
      : selectedTextEl;

    const findOverlappingLayoutTextId = (el) => {
      if (!el) return null;
      const existingPlaceholderId = el["placeholder-id"];
      if (existingPlaceholderId) return existingPlaceholderId;
      const layoutId = selectedSlide?.["layout-id"];
      if (!layoutId) return null;
      const layout = (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === layoutId);
      const layoutTexts = layout?.elements?.text ?? [];
      const ex = el.position?.x ?? 0, ey = el.position?.y ?? 0;
      const ew = el.width ?? 300, eh = el.height ?? 80;
      const match = layoutTexts.find((lt) => {
        const lx = lt.position?.x ?? 0, ly = lt.position?.y ?? 0;
        const lw = lt.width ?? 300, lh = lt.height ?? 80;
        const overlapX = Math.max(0, Math.min(ex + ew, lx + lw) - Math.max(ex, lx));
        const overlapY = Math.max(0, Math.min(ey + eh, ly + lh) - Math.max(ey, ly));
        const overlapArea = overlapX * overlapY;
        const minArea = Math.min(ew * eh, lw * lh);
        return overlapArea > minArea * 0.3;
      });
      return match?.id ?? null;
    };

    const buildImageProps = (baseProps, placeholderIdOverride) => {
      const pid = placeholderIdOverride ?? findOverlappingLayoutTextId(targetEl);
      return pid ? { ...baseProps, "placeholder-id": pid } : baseProps;
    };

    const scaleToPlaceholder = (naturalW, naturalH, phW, phH) => {
      const scale = phH > phW
        ? phH / naturalH
        : phW / naturalW;
      return { width: Math.round(naturalW * scale), height: Math.round(naturalH * scale) };
    };

    const placeImageAtTarget = async (mediaId, key, naturalSize) => {
      if (targetEl) {
        const phW = targetEl.width ?? naturalSize.width;
        const phH = targetEl.height ?? naturalSize.height;
        const phPos = targetEl.position ?? { x: 60, y: 60 };
        const { width: fitW, height: fitH } = scaleToPlaceholder(naturalSize.width, naturalSize.height, phW, phH);
        beginHistory();
        addMedia(buildImageProps({
          ...createImageMediaElement(mediaId, key, { width: fitW, height: fitH }),
          position: { x: phPos.x, y: phPos.y },
          "source-width": naturalSize.width,
          "source-height": naturalSize.height,
          "z-index": targetEl["z-index"] ?? 1,
        }));
        updateElement(targetEl.id, { hidden: true });
        commitHistory();
      } else {
        const displaySize = fitImageToSlide(naturalSize.width, naturalSize.height, slideWidth, slideHeight);
        addMedia(createImageMediaElement(mediaId, key, displaySize));
      }
    };

    const internalClipboard = Array.isArray(state.clipboard)
      ? state.clipboard
      : state.clipboard ? [state.clipboard] : [];
    const internalMedia = internalClipboard.find((el) => el["media-type"] !== undefined);

    if (internalMedia && targetEl) {
      const phW = targetEl.width ?? internalMedia.width ?? 300;
      const phH = targetEl.height ?? internalMedia.height ?? 200;
      const phPos = targetEl.position ?? { x: 60, y: 60 };
      const { width: fitW, height: fitH } = scaleToPlaceholder(internalMedia.width ?? phW, internalMedia.height ?? phH, phW, phH);
      beginHistory();
      addMedia(buildImageProps({
        ...structuredClone(internalMedia),
        id: crypto.randomUUID(),
        position: { x: phPos.x, y: phPos.y },
        width: fitW,
        height: fitH,
        "z-index": targetEl["z-index"] ?? 1,
      }));
      updateElement(targetEl.id, { hidden: true });
      commitHistory();
      return true;
    }

    if (internalMedia && !targetEl) {
      pasteElement();
      return true;
    }

    try {
      const payload = await readClipboardPayload();
      if (payload.imageBlob) {
        const file = new File(
          [payload.imageBlob],
          `clipboard-image.${payload.imageType.split("/")[1] ?? "png"}`,
          { type: payload.imageType },
        );
        const [{ mediaId, key }, naturalSize] = await Promise.all([
          storeMediaFile(file),
          readImageDimensionsFromFile(file),
        ]);
        await placeImageAtTarget(mediaId, key, naturalSize);
        return true;
      }

      const internalText = internalClipboard.find(
        (element) => element["media-type"] === undefined,
      );
      let clipboardParagraphs = payload.html
        ? htmlToClipboardParagraphs(payload.html)
        : [];
      if (
        clipboardParagraphs.length === 0 &&
        internalText?.paragraphs?.length
      )
        clipboardParagraphs = structuredClone(internalText.paragraphs);
      if (clipboardParagraphs.length === 0 && payload.text)
        clipboardParagraphs = plainTextToClipboardParagraphs(
          payload.text,
          currentFormatting,
        );
      const rendered = await renderClipboardParagraphsToPngFile(
        clipboardParagraphs,
        currentFormatting,
      );
      if (!rendered) return false;
      const { mediaId, key } = await storeMediaFile(rendered.file);
      await placeImageAtTarget(mediaId, key, rendered.naturalSize);
      return true;
    } catch (error) {
      console.warn("[EditorPage] Clipboard picture paste failed:", error);
      return false;
    }
  }, [state.clipboard, pasteElement, addMedia, updateElement, beginHistory, commitHistory, presentation, selectedSlide, selectedTextEl, slideWidth, slideHeight, currentFormatting]);

  const handlePlaceholderImageUpload = useCallback(
    async (placeholderElement, file) => {
      if (!placeholderElement || !file?.type?.startsWith("image/")) return;
      const [{ mediaId, key }, naturalSize] = await Promise.all([
        storeMediaFile(file),
        readImageDimensionsFromFile(file),
      ]);
      const phW = placeholderElement.width ?? naturalSize.width;
      const phH = placeholderElement.height ?? naturalSize.height;
      const scale = Math.min(phW / naturalSize.width, phH / naturalSize.height);
      const fitW = Math.round(naturalSize.width * scale);
      const fitH = Math.round(naturalSize.height * scale);
      const phPos = placeholderElement.position ?? { x: 60, y: 60 };
      const fitX = Math.round(phPos.x + (phW - fitW) / 2);
      const fitY = Math.round(phPos.y + (phH - fitH) / 2);
      beginHistory();
      addMedia({
        ...createImageMediaElement(mediaId, key, { width: fitW, height: fitH }),
        "placeholder-id": placeholderElement["placeholder-id"],
        position: { x: fitX, y: fitY },
        width: fitW,
        height: fitH,
        "source-width": fitW,
        "source-height": fitH,
        "z-index": placeholderElement["z-index"] ?? 1,
      });
      updateElement(placeholderElement.id, { hidden: true });
      commitHistory();
    },
    [addMedia, updateElement, beginHistory, commitHistory],
  );

  const handlePlaceholderVideoUpload = useCallback(
    async (placeholderElement, file) => {
      if (!placeholderElement || !file?.type?.startsWith("video/")) return;
      const [{ mediaId, key }, naturalSize] = await Promise.all([
        storeMediaFile(file),
        readVideoDimensionsFromFile(file),
      ]);
      const phW = placeholderElement.width ?? naturalSize.width;
      const phH = placeholderElement.height ?? naturalSize.height;
      const scale = Math.min(phW / naturalSize.width, phH / naturalSize.height);
      const fitW = Math.round(naturalSize.width * scale);
      const fitH = Math.round(naturalSize.height * scale);
      const phPos = placeholderElement.position ?? { x: 60, y: 60 };
      const fitX = Math.round(phPos.x + (phW - fitW) / 2);
      const fitY = Math.round(phPos.y + (phH - fitH) / 2);
      beginHistory();
      addMedia({
        ...createVideoMediaElement(mediaId, key, { width: fitW, height: fitH }),
        "placeholder-id": placeholderElement["placeholder-id"],
        position: { x: fitX, y: fitY },
        width: fitW,
        height: fitH,
        "z-index": placeholderElement["z-index"] ?? 1,
      });
      updateElement(placeholderElement.id, { hidden: true });
      commitHistory();
    },
    [addMedia, updateElement, beginHistory, commitHistory],
  );

  const handleDeleteSelection = useCallback(() => {
    const layoutIds = selectedElementIds.filter((id) => layoutTextIds.has(id));
    const regularIds = selectedElementIds.filter((id) => !layoutTextIds.has(id));
    layoutIds.forEach((id) => updateElement(id, { hidden: true }));
    if (regularIds.length > 0) deleteSelectedElements(regularIds);
  }, [deleteSelectedElements, selectedElementIds, layoutTextIds, updateElement]);

  const handleNewComment = useCallback(() => {
    setShowComments(true);
    setComposeSession((s) => s + 1);
  }, []);

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
    [selectedElementId, updateRunLink],
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
    [selectedElementId, updateRunLink],
  );

  const [linkedFolderPath, setLinkedFolderPath] = useState(null);
  const linkedFolderPathRef = useRef(null);
  useEffect(() => {
    linkedFolderPathRef.current = linkedFolderPath;
  }, [linkedFolderPath]);

  const saveStatusRef = useRef(saveStatus);
  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  const canUseProjectFolders = isElectron() || supportsFileSystemAccess();

  useEffect(() => {
    if (!presentationId) return;
    if (isElectron()) {
      getElectronAPI()
        .getLinkedFolder(presentationId)
        .then(setLinkedFolderPath)
        .catch(() => setLinkedFolderPath(null));
    } else if (supportsFileSystemAccess()) {
      getBrowserLinkedFolderName(presentationId)
        .then(setLinkedFolderPath)
        .catch(() => setLinkedFolderPath(null));
    }
  }, [presentationId]);

  const saveProjectToFolder = useCallback(
    async (forceNewFolder) => {
      const { jsonText, mediaFiles } = await buildProjectManifest(presentation);
      const mediaFileEntries = await Promise.all(
        mediaFiles.map(async (file) => ({
          relativePath: file.relativePath,
          kind: "binary",
          bytes: new Uint8Array(await file.blob.arrayBuffer()),
        })),
      );
      const files = [
        { relativePath: "presentation.json", kind: "text", text: jsonText },
        ...mediaFileEntries,
      ];
      const presentationTitle = getPresentationTitle(presentation);

      const savedFolder = isElectron()
        ? await getElectronAPI().saveProject({ presentationId, presentationTitle, forceNewFolder, files })
        : await saveProjectToBrowserFolder({ presentationId, presentationTitle, forceNewFolder, files });

      if (savedFolder) setLinkedFolderPath(savedFolder);
      return Boolean(savedFolder);
    },
    [presentation, presentationId],
  );

  const handleSave = useCallback(async () => {
    const result = await savePresentation();
    if (!result.success || !canUseProjectFolders) return;
    try {
      await saveProjectToFolder(false);
    } catch (e) {
      console.error("[EditorPage] Failed to save presentation folder:", e);
      const message = e?.message ?? "Could not save the presentation folder.";
      if (isElectron()) getElectronAPI().showError("Save Failed", message);
      else window.alert(message);
    }
  }, [savePresentation, saveProjectToFolder, canUseProjectFolders]);

  const handleSaveAs = useCallback(async () => {
    if (!canUseProjectFolders) {
      downloadPresentationAsJson(presentation);
      return;
    }
    try {
      await saveProjectToFolder(true);
    } catch (e) {
      console.error("[EditorPage] Failed to save presentation folder:", e);
      const message = e?.message ?? "Could not save the presentation folder.";
      if (isElectron()) getElectronAPI().showError("Save Failed", message);
      else window.alert(message);
    }
  }, [presentation, saveProjectToFolder, canUseProjectFolders]);

  const handleNew = useCallback(async () => {
    const id = await createPresentation(getPresentationTitle(null));
    navigate(`/editor/${id}`);
  }, [navigate]);

  const handleLoadFile = useCallback(
    async (jsonText) => {
      try {
        const id = await importPresentationFromJson(jsonText);
        navigate(`/editor/${id}`);
      } catch (e) {
        console.error("[EditorPage] Failed to import file:", e);
        const message = e?.message ?? "Could not open this file.";
        if (isElectron()) {
          getElectronAPI().showError("Open Failed", message);
        } else {
          window.alert(message);
        }
      }
    },
    [navigate],
  );

  const handleElectronOpen = useCallback(async () => {
    const api = getElectronAPI();
    try {
      const [filePath] = await api.openFile();
      if (!filePath) return;
      const content = await api.readFile(filePath);
      await handleLoadFile(content);
    } catch (e) {
      console.error("[EditorPage] Failed to read file:", e);
      api.showError("Open Failed", e?.message ?? "Could not read this file.");
    }
  }, [handleLoadFile]);

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();

    const unsubscribers = [
      api.onMenuNew(handleNew),
      api.onMenuOpen(handleElectronOpen),
      api.onMenuSave(handleSave),
      api.onMenuSaveAs(handleSaveAs),
      api.onFileDrop(async (filePath) => {
        try {
          const content = await api.readFile(filePath);
          await handleLoadFile(content);
        } catch (e) {
          console.error("[EditorPage] Failed to read dropped file:", e);
          api.showError("Open Failed", e?.message ?? "Could not read this file.");
        }
      }),
      api.onBeforeQuit(async () => {
        const hasUnsavedChanges = saveStatusRef.current === "pending" || saveStatusRef.current === "saving";
        const folder = linkedFolderPathRef.current;

        if (folder && hasUnsavedChanges) {
          const folderName = folder.split(/[/\\]/).filter(Boolean).pop();
          const choice = await api.confirmSaveBeforeQuit(folderName);
          if (choice === "cancel") {
            api.cancelQuit();
            return;
          }
          if (choice === "save") {
            const saved = await saveProjectToFolder(false).catch(() => false);
            if (!saved) {
              api.notifyQuitReady(false, "The presentation could not be saved.");
              return;
            }
          }
        }

        const result = await savePresentation({ silent: true });
        if (result.success) {
          api.notifyQuitReady(true);
        } else {
          api.notifyQuitReady(
            false,
            result.error?.message ?? "The presentation could not be saved.",
          );
        }
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [handleNew, handleElectronOpen, savePresentation, handleSave, handleSaveAs, handleLoadFile, saveProjectToFolder]);

  const handleDeleteAndGoHome = useCallback(async () => {
    if (!presentationId) return;
    const ok = window.confirm(
      "Delete this presentation? This cannot be undone.",
    );
    if (!ok) return;
    await deletePresentation(presentationId);
    navigate("/");
  }, [presentationId, navigate]);

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
  const masterElements = presentation?.slideset?.master?.elements;
  const masterFormatting = presentation?.slideset?.master?.formatting;
  const masterColorTheme = presentation?.slideset?.master?.["color-theme"];
  const activeMasterSlide = useMemo(() => {
    return selectedMasterLayout
      ? buildLayoutPseudoSlide(
          selectedMasterLayout,
          masterColorTheme ?? [],
        )
      : buildMasterPseudoSlide(masterElements ?? {}, masterColorTheme ?? []);
  }, [selectedMasterLayout, masterElements, masterColorTheme]);

  const arrangeMasterViewElement = useCallback(
    (mode) => {
      if (!selectedMasterElementId) return;
      const updates = createZOrderUpdates(
        activeMasterSlide,
        [selectedMasterElementId],
        mode,
      );
      if (updates.length === 0) return;

      beginHistory();
      updates.forEach(({ elementId, updates: elementUpdates }) => {
        if (selectedMasterLayoutId) {
          updateLayoutItem(
            selectedMasterLayoutId,
            elementId,
            elementUpdates,
          );
        } else {
          updateMasterElement(elementId, elementUpdates);
        }
      });
      commitHistory();
    },
    [
      activeMasterSlide,
      beginHistory,
      commitHistory,
      selectedMasterElementId,
      selectedMasterLayoutId,
      updateLayoutItem,
      updateMasterElement,
    ],
  );

  const handleMasterBringToFront = useCallback(
    () => arrangeMasterViewElement("front"),
    [arrangeMasterViewElement],
  );
  const handleMasterBringForward = useCallback(
    () => arrangeMasterViewElement("forward"),
    [arrangeMasterViewElement],
  );
  const handleMasterSendBackward = useCallback(
    () => arrangeMasterViewElement("backward"),
    [arrangeMasterViewElement],
  );
  const handleMasterSendToBack = useCallback(
    () => arrangeMasterViewElement("back"),
    [arrangeMasterViewElement],
  );

  const masterViewChangeText = useCallback(
    (id, text) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { promptText: text });
      } else {
        updateMasterTextContent(id, text);
      }
    },
    [selectedMasterLayoutId, masterTextIds, updateLayoutItem, updateMasterTextContent],
  );

  const masterViewChangeParagraphs = useCallback(
    (id, paragraphs) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        const layout = (presentation?.slideset?.layouts ?? []).find(
          (l) => l["layout-id"] === selectedMasterLayoutId,
        );
        const isPlaceholder = (layout?.placeholders ?? []).some(
          (p) => p["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          const text = paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
          updateLayoutItem(selectedMasterLayoutId, id, { promptText: text });
        } else {
            updateLayoutItem(selectedMasterLayoutId, id, { paragraphs, userModified: true });
        }
      } else {
        updateMasterElement(id, { paragraphs, userModified: true });
      }
    },
    [selectedMasterLayoutId, masterTextIds, presentation, updateLayoutItem, updateMasterElement],
  );

  const masterViewFormatText = useCallback(
    (id, rawFmt) => {
      const delta = Number(rawFmt["font-size-delta"] ?? 0);
      let fmt = rawFmt;
      if (delta) {
        const el = findMasterTextElement(presentation, selectedMasterLayoutId, id);
        const currentSize = parseFloat(el?.paragraphs?.[0]?.formatting?.size ?? masterFormatting?.size ?? "24") || 24;
        const newSize = Math.max(6, Math.min(120, currentSize + delta));
        fmt = { ...rawFmt, "font-size-delta": undefined, size: `${newSize}px` };
        delete fmt["font-size-delta"];
      }
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        const layout = (presentation?.slideset?.layouts ?? []).find(
          (l) => l["layout-id"] === selectedMasterLayoutId,
        );
        const isPlaceholder = (layout?.placeholders ?? []).some(
          (p) => p["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          updateLayoutItem(selectedMasterLayoutId, id, { formatting: fmt });
        } else {
          updateLayoutTextFormattingAction(selectedMasterLayoutId, id, fmt);
        }
      } else {
        updateMasterTextFormatting(id, fmt);
      }
    },
    [selectedMasterLayoutId, masterTextIds, presentation, masterFormatting, updateLayoutItem, updateLayoutTextFormattingAction, updateMasterTextFormatting],
  );

  const masterViewMoveText = useCallback(
    (id, x, y) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { position: { x, y } });
      } else {
        updateMasterElement(id, { position: { x, y } });
      }
    },
    [selectedMasterLayoutId, masterTextIds, updateLayoutItem, updateMasterElement],
  );

  const masterViewResizeText = useCallback(
    (id, w, h) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { width: w, height: h });
      } else {
        updateMasterElement(id, { width: w, height: h });
      }
    },
    [selectedMasterLayoutId, masterTextIds, updateLayoutItem, updateMasterElement],
  );

  const masterViewMoveMedia = useCallback(
    (id, x, y) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { position: { x, y } });
      } else {
        updateMasterElement(id, { position: { x, y } });
      }
    },
    [selectedMasterLayoutId, masterMediaIds, updateLayoutItem, updateMasterElement],
  );

  const masterViewResizeMedia = useCallback(
    (id, w, h) => {
      const allMedia = presentation?.slideset?.master?.elements?.media ?? [];
      const el = allMedia.find((m) => m.id === id);
      const updates = { width: w, height: h };
      if (el && "source-width" in el) {
        const hasCrop = (el.crop ?? []).some((v) => v !== 0);
        if (hasCrop) {
          const [, cr = 0, , cl = 0] = el.crop ?? [];
          const [ct = 0, , cb = 0] = el.crop ?? [];
          const wFrac = 1 - cl / 100 - cr / 100;
          const hFrac = 1 - ct / 100 - cb / 100;
          const scaleX = el.width > 0 ? w / el.width : 1;
          const newSrcW = wFrac > 0.001
            ? Math.round(w / wFrac)
            : Math.round((el["source-width"] ?? el.width) * scaleX);
          updates["source-width"] = newSrcW;
          if ((el["source-width"] ?? 0) > 0 && (el["source-height"] ?? 0) > 0) {
            const newSrcH = Math.round(newSrcW * (el["source-height"] / el["source-width"]));
            updates["source-height"] = newSrcH;
            if (hFrac > 0.001) updates.height = Math.round(newSrcH * hFrac);
          } else {
            const scaleY = el.height > 0 ? h / el.height : 1;
            updates["source-height"] = Math.round((el["source-height"] ?? el.height) * scaleY);
          }
        } else {
          updates["source-width"] = w;
          updates["source-height"] = h;
          updates.crop = [];
        }
      }
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, { width: w, height: h });
      } else {
        updateMasterElement(id, updates);
      }
    },
    [selectedMasterLayoutId, masterMediaIds, updateLayoutItem, updateMasterElement, presentation],
  );

  const masterViewAutoFitText = useCallback(
    (id, updates) => {
      if (selectedMasterLayoutId && !masterTextIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, updates);
      } else {
        updateMasterElement(id, updates);
      }
    },
    [selectedMasterLayoutId, masterTextIds, updateLayoutItem, updateMasterElement],
  );

  const masterViewAutoFitMedia = useCallback(
    (id, updates) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        updateLayoutItem(selectedMasterLayoutId, id, updates);
      } else {
        updateMasterElement(id, updates);
      }
    },
    [selectedMasterLayoutId, masterMediaIds, updateLayoutItem, updateMasterElement],
  );

  const masterViewDeleteText = useCallback(
    (id) => {
      if (masterTextIds.has(id)) {
        deleteMasterElement("text", id);
      } else if (selectedMasterLayoutId) {
        const isPlaceholder = (selectedMasterLayout?.placeholders ?? []).some(
          (p) => p["placeholder-id"] === id,
        );
        if (isPlaceholder) {
          removeLayoutPlaceholder(selectedMasterLayoutId, id);
        } else {
          deleteLayoutElement(selectedMasterLayoutId, "text", id);
        }
      }
    },
    [selectedMasterLayoutId, selectedMasterLayout, masterTextIds, removeLayoutPlaceholder, deleteLayoutElement, deleteMasterElement],
  );

  const masterViewDeleteMedia = useCallback(
    (id) => {
      if (selectedMasterLayoutId && !masterMediaIds.has(id)) {
        deleteLayoutElement(selectedMasterLayoutId, "media", id);
      } else {
        deleteMasterElement("media", id);
      }
    },
    [selectedMasterLayoutId, masterMediaIds, deleteLayoutElement, deleteMasterElement],
  );

  const masterViewDeleteSelection = useCallback(
    (id) => {
      if (!id) return;
      const isMedia =
        masterMediaIds.has(id) ||
        (selectedMasterLayout?.elements?.media ?? []).some((m) => m.id === id) ||
        (selectedMasterLayout?.placeholders ?? []).some(
          (p) => (p.type === "image" || p.type === "video") && p["placeholder-id"] === id,
        );
      if (isMedia) {
        masterViewDeleteMedia(id);
      } else {
        masterViewDeleteText(id);
      }
    },
    [masterMediaIds, selectedMasterLayout, masterViewDeleteMedia, masterViewDeleteText],
  );

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
      if (!selectedTextEl) return;

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
          return text.replace(
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

      const selection = activeSelectionRef.current;
      const hasSelection =
        selection?.elementId === selectedTextEl.id &&
        !(
          selection.paragraphIdx ===
            (selection.endParagraphIdx ?? selection.paragraphIdx) &&
          selection.rangeStart === selection.rangeEnd
        );
      const paragraphs = structuredClone(selectedTextEl.paragraphs ?? []);

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

        let offset = 0;
        paragraph.runs = (paragraph.runs ?? []).map((run) => {
          const runText = run.text ?? "";
          const runStart = offset;
          const runEnd = runStart + runText.length;
          offset = runEnd;
          const overlapStart = Math.max(start, runStart);
          const overlapEnd = Math.min(end, runEnd);
          if (overlapStart >= overlapEnd) return run;
          const localStart = overlapStart - runStart;
          const localEnd = overlapEnd - runStart;
          return {
            ...run,
            text:
              runText.slice(0, localStart) +
              transform(runText.slice(localStart, localEnd)) +
              runText.slice(localEnd),
          };
        });
      });

      updateTextElementParagraphs(
        selectedSlideIndex,
        selectedTextEl.id,
        paragraphs,
      );
    },
    [
      selectedTextEl,
      selectedSlideIndex,
      updateTextElementParagraphs,
    ],
  );

  const handleStartEditing = useCallback((id) => {
    if (editingTextElementIdRef.current !== id) {
      setPendingFormatting({});
    }
    editingTextElementIdRef.current = id;
    setEditingTextElementId(id);
  }, []);

  const handleStopEditing = useCallback((id) => {
    editingTextElementIdRef.current = null;
    setEditingTextElementId((prev) => (prev === id ? null : prev));
    setPendingFormatting({});
  }, []);

  const handleSaveSelection = useCallback((elementId, offsets) => {
    const sel = offsets ? { elementId, ...offsets } : null;
    activeSelectionRef.current = sel;
    setActiveSelection(sel);
    const isRealSel =
      offsets &&
      !(
        offsets.paragraphIdx ===
          (offsets.endParagraphIdx ?? offsets.paragraphIdx) &&
        offsets.rangeStart === offsets.rangeEnd
      );
    if (isRealSel) setPendingFormatting({});
  }, []);

  const handleMasterSaveSelection = useCallback((elementId, offsets) => {
    setMasterActiveSelection(offsets ? { elementId, ...offsets } : null);
  }, []);

  const handleOpenPreviewFromBeginning = useCallback(() => {
    setPreviewStartSlide(0);
    openPreview();
  }, [openPreview]);

  const openFind = useCallback(() => {
    setFindReplaceMode("find");
    openFindReplace();
  }, [openFindReplace]);

  const openReplace = useCallback(() => {
    setFindReplaceMode("replace");
    openFindReplace();
  }, [openFindReplace]);

  const handleSelectAll = useCallback(() => {
    if (selectedTextEl && editingTextElementId === selectedTextEl.id) {
      const editable = document.querySelector(
        `[data-element-id="${selectedTextEl.id}"] [contenteditable="true"]`,
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

    const elementIds = [
      ...(selectedSlide?.contents?.text ?? []),
      ...(selectedSlide?.contents?.media ?? []),
    ].map((element) => element.id);
    selectElements(elementIds);
  }, [
    selectedTextEl,
    editingTextElementId,
    selectedSlide,
    selectElements,
  ]);

  const handleSelectObjects = useCallback(() => {
    setObjectSelectionMode((active) => !active);
  }, []);

  const handleOpenPreviewFromCurrent = useCallback(() => {
    setPreviewStartSlide(selectedSlideIndex);
    openPreview();
  }, [openPreview, selectedSlideIndex]);

  const handleToggleSlideHidden = useCallback(
    () => toggleSlideHidden(selectedSlideIndex),
    [toggleSlideHidden, selectedSlideIndex],
  );

  const handleApplyTransitionToAll = useCallback(
    () => applyTransitionToAll(currentTransition, currentDuration),
    [applyTransitionToAll, currentTransition, currentDuration],
  );

  const handleChangeParagraphs = useCallback(
    (elementId, paragraphs, grouped = false) =>
      updateTextElementParagraphs(selectedSlideIndex, elementId, paragraphs, grouped),
    [updateTextElementParagraphs, selectedSlideIndex],
  );

  const handleAddLayout = useCallback(
    () => addLayout(selectedMasterLayoutId),
    [addLayout, selectedMasterLayoutId],
  );

  const handleCloseSlideMasterView = useCallback(() => {
    setIsSlideMasterOpen(false);
    setSelectedMasterLayoutId(null);
  }, []);

  const handleUpdateMasterElementPosition = useCallback(
    (id, x, y) => {
      updateMasterElement(id, { position: { x, y } });
    },
    [updateMasterElement],
  );

  const handleUpdateMasterElementSize = useCallback(
    (id, w, h) => {
      updateMasterElement(id, { width: w, height: h });
    },
    [updateMasterElement],
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isNativeInput =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (isNativeInput) return;
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
    isLoading,
    saveStatus,
    linkedFolderPath,

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
    selectedMasterLayoutId,
    setSelectedMasterLayoutId,
    clearSelectionSignal,
    editingTextElementId,
    findReplaceMode,
    findReplace,
    showSelectionPane,
    setShowSelectionPane,
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
    handleNew,
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

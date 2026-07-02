import { useCallback } from "react";
import { storageRemove, storeMediaFile } from "../core/persistence/persistenceFacade";
import {
  EditorEventType,
  createEditorEvent,
} from "../core/events/editorEvents";
import {
  createAnimation,
  reorderAnimation,
} from "../core/operations/animationOperations";

export function useEditorActions(
  eventBus,
  selectedSlideIndex,
  slidesLength,
  presentationId,
) {
  const setSelectedSlideId = useCallback(
    (slideIndex) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.SELECT, { slideIndex }),
      ),
    [eventBus],
  );

  const addSlide = useCallback(
    (layoutId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.ADD, { layoutId }),
      ),
    [eventBus],
  );

  const deleteSlide = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.DELETE)),
    [eventBus],
  );

  const duplicateSlide = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.SLIDE.DUPLICATE)),
    [eventBus],
  );

  const moveSlideUp = useCallback(() => {
    if (selectedSlideIndex <= 0) return;
    eventBus.dispatch(
      createEditorEvent(EditorEventType.SLIDE.REORDER, {
        fromIndex: selectedSlideIndex,
        toIndex: selectedSlideIndex - 1,
      }),
    );
  }, [eventBus, selectedSlideIndex]);

  const moveSlideDown = useCallback(() => {
    if (selectedSlideIndex >= slidesLength - 1) return;
    eventBus.dispatch(
      createEditorEvent(EditorEventType.SLIDE.REORDER, {
        fromIndex: selectedSlideIndex,
        toIndex: selectedSlideIndex + 1,
      }),
    );
  }, [eventBus, selectedSlideIndex, slidesLength]);

  const reorderSlide = useCallback(
    (fromIndex, toIndex) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.REORDER, {
          fromIndex,
          toIndex,
        }),
      ),
    [eventBus],
  );

  const toggleSlideHidden = useCallback(
    (slideIndex) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.TOGGLE_HIDDEN, { slideIndex }),
      ),
    [eventBus],
  );

  const updateSlideBackground = useCallback(
    (background) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_BACKGROUND, {
          background,
        }),
      ),
    [eventBus],
  );

  const updateSlideTransition = useCallback(
    (transition) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_TRANSITION, {
          transition,
        }),
      ),
    [eventBus],
  );

  const updateTransitionDuration = useCallback(
    (duration) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_TRANSITION, {
          duration,
        }),
      ),
    [eventBus],
  );

  const applyTransitionToAll = useCallback(
    (transition, duration) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.APPLY_TRANSITION_TO_ALL, {
          transition,
          duration,
        }),
      ),
    [eventBus],
  );

  const updateSlideNotes = useCallback(
    (notes, slideIndex) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.SLIDE.UPDATE_NOTES, { notes, slideIndex }),
      ),
    [eventBus],
  );

  const addTextElement = useCallback(
    (textElement) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.ADD, { textElement }),
      ),
    [eventBus],
  );

  const updateTextElementContent = useCallback(
    (textElementId, newText, grouped = false) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_CONTENT, {
          textElementId,
          text: newText,
          userModified: true,
          grouped,
        }),
      ),
    [eventBus],
  );

  const updateTextElementFormatting = useCallback(
    (textElementId, formatting) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_FORMATTING, {
          textElementId,
          formatting,
        }),
      ),
    [eventBus],
  );

  const updateParagraphFormatting = useCallback(
    (elementId, paragraphIdx, formatting) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_PARAGRAPH_FORMATTING, {
          elementId,
          paragraphIdx,
          formatting,
        }),
      ),
    [eventBus],
  );

  const updateTextElementParagraphs = useCallback(
    (slideIndex, elementId, paragraphs, grouped = false, userModified = true) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_PARAGRAPHS, {
          slideIndex,
          elementId,
          paragraphs,
          grouped,
          userModified,
        }),
      ),
    [eventBus],
  );

  const updateTextRangeFormatting = useCallback(
    (
      elementId,
      paragraphIdx,
      rangeStart,
      endParagraphIdx,
      rangeEnd,
      formatting,
    ) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_RANGE_FORMATTING, {
          elementId,
          paragraphIdx,
          rangeStart,
          endParagraphIdx,
          rangeEnd,
          formatting,
        }),
      ),
    [eventBus],
  );

  const updateRunLink = useCallback(
    (elementId, paragraphIdx, rangeStart, rangeEnd, link) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.UPDATE_RUN_LINK, {
          elementId,
          paragraphIdx,
          rangeStart,
          rangeEnd,
          link,
        }),
      ),
    [eventBus],
  );

  const deleteTextElement = useCallback(
    (elementId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.TEXT.DELETE, { elementId }),
      ),
    [eventBus],
  );

  const selectElement = useCallback(
    (elementId, options = {}) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.SELECT, {
          elementId,
          ...options,
        }),
      ),
    [eventBus],
  );

  const selectElements = useCallback(
    (elementIds) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.SELECT, { elementIds }),
      ),
    [eventBus],
  );

  const updateElementPosition = useCallback(
    (elementId, x, y) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.UPDATE_SILENT, {
          elementId,
          updates: { position: { x, y } },
        }),
      ),
    [eventBus],
  );

  const updateElementSize = useCallback(
    (elementId, width, height) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.RESIZE, {
          elementId,
          size: { width, height },
        }),
      ),
    [eventBus],
  );

  const updateElement = useCallback(
    (elementId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.UPDATE, {
          elementId,
          updates,
        }),
      ),
    [eventBus],
  );

  const updateElementSilent = useCallback(
    (elementId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.UPDATE_SILENT, {
          elementId,
          updates,
        }),
      ),
    [eventBus],
  );

  const addAnimation = useCallback(
    (animation) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ANIMATION.ADD, { animation }),
      ),
    [eventBus],
  );

  const addAnimationForElement = useCallback(
    (elementId, effectValue, sequence) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ANIMATION.ADD, {
          animation: createAnimation(elementId, effectValue, sequence),
        }),
      ),
    [eventBus],
  );

  const updateAnimation = useCallback(
    (animationId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ANIMATION.UPDATE, {
          animationId,
          updates,
        }),
      ),
    [eventBus],
  );

  const reorderAnimations = useCallback(
    (animationList, animationId, direction) => {
      const updates = reorderAnimation(animationList, animationId, direction);
      if (updates.length === 0) return;
      eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.BEGIN));
      updates.forEach(({ id, sequence }) =>
        eventBus.dispatch(
          createEditorEvent(EditorEventType.ANIMATION.UPDATE, {
            animationId: id,
            updates: { sequence },
          }),
        ),
      );
      eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.COMMIT));
    },
    [eventBus],
  );

  const deleteAnimation = useCallback(
    (animationId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ANIMATION.DELETE, { animationId }),
      ),
    [eventBus],
  );

  const addMedia = useCallback(
    (mediaElement) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MEDIA.ADD, { mediaElement }),
      ),
    [eventBus],
  );

  const addFont = useCallback(
    async (fontName, fileBlob) => {
      const { key } = await storeMediaFile(fileBlob);
      const fontEntry = { "font-id": fontName, "font-file": `indexeddb://${key}` };
      eventBus.dispatch(createEditorEvent(EditorEventType.FONT.ADD, { fontEntry }));
    },
    [eventBus],
  );

  const removeFont = useCallback(
    (fontId) =>
      eventBus.dispatch(createEditorEvent(EditorEventType.FONT.DELETE, { fontId })),
    [eventBus],
  );

  const updateMedia = useCallback(
    (mediaId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MEDIA.UPDATE, { mediaId, updates }),
      ),
    [eventBus],
  );

  const deleteMedia = useCallback(
    (mediaId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MEDIA.DELETE, { mediaId }),
      ),
    [eventBus],
  );

  const updateMasterTheme = useCallback(
    (colorTheme, decorations, metadata) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_THEME, {
          colorTheme,
          decorations,
          metadata,
        }),
      ),
    [eventBus],
  );

  const updateMasterDimensions = useCallback(
    (slideDimensions, aspectRatio, dimensionUnits) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_DIMENSIONS, {
          slideDimensions,
          aspectRatio,
          dimensionUnits,
        }),
      ),
    [eventBus],
  );

  const updateMasterFormatting = useCallback(
    (formatting) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_FORMATTING, {
          formatting,
        }),
      ),
    [eventBus],
  );

  const updateMasterTextContent = useCallback(
    (elementId, text) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_ITEM, {
          elementId,
          updates: { text },
        }),
      ),
    [eventBus],
  );

  const updateMasterTextFormatting = useCallback(
    (elementId, formatting) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_ITEM, {
          elementId,
          updates: { formatting },
        }),
      ),
    [eventBus],
  );

  const addMasterElement = useCallback(
    (elementType, element) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.ADD_ELEMENT, {
          elementType,
          element,
        }),
      ),
    [eventBus],
  );

  const updateMasterElement = useCallback(
    (elementId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.UPDATE_ITEM, {
          elementId,
          updates,
        }),
      ),
    [eventBus],
  );

  const deleteMasterElement = useCallback(
    (elementType, elementId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.DELETE_ELEMENT, {
          elementType,
          elementId,
        }),
      ),
    [eventBus],
  );

  const toggleTitle = useCallback(
    (layoutId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.TOGGLE_TITLE, {
          layoutId: layoutId ?? null,
        }),
      ),
    [eventBus],
  );

  const toggleFooters = useCallback(
    (layoutId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.MASTER.TOGGLE_FOOTERS, {
          layoutId: layoutId ?? null,
        }),
      ),
    [eventBus],
  );

  const formatPainterCopy = useCallback(
    (elementId, formatting) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.FORMAT_PAINTER.COPY, {
          elementId,
          formatting,
        }),
      ),
    [eventBus],
  );

  const formatPainterPaste = useCallback(
    () =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.FORMAT_PAINTER.PASTE, {}),
      ),
    [eventBus],
  );

  const updateLayout = useCallback(
    (layoutId, placeholders) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.UPDATE_PLACEHOLDERS, {
          layoutId,
          placeholders,
        }),
      ),
    [eventBus],
  );

  const addLayout = useCallback(
    (afterLayoutId = null) => eventBus.dispatch(createEditorEvent(EditorEventType.LAYOUT.ADD, { afterLayoutId })),
    [eventBus],
  );

  const deleteLayout = useCallback(
    (layoutId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.DELETE, { layoutId }),
      ),
    [eventBus],
  );

  const applyLayoutFont = useCallback(
    (layoutId, font) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.UPDATE_FONT, {
          layoutId,
          font,
        }),
      ),
    [eventBus],
  );

  const renameLayout = useCallback(
    (layoutId, name) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.RENAME, { layoutId, name }),
      ),
    [eventBus],
  );

  const addLayoutElement = useCallback(
    (layoutId, elementType, element) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.ADD_ELEMENT, {
          layoutId,
          elementType,
          element,
        }),
      ),
    [eventBus],
  );

  const deleteLayoutElement = useCallback(
    (layoutId, elementType, elementId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.DELETE_ELEMENT, {
          layoutId,
          elementType,
          elementId,
        }),
      ),
    [eventBus],
  );

  const removeLayoutPlaceholder = useCallback(
    (layoutId, placeholderId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.DELETE_PLACEHOLDER, {
          layoutId,
          placeholderId,
        }),
      ),
    [eventBus],
  );

  const addLayoutPlaceholder = useCallback(
    (layoutId, placeholder) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.ADD_PLACEHOLDER, {
          layoutId,
          placeholder,
        }),
      ),
    [eventBus],
  );


  const updateLayoutItem = useCallback(
    (layoutId, itemId, updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.UPDATE_ITEM, {
          layoutId,
          itemId,
          updates,
        }),
      ),
    [eventBus],
  );

  const updateLayoutTextFormattingAction = useCallback(
    (layoutId, elementId, formattingUpdate) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.UPDATE_TEXT_FORMATTING, {
          layoutId,
          elementId,
          formattingUpdate,
        }),
      ),
    [eventBus],
  );

  const applyLayout = useCallback(
    (layoutId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.LAYOUT.APPLY, { layoutId }),
      ),
    [eventBus],
  );

  const resetLayout = useCallback(
    () =>
      eventBus.dispatch(createEditorEvent(EditorEventType.LAYOUT.RESET, {})),
    [eventBus],
  );

  const savePresentation = useCallback(
    () =>
      eventBus.dispatch(createEditorEvent(EditorEventType.PRESENTATION.SAVE)),
    [eventBus],
  );

  const toggleAutosave = useCallback(
    () =>
      eventBus.dispatch(createEditorEvent(EditorEventType.PRESENTATION.TOGGLE_AUTOSAVE)),
    [eventBus],
  );

  const createNewPresentation = useCallback(
    () =>
      eventBus.dispatch(createEditorEvent(EditorEventType.PRESENTATION.CREATE)),
    [eventBus],
  );

  const resetPresentation = useCallback(() => {
    const key = presentationId
      ? `presentation-${presentationId}`
      : "presentation";
    storageRemove(key).finally(() => window.location.reload());
  }, [presentationId]);

  const undo = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.UNDO)),
    [eventBus],
  );

  const redo = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.REDO)),
    [eventBus],
  );

  const beginHistory = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.BEGIN)),
    [eventBus],
  );

  const commitHistory = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.COMMIT)),
    [eventBus],
  );

  const cancelHistory = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.HISTORY.CANCEL)),
    [eventBus],
  );

  const copyElement = useCallback(
    (elementOrElements) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.COPY, {
          elements: Array.isArray(elementOrElements)
            ? elementOrElements
            : [elementOrElements],
        }),
      ),
    [eventBus],
  );

  const updateElements = useCallback(
    (updates) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.UPDATE_MANY, { updates }),
      ),
    [eventBus],
  );

  const pasteElement = useCallback(
    () => eventBus.dispatch(createEditorEvent(EditorEventType.ELEMENT.PASTE)),
    [eventBus],
  );

  const cutElement = useCallback(
    (elementOrElements) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.CUT, {
          elements: Array.isArray(elementOrElements)
            ? elementOrElements
            : [elementOrElements],
        }),
      ),
    [eventBus],
  );

  const deleteSelectedElements = useCallback(
    (elementIds) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.ELEMENT.DELETE_SELECTION, {
          elementIds,
        }),
      ),
    [eventBus],
  );

  const addComment = useCallback(
    (text, author) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.COMMENT.ADD, { text, author }),
      ),
    [eventBus],
  );

  const deleteComment = useCallback(
    (commentId) =>
      eventBus.dispatch(
        createEditorEvent(EditorEventType.COMMENT.DELETE, { commentId }),
      ),
    [eventBus],
  );

  return {
    setSelectedSlideId,
    addSlide,
    deleteSlide,
    duplicateSlide,
    moveSlideUp,
    moveSlideDown,
    reorderSlide,
    toggleSlideHidden,
    updateSlideBackground,
    updateSlideTransition,
    updateTransitionDuration,
    applyTransitionToAll,
    updateSlideNotes,
    selectElement,
    selectElements,
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
    deleteTextElement,
    addFont,
    removeFont,
    addMedia,
    updateMedia,
    deleteMedia,
    addAnimation,
    addAnimationForElement,
    updateAnimation,
    reorderAnimations,
    deleteAnimation,

    updateMasterTheme,
    updateMasterDimensions,
    updateMasterFormatting,
    addMasterElement,
    updateMasterElement,
    updateMasterTextContent,
    updateMasterTextFormatting,
    deleteMasterElement,
    toggleTitle,
    toggleFooters,
    formatPainterCopy,
    formatPainterPaste,
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
    applyLayout,
    resetLayout,
    savePresentation,
    toggleAutosave,
    createNewPresentation,
    resetPresentation,
    undo,
    redo,
    beginHistory,
    commitHistory,
    cancelHistory,
    copyElement,
    pasteElement,
    cutElement,
    deleteSelectedElements,
    addComment,
    deleteComment,
  };
}

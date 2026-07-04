import { useCallback, useState } from "react";

export function useEditorUiController({
  openPreview,
  presentation,
  selectedSlideIndex,
}) {
  const [activeSidePanel, setActiveSidePanel] = useState(null);
  const [previewStartSlide, setPreviewStartSlide] = useState(0);

  const setPanelOpen = useCallback((name, valueOrUpdater) => {
    setActiveSidePanel((current) => {
      const isOpen = current === name;
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(isOpen)
          : valueOrUpdater;
      return next ? name : isOpen ? null : current;
    });
  }, []);

  const setShowComments = useCallback(
    (valueOrUpdater) => setPanelOpen("comments", valueOrUpdater),
    [setPanelOpen],
  );
  const setShowSelectionPane = useCallback(
    (valueOrUpdater) => setPanelOpen("selection", valueOrUpdater),
    [setPanelOpen],
  );
  const setShowFormatBackground = useCallback(
    (valueOrUpdater) => setPanelOpen("format-background", valueOrUpdater),
    [setPanelOpen],
  );
  const setShowAltText = useCallback(
    (valueOrUpdater) => setPanelOpen("alt-text", valueOrUpdater),
    [setPanelOpen],
  );

  const handleOpenPreviewFromBeginning = useCallback(() => {
    setPreviewStartSlide(0);
    openPreview();
  }, [openPreview]);

  const handleOpenPreviewFromCurrent = useCallback(() => {
    const allSlides = presentation?.slideset?.slides ?? [];
    const visibleBefore = allSlides
      .slice(0, selectedSlideIndex)
      .filter((slide) => !slide.hidden).length;
    const lastVisibleIndex =
      allSlides.filter((slide) => !slide.hidden).length - 1;
    setPreviewStartSlide(
      Math.max(0, Math.min(visibleBefore, lastVisibleIndex)),
    );
    openPreview();
  }, [openPreview, selectedSlideIndex, presentation]);

  return {
    previewStartSlide,
    handleOpenPreviewFromBeginning,
    handleOpenPreviewFromCurrent,
    showComments: activeSidePanel === "comments",
    setShowComments,
    showSelectionPane: activeSidePanel === "selection",
    setShowSelectionPane,
    showFormatBackground: activeSidePanel === "format-background",
    setShowFormatBackground,
    showAltText: activeSidePanel === "alt-text",
    setShowAltText,
  };
}

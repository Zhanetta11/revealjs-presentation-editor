import { useState } from "react";

export function useEditorViewState() {
  const [zoom, setZoom] = useState(70);
  const [showUI, setShowUI] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [showNotes, setShowNotes] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEffect, setPreviewEffect] = useState(null);
  const [currentView, setCurrentView] = useState("normal");

  return {
    zoom,
    setZoom,
    zoomIn: () => setZoom((z) => Math.min(200, z + 10)),
    zoomOut: () => setZoom((z) => Math.max(25, z - 10)),
    handleCanvasZoom: (delta) =>
      setZoom((z) => Math.min(200, Math.max(25, z + delta))),

    showUI,
    openUI: () => setShowUI(true),
    closeUI: () => setShowUI(false),
    activeTab,
    setActiveTab,
    showNotes,
    toggleNotes: () => setShowNotes((v) => !v),
    currentView,
    setCurrentView,
    isPreviewOpen,
    openPreview: () => setIsPreviewOpen(true),
    closePreview: () => setIsPreviewOpen(false),
    previewEffect,
    setPreviewEffect,
    triggerAnimationPreview: (elementId, effect, speed, { byParagraph = false, paragraphCount = 1 } = {}) =>
      setPreviewEffect({ type: "animation", elementId, effect, speed, byParagraph, paragraphCount, key: Date.now() }),
    triggerTransitionPreview: (effect) =>
      setPreviewEffect({ type: "transition", effect, key: Date.now() }),
  };
}

import { useCallback, useState, useRef, useEffect, useLayoutEffect } from "react";
import { snapAngle, normalizeAngle, computeResize, getElementRotationAngle } from "../core/utils/canvasGeometry";

export function useCanvasInteractions({
  width,
  height,
  zoom,
  textElements,
  mediaElements,

  onSelectElement,

  onMoveTextElement,
  onResizeTextElement,
  onRotateTextElement,

  onMoveMediaElement,
  onResizeMediaElement,
  onRotateMediaElement,

  onBeginHistory,
  onCommitHistory,
  onCancelHistory,
}) {
  const [rotatingElement, setRotatingElement] = useState(null);
  const [snapInfo, setSnapInfo] = useState(null);

  const zoomScale = zoom / 100;

  const activeRef = useRef(null);

  const latestRef = useRef({});
  useLayoutEffect(() => {
    latestRef.current = {
      zoomScale,
      width,
      height,
      textElements,
      mediaElements,
      onMoveTextElement,
      onResizeTextElement,
      onRotateTextElement,
      onMoveMediaElement,
      onResizeMediaElement,
      onRotateMediaElement,
      onCommitHistory,
      onCancelHistory,
    };
  }, [
    height,
    mediaElements,
    onCancelHistory,
    onCommitHistory,
    onMoveMediaElement,
    onMoveTextElement,
    onResizeMediaElement,
    onResizeTextElement,
    onRotateMediaElement,
    onRotateTextElement,
    textElements,
    width,
    zoomScale,
  ]);

  const slideRectRef = useRef(null);

  const clearAll = useCallback(() => {
    activeRef.current = null;
    slideRectRef.current = null;
    setRotatingElement(null);
    setSnapInfo(null);
  }, []);

  const windowMoveHandler = useRef((event) => {
    const active = activeRef.current;
    const rect = slideRectRef.current;
    if (!active || !rect) return;

    const c = latestRef.current;
    const mouse = {
      x: (event.clientX - rect.left) / c.zoomScale,
      y: (event.clientY - rect.top) / c.zoomScale,
    };

    if (active.kind === "drag-text") {
      c.onMoveTextElement(active.elementId, mouse.x - active.offset.x, mouse.y - active.offset.y);
    }
    if (active.kind === "drag-media") {
      c.onMoveMediaElement(active.elementId, mouse.x - active.offset.x, mouse.y - active.offset.y);
    }
    if (active.kind === "resize-text") {
      const r = active.resizing;
      const { newX, newY, newW, newH } = computeResize(r.dir, r.initial, mouse, c.width, c.height);
      c.onMoveTextElement(r.id, newX, newY);
      c.onResizeTextElement(r.id, newW, newH);
    }
    if (active.kind === "resize-media") {
      const r = active.resizing;
      let { newX, newY, newW, newH } = computeResize(r.dir, r.initial, mouse, c.width, c.height);
      const isCorner = (r.dir.includes("n") || r.dir.includes("s")) && (r.dir.includes("e") || r.dir.includes("w"));
      if (r.aspectRatio && isCorner) {
        const ar = r.aspectRatio;
        if (newW / ar > newH) { newH = newW / ar; } else { newW = newH * ar; }
        if (r.dir.includes("w")) newX = r.initial.x + r.initial.width - newW;
        if (r.dir.includes("n")) newY = r.initial.y + r.initial.height - newH;
      }
      c.onMoveMediaElement(r.id, newX, newY);
      c.onResizeMediaElement(r.id, newW, newH);
    }
    if (active.kind === "rotate-text") {
      const el = c.textElements.find((e) => e.id === active.elementId);
      if (!el) return;
      const raw = getElementRotationAngle(el, mouse.x, mouse.y) - active.angleOffset;
      const snapped = snapAngle(raw);
      setSnapInfo({ angle: Math.round(snapped), snapped: snapped !== normalizeAngle(raw), elementId: active.elementId });
      c.onRotateTextElement?.(active.elementId, snapped);
    }
    if (active.kind === "rotate-media") {
      const media = c.mediaElements.find((e) => e.id === active.elementId);
      if (!media) return;
      const raw = getElementRotationAngle(media, mouse.x, mouse.y) - active.angleOffset;
      const snapped = snapAngle(raw);
      setSnapInfo({ angle: Math.round(snapped), snapped: snapped !== normalizeAngle(raw), elementId: active.elementId });
      c.onRotateMediaElement?.(active.elementId, snapped);
    }
  });
  
  const windowUpHandler = useRef(null);

  const stopInteraction = useCallback(() => {
    if (!activeRef.current) return;
    window.removeEventListener("mousemove", windowMoveHandler.current);
    window.removeEventListener("mouseup", windowUpHandler.current);
    latestRef.current.onCommitHistory?.();
    clearAll();
  }, [clearAll]);

  const cancelInteraction = useCallback(() => {
    if (!activeRef.current) return;
    window.removeEventListener("mousemove", windowMoveHandler.current);
    window.removeEventListener("mouseup", windowUpHandler.current);
    latestRef.current.onCancelHistory?.();
    clearAll();
  }, [clearAll]);

  useEffect(() => {
    windowUpHandler.current = stopInteraction;
  }, [stopInteraction]);

  const attachListeners = () => {
    window.addEventListener("mousemove", windowMoveHandler.current);
    window.addEventListener("mouseup", windowUpHandler.current);
  };

  useEffect(() => {
    const moveHandler = windowMoveHandler.current;
    const upHandler = windowUpHandler.current;
    return () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
    };
  }, []);

  const startDraggingText = useCallback(
    (event, textElementId) => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const el = textElements.find((e) => e.id === textElementId);
      if (!el) return;

      const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const offset = {
        x: (event.clientX - rect.left) / zoomScale - (el.position?.x ?? 0),
        y: (event.clientY - rect.top) / zoomScale - (el.position?.y ?? 0),
      };

      slideRectRef.current = rect;
      activeRef.current = { kind: "drag-text", elementId: textElementId, offset };
      onBeginHistory?.();
      onSelectElement?.(textElementId, { preserveIfSelected: true });
      attachListeners();
    },
    [textElements, onBeginHistory, onSelectElement, zoomScale],
  );

  const startDraggingMedia = useCallback(
    (event, mediaId) => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const media = mediaElements.find((e) => e.id === mediaId);
      if (!media) return;

      const rect = event.currentTarget.parentElement.getBoundingClientRect();
      const offset = {
        x: (event.clientX - rect.left) / zoomScale - (media.position?.x ?? 0),
        y: (event.clientY - rect.top) / zoomScale - (media.position?.y ?? 0),
      };

      slideRectRef.current = rect;
      activeRef.current = { kind: "drag-media", elementId: mediaId, offset };
      onBeginHistory?.();
      onSelectElement?.(mediaId, { preserveIfSelected: true });
      attachListeners();
    },
    [mediaElements, onBeginHistory, onSelectElement, zoomScale],
  );

  const startResizingText = useCallback(
    (event, textElementId, dir = "se") => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const el = textElements.find((e) => e.id === textElementId);
      if (!el) return;

      const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / zoomScale;
      const mouseY = (event.clientY - rect.top) / zoomScale;
      const resizing = {
        id: textElementId, dir,
        initial: { x: el.position?.x ?? 0, y: el.position?.y ?? 0, width: el.width ?? 300, height: el.height ?? 80, mouseX, mouseY },
      };

      slideRectRef.current = rect;
      activeRef.current = { kind: "resize-text", resizing };
      onBeginHistory?.();
      onSelectElement?.(textElementId, { preserveIfSelected: true });
      attachListeners();
    },
    [textElements, onBeginHistory, onSelectElement, zoomScale],
  );

  const startResizingMedia = useCallback(
    (event, mediaId, dir = "se") => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const media = mediaElements.find((e) => e.id === mediaId);
      if (!media) return;

      const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / zoomScale;
      const mouseY = (event.clientY - rect.top) / zoomScale;
      const initW = media.width ?? 300;
      const initH = media.height ?? 200;
      const resizing = {
        id: mediaId, dir, aspectRatio: initW / initH,
        initial: { x: media.position?.x ?? 0, y: media.position?.y ?? 0, width: initW, height: initH, mouseX, mouseY },
      };

      slideRectRef.current = rect;
      activeRef.current = { kind: "resize-media", resizing };
      onBeginHistory?.();
      onSelectElement?.(mediaId, { preserveIfSelected: true });
      attachListeners();
    },
    [mediaElements, onBeginHistory, onSelectElement, zoomScale],
  );

  const startRotatingText = useCallback(
    (event, textElementId) => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const el = textElements.find((e) => e.id === textElementId);
      if (!el) return;

      const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / zoomScale;
      const mouseY = (event.clientY - rect.top) / zoomScale;
      const angleOffset = getElementRotationAngle(el, mouseX, mouseY) - (el.rotation ?? 0);

      slideRectRef.current = rect;
      activeRef.current = { kind: "rotate-text", elementId: textElementId, angleOffset };
      onBeginHistory?.();
      onSelectElement?.(textElementId, { preserveIfSelected: true });
      setRotatingElement({ type: "text", id: textElementId, angleOffset });
      attachListeners();
    },
    [textElements, onBeginHistory, onSelectElement, zoomScale],
  );

  const startRotatingMedia = useCallback(
    (event, mediaId) => {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement?.blur();

      const media = mediaElements.find((e) => e.id === mediaId);
      if (!media) return;

      const rect = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / zoomScale;
      const mouseY = (event.clientY - rect.top) / zoomScale;
      const angleOffset = getElementRotationAngle(media, mouseX, mouseY) - (media.rotation ?? 0);

      slideRectRef.current = rect;
      activeRef.current = { kind: "rotate-media", elementId: mediaId, angleOffset };
      onBeginHistory?.();
      onSelectElement?.(mediaId, { preserveIfSelected: true });
      setRotatingElement({ type: "media", id: mediaId, angleOffset });
      attachListeners();
    },
    [mediaElements, onBeginHistory, onSelectElement, zoomScale],
  );

  return {
    stopInteraction,
    cancelInteraction,
    startDraggingText,
    startDraggingMedia,
    startResizingText,
    startResizingMedia,
    startRotatingText,
    startRotatingMedia,
    snapInfo,
    isRotating: Boolean(rotatingElement),
  };
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clampCrop,
  clampCropEdges,
  clampCropPan,
  computeCropOrigin,
  computeCropResult,
} from "../../../../../core/operations/mediaOperations";

export default function useMediaCrop({
  media,
  cropSignal,
  isPrimarySelected,
  onUpdateMedia,
  wrapperRef,
}) {
  const [isCropping, setIsCropping] = useState(false);
  const [localCrop, setLocalCrop] = useState([0, 0, 0, 0]);
  const [cropOrigin, setCropOrigin] = useState(null);
  const [cropPortalRect, setCropPortalRect] = useState(null);
  const cropDragRef = useRef(null);
  const localCropRef = useRef(localCrop);
  const cropOriginRef = useRef(cropOrigin);
  const handledCropSignalRef = useRef(cropSignal ?? 0);
  const mediaCrop = media.crop;
  const mediaWidth = media.width;
  const mediaHeight = media.height;
  const mediaX = media.position?.x;
  const mediaY = media.position?.y;
  const sourceWidth = media["source-width"];
  const sourceHeight = media["source-height"];

  useEffect(() => {
    localCropRef.current = localCrop;
  }, [localCrop]);

  useEffect(() => {
    cropOriginRef.current = cropOrigin;
  }, [cropOrigin]);

  useLayoutEffect(() => {
    if (isCropping && cropOrigin && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCropPortalRect((previousRect) => {
        if (
          previousRect &&
          previousRect.left === rect.left &&
          previousRect.top === rect.top &&
          previousRect.width === rect.width &&
          previousRect.height === rect.height
        ) {
          return previousRect;
        }
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      });
    } else if (!isCropping) {
      setCropPortalRect(null);
    }
  }, [cropOrigin, isCropping, wrapperRef]);

  const enterCropMode = useCallback(() => {
    const { initialCrop, ...origin } = computeCropOrigin({
      crop: mediaCrop,
      width: mediaWidth,
      height: mediaHeight,
      position: {
        x: mediaX,
        y: mediaY,
      },
      "source-width": sourceWidth,
      "source-height": sourceHeight,
    });
    setCropOrigin(origin);
    setLocalCrop(initialCrop);
    setIsCropping(true);
  }, [
    mediaCrop,
    mediaHeight,
    mediaWidth,
    mediaX,
    mediaY,
    sourceHeight,
    sourceWidth,
  ]);

  useEffect(() => {
    if (!cropSignal || cropSignal === handledCropSignalRef.current) return;
    handledCropSignalRef.current = cropSignal;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled && isPrimarySelected && !isCropping) enterCropMode();
    });
    return () => {
      cancelled = true;
    };
  }, [cropSignal, enterCropMode, isCropping, isPrimarySelected]);

  const applyCrop = useCallback(() => {
    const updates = computeCropResult(
      localCropRef.current,
      cropOriginRef.current,
    );
    onUpdateMedia?.(media.id, updates);
    setIsCropping(false);
  }, [media.id, onUpdateMedia]);

  const cancelCrop = useCallback(() => setIsCropping(false), []);

  useEffect(() => {
    if (!isCropping) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") cancelCrop();
      if (event.key === "Enter") applyCrop();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyCrop, cancelCrop, isCropping]);

  const startCropDrag = useCallback(
    (event, edges) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = wrapperRef.current?.getBoundingClientRect();
      const { srcW, srcH } = cropOriginRef.current ?? {};
      cropDragRef.current = {
        edges,
        startX: event.clientX,
        startY: event.clientY,
        startCrop: [...localCropRef.current],
        screenW: rect?.width ?? srcW ?? 200,
        screenH: rect?.height ?? srcH ?? 120,
      };

      const handleMouseMove = (moveEvent) => {
        const {
          edges: activeEdges,
          startX,
          startY,
          startCrop,
          screenW,
          screenH,
        } = cropDragRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const nextCrop = [...startCrop];
        if (activeEdges.includes("n")) {
          nextCrop[0] = startCrop[0] + (deltaY / screenH) * 100;
        }
        if (activeEdges.includes("e")) {
          nextCrop[1] = startCrop[1] - (deltaX / screenW) * 100;
        }
        if (activeEdges.includes("s")) {
          nextCrop[2] = startCrop[2] - (deltaY / screenH) * 100;
        }
        if (activeEdges.includes("w")) {
          nextCrop[3] = startCrop[3] + (deltaX / screenW) * 100;
        }
        setLocalCrop(clampCropEdges(nextCrop, activeEdges));
      };
      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [wrapperRef],
  );

  const startImagePan = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startCrop = [...localCropRef.current];
      const startOrigin = { ...cropOriginRef.current };
      const rect = wrapperRef.current?.getBoundingClientRect();
      const screenWidth = rect?.width ?? startOrigin.srcW;
      const screenHeight = rect?.height ?? startOrigin.srcH;

      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const [cropTop, cropRight, cropBottom, cropLeft] = startCrop;
        const deltaXPct = (deltaX / screenWidth) * 100;
        const deltaYPct = (deltaY / screenHeight) * 100;
        const nextLeft = cropLeft - deltaXPct;
        const nextRight = cropRight + deltaXPct;
        const nextTop = cropTop - deltaYPct;
        const nextBottom = cropBottom + deltaYPct;
        const nextCrop = clampCropPan([
          nextTop,
          nextRight,
          nextBottom,
          nextLeft,
        ]);
        const actualDeltaX =
          ((cropLeft - nextCrop[3]) / 100) * startOrigin.srcW;
        const actualDeltaY =
          ((cropTop - nextCrop[0]) / 100) * startOrigin.srcH;
        setCropOrigin({
          ...startOrigin,
          fullX: startOrigin.fullX + actualDeltaX,
          fullY: startOrigin.fullY + actualDeltaY,
        });
        setLocalCrop(nextCrop);
      };
      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [wrapperRef],
  );

  const startCropElementDrag = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startOrigin = { ...cropOriginRef.current };
      const rect = wrapperRef.current?.getBoundingClientRect();
      const screenScale =
        rect && startOrigin.srcW ? rect.width / startOrigin.srcW : 1;

      const handleMouseMove = (moveEvent) => {
        const deltaX = (moveEvent.clientX - startX) / screenScale;
        const deltaY = (moveEvent.clientY - startY) / screenScale;
        setCropOrigin({
          ...startOrigin,
          fullX: startOrigin.fullX + deltaX,
          fullY: startOrigin.fullY + deltaY,
        });
      };
      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [wrapperRef],
  );

  const startCropImageResize = useCallback(
    (event, direction) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startOrigin = { ...cropOriginRef.current };
      const [cropTop, cropRight, cropBottom, cropLeft] =
        localCropRef.current;
      const { srcW: sourceWidth, srcH: sourceHeight } = startOrigin;
      const rect = wrapperRef.current?.getBoundingClientRect();
      const screenScale =
        rect && sourceWidth ? rect.width / sourceWidth : 1;

      const windowX1 = Math.min(
        (cropLeft / 100) * sourceWidth,
        sourceWidth - (cropRight / 100) * sourceWidth,
      );
      const windowX2 = Math.max(
        (cropLeft / 100) * sourceWidth,
        sourceWidth - (cropRight / 100) * sourceWidth,
      );
      const windowY1 = Math.min(
        (cropTop / 100) * sourceHeight,
        sourceHeight - (cropBottom / 100) * sourceHeight,
      );
      const windowY2 = Math.max(
        (cropTop / 100) * sourceHeight,
        sourceHeight - (cropBottom / 100) * sourceHeight,
      );
      const cropWindowX = startOrigin.fullX + windowX1;
      const cropWindowY = startOrigin.fullY + windowY1;
      const cropWindowWidth = windowX2 - windowX1;
      const cropWindowHeight = windowY2 - windowY1;
      const isCorner =
        (direction.includes("n") || direction.includes("s")) &&
        (direction.includes("e") || direction.includes("w"));
      const aspectRatio = startOrigin.srcW / startOrigin.srcH;

      const handleMouseMove = (moveEvent) => {
        const deltaX = (moveEvent.clientX - startX) / screenScale;
        const deltaY = (moveEvent.clientY - startY) / screenScale;
        let { fullX, fullY, srcW, srcH } = startOrigin;

        if (direction.includes("e")) srcW = Math.max(10, srcW + deltaX);
        if (direction.includes("s")) srcH = Math.max(10, srcH + deltaY);
        if (direction.includes("w")) {
          srcW = Math.max(10, srcW - deltaX);
          fullX = startOrigin.fullX + startOrigin.srcW - srcW;
        }
        if (direction.includes("n")) {
          srcH = Math.max(10, srcH - deltaY);
          fullY = startOrigin.fullY + startOrigin.srcH - srcH;
        }
        if (isCorner) {
          if (srcW / aspectRatio > srcH) {
            srcH = srcW / aspectRatio;
          } else {
            srcW = srcH * aspectRatio;
          }
          if (direction.includes("w")) {
            fullX = startOrigin.fullX + startOrigin.srcW - srcW;
          }
          if (direction.includes("n")) {
            fullY = startOrigin.fullY + startOrigin.srcH - srcH;
          }
        }

        const nextLeft = ((cropWindowX - fullX) / srcW) * 100;
        const nextTop = ((cropWindowY - fullY) / srcH) * 100;
        const nextRight =
          ((fullX + srcW - cropWindowX - cropWindowWidth) / srcW) * 100;
        const nextBottom =
          ((fullY + srcH - cropWindowY - cropWindowHeight) / srcH) * 100;
        const scale = startOrigin.scale ?? 1;
        setCropOrigin({
          ...startOrigin,
          fullX,
          fullY,
          srcW,
          srcH,
          sourceWidth: srcW / scale,
          sourceHeight: srcH / scale,
        });
        setLocalCrop(clampCrop([nextTop, nextRight, nextBottom, nextLeft]));
      };
      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [wrapperRef],
  );

  const cropGeometry = useMemo(() => {
    const width =
      isCropping && cropOrigin ? cropOrigin.srcW : (media.width ?? 300);
    const height =
      isCropping && cropOrigin ? cropOrigin.srcH : (media.height ?? 200);
    const [cropTop, cropRight, cropBottom, cropLeft] = localCrop;
    const leftRaw = (cropLeft / 100) * width;
    const rightRaw = width - (cropRight / 100) * width;
    const topRaw = (cropTop / 100) * height;
    const bottomRaw = height - (cropBottom / 100) * height;
    const left = Math.min(leftRaw, rightRaw);
    const right = Math.max(leftRaw, rightRaw);
    const top = Math.min(topRaw, bottomRaw);
    const bottom = Math.max(topRaw, bottomRaw);

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      shadeTop: Math.max(0, top),
      shadeBottom: Math.max(0, height - bottom),
      shadeLeft: Math.max(0, left),
      shadeRight: Math.max(0, width - right),
    };
  }, [cropOrigin, isCropping, localCrop, media.height, media.width]);

  return {
    isCropping,
    localCrop,
    cropOrigin,
    cropPortalRect,
    cropGeometry,
    enterCropMode,
    applyCrop,
    cancelCrop,
    startCropDrag,
    startImagePan,
    startCropElementDrag,
    startCropImageResize,
  };
}

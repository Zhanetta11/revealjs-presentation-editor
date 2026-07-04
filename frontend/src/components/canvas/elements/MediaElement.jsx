import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMediaSrc } from "../../../hooks/media/useMediaSrc";
import {
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildBevelOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
} from "../../../core/render/revealRenderer";
import MediaElementHandles, { RESIZE_HANDLES } from "./media/MediaElementHandles";
import MediaElementMenus from "./media/MediaElementMenus";
import useMediaCrop from "./media/hooks/useMediaCrop";
import useMediaInteractions from "./media/hooks/useMediaInteractions";
import "./MediaElement.css";

const CROP_HANDLES = [
  { id: "nw", edges: ["n","w"], cursor: "nwse-resize" },
  { id: "n",  edges: ["n"],     cursor: "ns-resize"   },
  { id: "ne", edges: ["n","e"], cursor: "nesw-resize" },
  { id: "e",  edges: ["e"],     cursor: "ew-resize"   },
  { id: "se", edges: ["s","e"], cursor: "nwse-resize" },
  { id: "s",  edges: ["s"],     cursor: "ns-resize"   },
  { id: "sw", edges: ["s","w"], cursor: "nesw-resize" },
  { id: "w",  edges: ["w"],     cursor: "ew-resize"   },
];

export default function MediaElement({
  media,
  isSelected,
  isPrimarySelected = isSelected,
  onSelect,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onUpdateMedia,
  onNewComment,
  onOpenPictureFormat,
  onContextMenu,
  previewClassName,
  animationOrder,
  cropSignal,
  previewEffects,
  externalPreviewStyleId,
}) {
  const resolvedSrc = useMediaSrc(media["file-link"]);
  const effectiveMedia = previewEffects
    ? { ...media, effects: { ...(media.effects ?? {}), ...previewEffects } }
    : media;
  const isVideo = media["media-type"] === "video";
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const {
    isCropping,
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
  } = useMediaCrop({
    media,
    cropSignal,
    isPrimarySelected,
    onUpdateMedia,
    wrapperRef,
  });
  const {
    isPlayingVideo,
    contextMenu,
    stylePicker,
    previewStyleId,
    setPreviewStyleId,
    closeContextMenu,
    openStylePicker,
    selectStyle,
    closeStylePicker,
    startVideoPlayback,
    stopVideoPlayback,
    handlePlaceholderMouseDown,
    handleDoubleClick,
    handleMouseDown,
    handleContextMenu,
  } = useMediaInteractions({
    media,
    isSelected,
    isCropping,
    onSelect,
    onStartDrag,
    onOpenPictureFormat,
    onContextMenu,
    onUpdateMedia,
    startCropElementDrag,
  });

  useEffect(() => {
    if (isPlayingVideo) videoRef.current?.play?.().catch(() => {});
  }, [isPlayingVideo]);

  const activeStyleId = previewStyleId ?? externalPreviewStyleId ?? effectiveMedia.effects?.["style-id"];
  const styledMedia = activeStyleId === effectiveMedia.effects?.["style-id"]
    ? effectiveMedia
    : { ...effectiveMedia, effects: { ...(effectiveMedia.effects ?? {}), "style-id": activeStyleId } };
  const baseContainerStyle = buildMediaContainerStyle(styledMedia);

  const { maskImage, WebkitMaskImage, ...baseContainerWithoutMask } = baseContainerStyle;
  const softEdgeMaskStyle = maskImage ? { maskImage, WebkitMaskImage } : {};

  const containerStyle = isCropping && cropOrigin
    ? {
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${cropOrigin.fullX}px, ${cropOrigin.fullY}px)`,
        width: `${cropOrigin.srcW}px`,
        height: `${cropOrigin.srcH}px`,
        zIndex: media["z-index"] ?? 1,
        overflow: "hidden",
        willChange: "transform",
      }
    : {
        ...baseContainerWithoutMask,
        overflow: "visible",
        willChange: "transform",
      };

  const innerStyle = isCropping
    ? { width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "auto" }
    : buildMediaInnerStyle(media);

  const mediaFilter = buildMediaFilterStyle(styledMedia);
  const filteredInnerStyle = mediaFilter ? { ...innerStyle, filter: mediaFilter } : innerStyle;
  const borderOverlayStyle = buildMediaBorderOverlayStyle(styledMedia);
  const bevelOverlayStyle = buildBevelOverlayStyle(styledMedia);
  const reflectionStyle = buildMediaReflectionStyle(styledMedia, { relative: true });
  const reflectionContentStyle = buildMediaReflectionContentStyle(styledMedia);

  const {
    width: W,
    height: H,
    left: x1,
    right: x2,
    top: y1,
    bottom: y2,
    shadeTop: tPx,
    shadeBottom: bPx,
    shadeLeft: lPx,
    shadeRight: rPx,
  } = cropGeometry;

  const getCropHandlePos = (id) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return {
      nw: { left: x1, top: y1 }, n: { left: midX, top: y1 }, ne: { left: x2, top: y1 },
      e:  { left: x2, top: midY },
      se: { left: x2, top: y2 }, s: { left: midX, top: y2 }, sw: { left: x1, top: y2 },
      w:  { left: x1, top: midY },
    }[id];
  };

  const pScale = cropPortalRect ? cropPortalRect.width / W : 1;
  const pL = cropPortalRect?.left ?? 0;
  const pT = cropPortalRect?.top  ?? 0;
  const toSX = (cx) => pL + cx * pScale;
  const toSY = (cy) => pT + cy * pScale;

  const cropPortal = (isCropping && cropPortalRect)
    ? createPortal(
        <>
          {/* Crop boundary outline */}
          <div style={{
            position: "fixed",
            left: toSX(x1), top: toSY(y1),
            width: (x2 - x1) * pScale, height: (y2 - y1) * pScale,
            outline: "1.5px solid #ffffff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            zIndex: 9901,
            boxSizing: "border-box",
          }} />

          {/* Rule-of-thirds grid */}
          <div style={{
            position: "fixed",
            left: toSX(x1), top: toSY(y1),
            width: (x2 - x1) * pScale, height: (y2 - y1) * pScale,
            pointerEvents: "none",
            zIndex: 9902,
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.35)" }} />
            <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.35)" }} />
          </div>

          {/* Source-image resize handles — rendered first so crop handles sit on top */}
          {RESIZE_HANDLES.map(({ dir, cursor }) => {
            const rx = dir.includes("w") ? cropPortalRect.left
                     : dir.includes("e") ? cropPortalRect.right
                     : cropPortalRect.left + cropPortalRect.width / 2;
            const ry = dir.includes("n") ? cropPortalRect.top
                     : dir.includes("s") ? cropPortalRect.bottom
                     : cropPortalRect.top + cropPortalRect.height / 2;
            return (
              <div
                key={`cir-${dir}`}
                style={{
                  position: "fixed",
                  left: rx, top: ry,
                  width: 10, height: 10,
                  background: "#fff",
                  border: "1.5px solid #888",
                  borderRadius: "50%",
                  zIndex: 9910,
                  transform: "translate(-50%, -50%)",
                  cursor,
                  pointerEvents: "auto",
                  boxSizing: "border-box",
                }}
                onMouseDown={(e) => { e.stopPropagation(); startCropImageResize(e, dir); }}
              />
            );
          })}

          {/* Crop edge/corner handles — rendered after so they appear on top when positions overlap */}
          {CROP_HANDLES.map(({ id, edges, cursor }) => {
            const { left, top } = getCropHandlePos(id);
            const isCornerH = ["nw","ne","se","sw"].includes(id);
            const hSize = isCornerH ? 12 : 10;
            return (
              <div
                key={id}
                style={{
                  position: "fixed",
                  left: toSX(left), top: toSY(top),
                  width: hSize, height: hSize,
                  background: "#ffffff",
                  border: "1.5px solid rgba(0,0,0,0.5)",
                  zIndex: 9910,
                  transform: "translate(-50%, -50%)",
                  cursor,
                  pointerEvents: "auto",
                  boxSizing: "border-box",
                }}
                onMouseDown={(e) => startCropDrag(e, edges)}
              />
            );
          })}

          {/* Apply / Cancel buttons */}
          <div style={{
            position: "fixed",
            left: toSX(Math.max(0, x1)),
            top: toSY(Math.min(y2, H)) + 4,
            zIndex: 9910,
            display: "flex",
            gap: 6,
            pointerEvents: "auto",
          }}>
            <button
              className="crop-actions__btn crop-actions__btn--cancel"
              onMouseDown={(e) => { e.stopPropagation(); cancelCrop(); }}
            >
              Cancel
            </button>
            <button
              className="crop-actions__btn crop-actions__btn--apply"
              onMouseDown={(e) => { e.stopPropagation(); applyCrop(); }}
            >
              ✓ Apply
            </button>
          </div>
        </>,
        document.body,
      )
    : null;

  if (!resolvedSrc && !isVideo) {
    return (
      <div
        ref={wrapperRef}
        data-element-id={media.id}
        className={["canvas-media-wrapper", isSelected ? "selected" : "", previewClassName].filter(Boolean).join(" ")}
        style={{
          ...containerStyle,
          border: "1.5px dashed rgba(100,100,100,0.4)",
          background: "rgba(180,180,180,0.08)",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "default",
        }}
        onMouseDown={handlePlaceholderMouseDown}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {isPrimarySelected && <MediaElementHandles mediaId={media.id} onStartResize={onStartResize} onStartRotate={onStartRotate} />}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      data-element-id={media.id}
      className={[
        "canvas-media-wrapper",
        isSelected && !isCropping ? "selected" : "",
        isCropping ? "cropping" : "",
        previewClassName,
      ].filter(Boolean).join(" ")}
      style={containerStyle}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {animationOrder != null && !isCropping && (
        <span className="animation-order-badge">{animationOrder}</span>
      )}

      {/* Content layer — always overflow:hidden to clip the image */}
      {isCropping ? (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {isVideo ? (
            <>
              <video src={resolvedSrc} className="canvas-media" style={innerStyle} preload="metadata" onLoadedMetadata={(e) => { e.target.currentTime = 0; }} />
              <div style={{ position: "absolute", inset: 0, cursor: "default" }} />
            </>
          ) : (
            <img
              src={resolvedSrc} alt="" className="canvas-media"
              style={{ ...innerStyle, cursor: "grab" }}
              onMouseDown={startImagePan}
            />
          )}
          {/* Dark shade strips outside the crop window */}
          <div className="crop-shade" style={{ top: 0,    left: 0, right: 0,  height: tPx, cursor: "move" }} onMouseDown={startCropElementDrag} />
          <div className="crop-shade" style={{ bottom: 0, left: 0, right: 0,  height: bPx, cursor: "move" }} onMouseDown={startCropElementDrag} />
          <div className="crop-shade" style={{ top: tPx, bottom: bPx, left: 0,  width: lPx, cursor: "move" }} onMouseDown={startCropElementDrag} />
          <div className="crop-shade" style={{ top: tPx, bottom: bPx, right: 0, width: rPx, cursor: "move" }} onMouseDown={startCropElementDrag} />
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", ...softEdgeMaskStyle }}>
          {isVideo ? (
            <>
              <video
                ref={videoRef}
                src={resolvedSrc} className="canvas-media" style={filteredInnerStyle}
                preload={isPlayingVideo ? "metadata" : "none"}
                controls={isPlayingVideo}
                onEnded={stopVideoPlayback}
              />
              {!isPlayingVideo && (
                <div style={{ position: "absolute", inset: 0, cursor: "move", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={startVideoPlayback}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              )}
            </>
          ) : (
            <img src={resolvedSrc} alt={media.decorative ? "" : (media.alt ?? "")} className="canvas-media" style={filteredInnerStyle} />
          )}
        </div>
      )}

      {!isCropping && borderOverlayStyle && (
        <div style={borderOverlayStyle} />
      )}

      {/* Bevel overlay — rendered above image so inset shadow is visible */}
      {!isCropping && bevelOverlayStyle && (
        <div style={bevelOverlayStyle} />
      )}

      {!isCropping && !isVideo && reflectionStyle && (
        <div style={reflectionStyle} aria-hidden="true">
          <div style={reflectionContentStyle}>
            <img src={resolvedSrc} alt="" className="canvas-media" style={filteredInnerStyle} />
            {borderOverlayStyle && <div style={borderOverlayStyle} />}
            {bevelOverlayStyle && <div style={bevelOverlayStyle} />}
          </div>
        </div>
      )}

      {isPrimarySelected && !isCropping && (
        <MediaElementHandles
          mediaId={media.id}
          onStartResize={onStartResize}
          onStartRotate={onStartRotate}
        />
      )}

      <MediaElementMenus
        media={media}
        contextMenu={contextMenu}
        stylePicker={stylePicker}
        onEnterCropMode={enterCropMode}
        onNewComment={onNewComment}
        onCloseContextMenu={closeContextMenu}
        onOpenStylePicker={openStylePicker}
        onPreviewStyle={setPreviewStyleId}
        onSelectStyle={selectStyle}
        onCloseStylePicker={closeStylePicker}
      />

      {/* Crop overlay portal — rendered to document.body, position:fixed */}
      {cropPortal}
    </div>
  );
}

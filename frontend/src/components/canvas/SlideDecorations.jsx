import { useMediaSrc } from "../../hooks/media/useMediaSrc";
import { paragraphsToHTML } from "../../core/text/textFormatting";
import {
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildBevelOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
} from "../../core/render/revealRenderer";

function MediaDecorationElement({ el, zIndex, interactive = false, onPromote }) {
  const resolvedSrc = useMediaSrc(el["file-link"]);
  const src = el.src ?? resolvedSrc;
  const isVideo = el["media-type"] === "video";
  const containerStyle = {
    ...buildMediaContainerStyle(el),
    pointerEvents: (interactive || onPromote) ? "auto" : "none",
    cursor: onPromote ? "pointer" : undefined,
    zIndex: zIndex ?? 5,
  };
  const innerStyle = buildMediaInnerStyle(el);
  const cssFilter = buildMediaFilterStyle(el);
  const filteredInnerStyle = cssFilter ? { ...innerStyle, filter: cssFilter } : innerStyle;
  const borderStyle = buildMediaBorderOverlayStyle(el);
  const bevelStyle = buildBevelOverlayStyle(el);
  const reflectionStyle = buildMediaReflectionStyle(el);
  const reflectionContentStyle = buildMediaReflectionContentStyle(el);

  const handleClick = onPromote ? (e) => { e.stopPropagation(); onPromote(); } : undefined;

  return (
    <>
      <div style={containerStyle} onClick={handleClick}>
        {isVideo ? (
          <video
            src={src}
            preload="metadata"
            {...(interactive ? { controls: true } : { onLoadedMetadata: (e) => { e.target.currentTime = 0; } })}
            style={filteredInnerStyle}
          />
        ) : (
          <img src={src} alt="" style={filteredInnerStyle} />
        )}
        {isVideo && !interactive && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        )}
        {borderStyle && <div style={borderStyle} />}
        {bevelStyle && <div style={bevelStyle} />}
      </div>
      {!isVideo && reflectionStyle && (
        <div style={{ ...reflectionStyle, zIndex: zIndex ?? 5 }} aria-hidden="true">
          <div style={reflectionContentStyle}>
            <img src={src} alt="" style={filteredInnerStyle} />
            {borderStyle && <div style={borderStyle} />}
            {bevelStyle && <div style={bevelStyle} />}
          </div>
        </div>
      )}
    </>
  );
}

export default function SlideDecorations({ presentation, width, height, hideMasterElements = false, layoutId, interactive = false, slideContentIds, onPromoteLayoutElement, onContextMenuLayoutText }) {
  const master = presentation?.slideset?.master;
  const decorations = master?.decorations;
  const masterElements = hideMasterElements ? null : master?.elements;
  const layout = layoutId
    ? (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === layoutId)
    : null;
  const layoutElements = layout?.elements ?? null;
  const layoutPlaceholders = (layout?.placeholders ?? []).filter(
    (p) => p.type === "text" && !slideContentIds?.has(p["placeholder-id"]),
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {decorations?.shapes?.length > 0 && (
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: 0,
          }}
          viewBox={`0 0 ${width ?? 960} ${height ?? 540}`}
          preserveAspectRatio="none"
        >
          {decorations.shapes.map((shape, i) => {
            const common = {
              fill: shape.fill ?? "none",
              stroke: shape.stroke ?? "none",
              strokeWidth: shape.strokeWidth ?? 0,
              opacity: shape.opacity ?? 1,
            };
            switch (shape.type) {
              case "rect":
                return (
                  <rect key={i} {...common}
                    x={shape.x} y={shape.y}
                    width={shape.w} height={shape.h}
                    rx={shape.rx ?? 0} ry={shape.ry ?? 0}
                  />
                );
              case "circle":
                return <circle key={i} {...common} cx={shape.cx} cy={shape.cy} r={shape.r} />;
              case "ellipse":
                return <ellipse key={i} {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
              case "polygon":
                return <polygon key={i} {...common} points={shape.points} />;
              case "line":
                return (
                  <line key={i} {...common}
                    x1={shape.x1} y1={shape.y1}
                    x2={shape.x2} y2={shape.y2}
                    stroke={shape.stroke ?? common.fill}
                    strokeWidth={shape.strokeWidth ?? 2}
                  />
                );
              case "path":
                return <path key={i} {...common} d={shape.d} />;
              default:
                return null;
            }
          })}
        </svg>
      )}

      {(masterElements?.text ?? []).filter((el) => !el.hidden).map((el) => {
        const fmt = el.paragraphs?.[0]?.formatting ?? {};
        const mf = master?.formatting ?? {};
        const verticalAlign = fmt["vertical-align"] ?? mf["vertical-align"] ?? "top";
        const justifyContent = verticalAlign === "middle" ? "center" : verticalAlign === "bottom" ? "flex-end" : "flex-start";
        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: el.position?.x ?? 0,
              top: el.position?.y ?? 0,
              width: el.width ?? 300,
              height: el.height ?? 80,
              background: el.background ?? "transparent",
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: el["z-index"] ?? 5,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent,
            }}
            dangerouslySetInnerHTML={{ __html: paragraphsToHTML(el.paragraphs, mf, {}, true) }}
          />
        );
      })}

      {(masterElements?.media ?? []).filter((el) => !el.hidden).map((el) => (
        <MediaDecorationElement key={el.id} el={el} zIndex={el["z-index"] ?? 5} interactive={interactive} />
      ))}

      {(layoutElements?.text ?? []).filter((el) => !el.hidden && !slideContentIds?.has(el.id)).map((el) => {
        const fmt = el.paragraphs?.[0]?.formatting ?? {};
        const mf = master?.formatting ?? {};
        const canPromote = !!onPromoteLayoutElement;
        const verticalAlign = fmt["vertical-align"] ?? mf["vertical-align"] ?? "top";
        const justifyContent = verticalAlign === "middle" ? "center" : verticalAlign === "bottom" ? "flex-end" : "flex-start";
        return (
          <div
            key={el.id}
            onClick={canPromote ? () => onPromoteLayoutElement(el, "text") : undefined}
            onContextMenu={onContextMenuLayoutText ? (e) => { e.stopPropagation(); onContextMenuLayoutText(el, e); } : undefined}
            style={{
              position: "absolute",
              left: el.position?.x ?? 0,
              top: el.position?.y ?? 0,
              width: el.width ?? 300,
              height: el.height ?? 80,
              background: el.background ?? "transparent",
              overflow: "hidden",
              pointerEvents: canPromote ? "auto" : "none",
              cursor: canPromote ? "pointer" : undefined,
              zIndex: el["z-index"] ?? 4,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent,
            }}
            dangerouslySetInnerHTML={{ __html: paragraphsToHTML(el.paragraphs, mf, {}, true) }}
          />
        );
      })}

      {(layoutElements?.media ?? []).filter((el) => !el.hidden && !slideContentIds?.has(el.id)).map((el) => (
        <MediaDecorationElement
          key={el.id}
          el={el}
          zIndex={el["z-index"] ?? 4}
          interactive={interactive}
          onPromote={onPromoteLayoutElement ? () => onPromoteLayoutElement(el, "media") : undefined}
        />
      ))}

      {layoutPlaceholders.map((p) => {
        const bg = p.background ?? null;
        if (!bg || bg === "transparent" || bg === "#FFFFFF00") return null;
        return (
          <div
            key={p["placeholder-id"]}
            style={{
              position: "absolute",
              left: p.position?.x ?? 0,
              top: p.position?.y ?? 0,
              width: p.width ?? 300,
              height: p.height ?? 80,
              background: bg,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: p["z-index"] ?? 1,
              transform: p.rotation ? `rotate(${p.rotation}deg)` : undefined,
              boxSizing: "border-box",
            }}
          />
        );
      })}
    </div>
  );
}

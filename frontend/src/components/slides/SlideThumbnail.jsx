import { useRef, useState, useEffect } from "react";
import { useMediaSrc } from "../../hooks/useMediaSrc";
import {
  buildColorThemeStyle,
  buildTextElementStyle,
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildBevelOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
} from "../../core/render/revealRenderer";
import { paragraphsToHTML } from "../../core/text/textFormatting";
import { getPlaceholderFormatting, getPlaceholderPadding, getPlaceholderBackground, getSlideContentIds } from "../../core/render/slidesetRenderUtils";
import SlideDecorations from "../canvas/SlideDecorations";
import "./SlideThumbnail.css";

const PLACEHOLDER_PROMPTS = new Set([
  "",
  "Start editing your presentation.",
  "Click to edit text",
  "Click to add text",
  "Click to edit second content",
  "Click to add picture",
  "Click to edit caption",
]);

const getPlainText = (paragraphs = []) =>
  paragraphs
    .map((paragraph) =>
      (paragraph.runs ?? []).map((run) => run.text ?? "").join(""),
    )
    .join("\n")
    .trim();

const isEmptyPlaceholderPrompt = (textElement) =>
  textElement["placeholder-id"] && PLACEHOLDER_PROMPTS.has(getPlainText(textElement.paragraphs));

function ThumbnailMedia({ media, index }) {
  const src = useMediaSrc(media["file-link"]);
  const containerStyle = buildMediaContainerStyle(media, index);
  const innerStyle = buildMediaInnerStyle(media);
  const cssFilter = buildMediaFilterStyle(media);
  const borderStyle = buildMediaBorderOverlayStyle(media);
  const bevelStyle = buildBevelOverlayStyle(media);

  const reflectionStyle = buildMediaReflectionStyle(media);
  const reflectionContentStyle = buildMediaReflectionContentStyle(media);

  const isVideo = media["media-type"] === "video";
  const mediaEl = isVideo
    ? <video src={src} style={{ ...innerStyle, ...(cssFilter ? { filter: cssFilter } : {}) }} preload="metadata" muted onLoadedMetadata={(e) => { e.target.currentTime = 0; }} />
    : <img src={src} alt="" style={{ ...innerStyle, ...(cssFilter ? { filter: cssFilter } : {}) }} />;

  return (
    <>
      <div style={{ ...containerStyle, pointerEvents: "none" }}>
        {mediaEl}
        {borderStyle && <div style={borderStyle} />}
        {bevelStyle && <div style={bevelStyle} />}
      </div>
      {reflectionStyle && !isVideo && (
        <div style={reflectionStyle} aria-hidden="true">
          <div style={reflectionContentStyle}>
            <img src={src} alt="" style={{ ...innerStyle, ...(cssFilter ? { filter: cssFilter } : {}) }} />
            {borderStyle && <div style={borderStyle} />}
            {bevelStyle && <div style={bevelStyle} />}
          </div>
        </div>
      )}
    </>
  );
}

export default function SlideThumbnail({
  slide,
  slideWidth = 1280,
  slideHeight = 720,
  presentation,
  commentCount = 0,
}) {
  const containerRef = useRef(null);
  const [thumbW, setThumbW] = useState(160);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setThumbW(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const textElements = slide?.contents?.text ?? [];
  const mediaElements = slide?.contents?.media ?? [];
  const scale = thumbW / slideWidth;
  const thumbH = Math.round(thumbW * slideHeight / slideWidth);
  const colorThemeStyle = buildColorThemeStyle(presentation);
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const slideBg = slide?.contents?.background ?? null;
  const isImageBg = slideBg && typeof slideBg === "object" && slideBg.type === "image";
  const bgFillImageKey = isImageBg ? slideBg["file-link"] : null;
  const bgFillImageSrc = useMediaSrc(bgFillImageKey);
  const bgFillSettings = isImageBg ? slideBg : {};

  return (
    <div
      ref={containerRef}
      className="slide-thumbnail"
      style={{ width: "100%", height: thumbH, ...colorThemeStyle }}
    >
      {commentCount > 0 && (
        <div
          className="slide-thumbnail-comment-badge"
          title={`${commentCount} comment${commentCount > 1 ? "s" : ""}`}
        >
          💬 {commentCount}
        </div>
      )}
      <div
        className="slide-thumbnail-inner"
        style={{
          width: slideWidth,
          height: slideHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background:
            !slideBg || isImageBg || slideBg === "#FFFFFFFF"
              ? "var(--bg-light, white)"
              : slideBg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {bgFillImageSrc && (() => {
          const s = bgFillSettings;
          const scale = s.fitToCanvas ?? false;
          const ol = scale ? 0 : (s.offsetLeft ?? 0) / 100;
          const or = scale ? 0 : (s.offsetRight ?? 0) / 100;
          const ot = scale ? 0 : (s.offsetTop ?? 0) / 100;
          const ob = scale ? 0 : (s.offsetBottom ?? 0) / 100;
          return (
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
              <img src={bgFillImageSrc} alt="" style={{
                position: "absolute",
                left: ol * slideWidth, top: ot * slideHeight,
                width: (1 - ol - or) * slideWidth,
                height: (1 - ot - ob) * slideHeight,
                objectFit: scale ? "fill" : "cover",
                opacity: 1 - (s.transparency ?? 0) / 100,
              }} />
            </div>
          );
        })()}
        <SlideDecorations
          presentation={presentation}
          width={slideWidth}
          height={slideHeight}
          layoutId={slide?.["layout-id"]}
          slideContentIds={getSlideContentIds(slide)}
        />
        {textElements.filter((element) => !element.hidden).map((textElement, index) => {
          const placeholderFormatting = getPlaceholderFormatting(presentation, slide, textElement);
          const placeholderPadding = getPlaceholderPadding(presentation, slide, textElement);
          const placeholderBackground = getPlaceholderBackground(presentation, slide, textElement);
          const style = buildTextElementStyle(textElement, index, masterFormatting, placeholderFormatting, placeholderPadding, placeholderBackground);
          if (isEmptyPlaceholderPrompt(textElement)) {
            const bg = style.background;
            const highlight = placeholderFormatting.highlight;
            const visibleBg = bg && bg !== "transparent" && bg !== "#FFFFFF00" ? bg : null;
            const visibleHighlight = highlight && highlight !== "transparent" ? highlight : null;
            if (!visibleBg && !visibleHighlight) return null;
            const html = paragraphsToHTML(textElement.paragraphs, masterFormatting, placeholderFormatting, true);
            return (
              <div
                key={textElement.id}
                style={{ ...style, color: "transparent" }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          const html = paragraphsToHTML(textElement.paragraphs, masterFormatting, placeholderFormatting, true);
          return (
            <div
              key={textElement.id}
              style={style}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })}
        {mediaElements.filter((element) => !element.hidden).map((media, index) => {
          if (!media["file-link"]) {
            return (
              <div
                key={media.id}
                style={{
                  ...buildMediaContainerStyle(media, index),
                  border: "1px dashed rgba(100,100,100,0.35)",
                  background: "rgba(180,180,180,0.1)",
                  boxSizing: "border-box",
                }}
              />
            );
          }
          return <ThumbnailMedia key={media.id} media={media} index={index} />;
        })}
      </div>
    </div>
  );
}

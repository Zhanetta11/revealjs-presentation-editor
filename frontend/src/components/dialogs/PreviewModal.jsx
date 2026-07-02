import { useEffect, useRef, useState, useCallback } from "react";
import { useMediaSrc } from "../../hooks/useMediaSrc";
import "reveal.js/reveal.css";
import "reveal.js/theme/white.css";
import "./PreviewModal.css";
import SlideDecorations from "../canvas/SlideDecorations";
import {
  initRevealDeck,
  buildTextElementStyle,
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildBevelOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
  buildVideoAttributes,
  buildSlideContainerStyle,
  buildColorThemeStyle,
  getTextLines,
  getVisibleSlidesForPreview,
  getSlideTextElements,
  getSlideMediaElements,
  getSlideDimensions,
  getRevealTransition,
  getRevealTransitionSpeed,
  buildAdjustedAnimationMap,
  getFragmentProps,
  getPerLineFragments,
} from "../../core/render/revealRenderer";
import {
  getPlaceholderFormatting,
  getPlaceholderPadding,
  getPlaceholderBackground,
  getSlideContentIds,
} from "../../core/render/slidesetRenderUtils";
import { paragraphsToHTML } from "../../core/text/textFormatting";

function BgFillElement({ fileLink, width, height, settings = {} }) {
  const src = useMediaSrc(fileLink);
  if (!src) return null;
  const scale = settings.fitToCanvas ?? false;
  const ol = scale ? 0 : (settings.offsetLeft ?? 0) / 100;
  const or = scale ? 0 : (settings.offsetRight ?? 0) / 100;
  const ot = scale ? 0 : (settings.offsetTop ?? 0) / 100;
  const ob = scale ? 0 : (settings.offsetBottom ?? 0) / 100;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
      <img
        src={src}
        alt=""
        style={{
          position: "absolute",
          left: ol * width, top: ot * height,
          width: (1 - ol - or) * width,
          height: (1 - ot - ob) * height,
          objectFit: scale ? "fill" : "cover",
          opacity: 1 - (settings.transparency ?? 0) / 100,
          maxWidth: "none",
          maxHeight: "none",
          margin: 0,
        }}
      />
    </div>
  );
}


function PreviewMediaElement({ media, index, fragmentProps }) {
  const src = useMediaSrc(media["file-link"]);
  const isVideo = media["media-type"] === "video";
  const innerStyle = buildMediaInnerStyle(media);
  const cssFilter = buildMediaFilterStyle(media);
  const filteredInnerStyle = cssFilter ? { ...innerStyle, filter: cssFilter } : innerStyle;
  const borderStyle = buildMediaBorderOverlayStyle(media);
  const bevelStyle = buildBevelOverlayStyle(media);
  const reflectionStyle = buildMediaReflectionStyle(media);
  const reflectionContentStyle = buildMediaReflectionContentStyle(media);
  const videoAttrs = buildVideoAttributes(media);

  return (
    <>
      <div style={buildMediaContainerStyle(media, index)} {...fragmentProps}>
        {isVideo ? (
          <video src={src} style={filteredInnerStyle} controls preload="metadata" {...videoAttrs} />
        ) : (
          <img src={src} alt="" style={filteredInnerStyle} />
        )}
        {borderStyle && <div style={borderStyle} />}
        {bevelStyle && <div style={bevelStyle} />}
      </div>
      {!isVideo && reflectionStyle && src && (
        <div style={reflectionStyle} aria-hidden="true">
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

export default function PreviewModal({ slides, presentation, onClose, initialSlide = 0 }) {
  const deckRef = useRef(null);
  const deckInstanceRef = useRef(null);
  const { width, height } = getSlideDimensions(presentation);
  const colorThemeStyle = buildColorThemeStyle(presentation);
  const [showUI, setShowUI] = useState(false);
  const hideTimerRef = useRef(null);

  const handleMouseMove = useCallback(() => {
    setShowUI(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowUI(false), 2000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!deckRef.current) return;
    const deck = initRevealDeck(deckRef.current, width, height, initialSlide);
    deckInstanceRef.current = deck;
    return () => {
      deck.destroy();
      deckInstanceRef.current = null;
    };
  }, [slides, width, height, initialSlide]);

  const handleClick = useCallback((e) => {
    if (e.target.closest(".preview-close")) return;
    if (e.target.closest("video")) return;
    const deck = deckInstanceRef.current;
    if (!deck) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX > rect.width / 2) {
      deck.next();
    } else {
      deck.prev();
    }
  }, []);

  const visibleSlides = getVisibleSlidesForPreview(slides);
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};

  return (
    <div
      className={`preview-overlay${showUI ? " show-ui" : ""}`}
      style={colorThemeStyle}
      onMouseMove={handleMouseMove}
    >
      <div className="preview-window" onClick={handleClick}>
        <button
          className="preview-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          ✕
        </button>

        <div className="reveal" ref={deckRef}>
          <div className="slides">
            {visibleSlides.map((slide, slideIndex) => {
              const textElements = getSlideTextElements(slide);
              const mediaElements = getSlideMediaElements(slide);
              const animationMap = buildAdjustedAnimationMap(slide);
              return (
                <section
                  key={`slide-${slideIndex}`}
                  data-transition={getRevealTransition(slide)}
                  data-transition-speed={getRevealTransitionSpeed(slide)}
                  style={{
                    background: (() => {
                      const bg = slide?.contents?.background ?? null;
                      const isImg = bg && typeof bg === "object" && bg.type === "image";
                      return !bg || isImg || bg === "#FFFFFFFF" ? "var(--bg-light, white)" : bg;
                    })(),
                  }}>
                  <div style={buildSlideContainerStyle(width, height)}>
                    {(() => {
                      const bg = slide?.contents?.background ?? null;
                      const isImg = bg && typeof bg === "object" && bg.type === "image";
                      return isImg ? <BgFillElement fileLink={bg["file-link"]} width={width} height={height} settings={bg} /> : null;
                    })()}
                    <SlideDecorations
                      presentation={presentation}
                      width={width}
                      height={height}
                      layoutId={slide?.["layout-id"]}
                      slideContentIds={getSlideContentIds(slide)}
                      interactive
                    />
                    {textElements.filter((element) => !element.hidden).map((textElement, index) => {
                      const animation = animationMap.get(textElement.id);
                      const placeholderFormatting = getPlaceholderFormatting(presentation, slide, textElement);
                      const placeholderPadding = getPlaceholderPadding(presentation, slide, textElement);
                      const placeholderBackground = getPlaceholderBackground(presentation, slide, textElement);
                      const baseStyle = buildTextElementStyle(
                        textElement,
                        index,
                        masterFormatting,
                        placeholderFormatting,
                        placeholderPadding,
                        placeholderBackground,
                      );
                      const lines = getTextLines(textElement);
                      const perLine = getPerLineFragments(textElement, animation, lines);

                      if (perLine) {
                        let runningCounter = 0;
                        return (
                          <div key={textElement.id || index} style={baseStyle}>
                            {perLine.map((entry, lineIndex) => {
                              const rawListType =
                                entry.paragraph.formatting?.["list-type"]
                                ?? placeholderFormatting["list-type"]
                                ?? masterFormatting["list-type"];
                              const listType =
                                rawListType && rawListType !== "none"
                                  ? rawListType
                                  : null;
                              const startCounter = listType === "numbered" ? runningCounter : 0;
                              if (listType === "numbered") runningCounter++;
                              else if (!listType) runningCounter = 0;
                              return (
                                <div
                                  key={lineIndex}
                                  {...entry.fragmentProps}
                                  dangerouslySetInnerHTML={{ __html: paragraphsToHTML([entry.paragraph], masterFormatting, placeholderFormatting, true, startCounter) }}
                                />
                              );
                            })}
                          </div>
                        );
                      }

                      const fragmentProps = getFragmentProps(animation);
                      return (
                        <div
                          key={textElement.id || index}
                          style={baseStyle}
                          {...fragmentProps}
                          dangerouslySetInnerHTML={{ __html: paragraphsToHTML(textElement.paragraphs, masterFormatting, placeholderFormatting, true) }}
                        />
                      );
                    })}

                    {mediaElements.filter((element) => !element.hidden).map((media, index) => {
                      const fragmentProps = getFragmentProps(animationMap.get(media.id));
                      return (
                        <PreviewMediaElement
                          key={media.id || index}
                          media={media}
                          index={index}
                          fragmentProps={fragmentProps}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

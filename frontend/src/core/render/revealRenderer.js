import Reveal from "reveal.js";
import {
  getEffectFilter,
  SHADOW_PRESETS,
  GLOW_PRESETS,
  SOFT_EDGES_PRESETS,
  BEVEL_PRESETS,
  ROTATION3D_PRESETS,
  REFLECTION_PRESETS,
} from "../model/imageEffects";
import { TRANSITIONS, DEFAULT_TRANSITION } from "../model/transitionDefaults";
import {
  getSlideSize,
  getTextElements,
  getMediaElements,
} from "../render/slidesetRenderUtils";
import { getStyleById } from "../model/imageStyles";
import { clampCrop, getCroppedMediaGeometry } from "../model/mediaCrop";

function findById(list, id) { return id ? list.find((p) => p.id === id) : null; }

export function buildTextElementStyle(textElement, index, masterFormatting = {}, placeholderFormatting = {}, placeholderPadding = null, placeholderBackground = null) {
  const formatting = textElement.paragraphs?.[0]?.formatting ?? {};
  const rotation = textElement.rotation ?? 0;
  const valid = (v) => (v != null && v !== "undefined" ? v : undefined);
  const r = (elemVal, phVal, masterVal, fallback) => valid(elemVal) ?? valid(phVal) ?? valid(masterVal) ?? fallback;

  const textDecoration = r(formatting["text-decoration"], placeholderFormatting["text-decoration"], masterFormatting["text-decoration"], null);
  const verticalAlign = r(formatting["vertical-align"], placeholderFormatting["vertical-align"], masterFormatting["vertical-align"], "top");
  const justifyContent = verticalAlign === "middle" ? "center" : verticalAlign === "bottom" ? "flex-end" : "flex-start";

  return {
    position: "absolute",
    left: `${textElement.position?.x ?? 0}px`,
    top: `${textElement.position?.y ?? 0}px`,
    width: `${textElement.width ?? 300}px`,
    height: `${textElement.height ?? 80}px`,
    background: textElement.background ?? placeholderBackground ?? "transparent",
    zIndex: textElement["z-index"] ?? 1,
    ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
    display: "flex",
    flexDirection: "column",
    justifyContent,
    fontSize: r(formatting.size, placeholderFormatting.size, masterFormatting.size, index === 0 ? "44px" : "28px"),
    fontWeight: r(formatting.weight, placeholderFormatting.weight, masterFormatting.weight, index === 0 ? "bold" : "normal"),
    fontStyle: r(formatting.italics, placeholderFormatting.italics, masterFormatting.italics, false) ? "italic" : "normal",
    fontFamily: r(formatting.font, placeholderFormatting.font, masterFormatting.font, "inherit"),
    color: r(formatting.color, placeholderFormatting.color, masterFormatting.color, "var(--text-dark, black)"),
    textAlign: r(formatting.align, placeholderFormatting.align, masterFormatting.align, "left"),
    textAlignLast: r(formatting.align, placeholderFormatting.align, masterFormatting.align, "left") === "justify" ? "left" : undefined,
    lineHeight: r(formatting["line-spacing"], placeholderFormatting["line-spacing"], masterFormatting["line-spacing"], "1.4"),
    ...(textDecoration ? { textDecoration } : {}),
    ...(placeholderPadding ? { padding: placeholderPadding } : {}),
    boxSizing: "border-box",
    wordBreak: "break-all",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  };
}

export function styleToString(styleObj) {
  return Object.entries(styleObj)
    .filter(([, v]) =>
      v != null
      && !(typeof v === "string" && /["'<>]|url\s*\(/i.test(v)),
    )
    .map(([k, v]) => {
      const prop = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}: ${v}`;
    })
    .join("; ");
}

export function buildMediaContainerStyle(media) {
  const rotation = media.rotation ?? 0;
  const styleId = media.effects?.["style-id"];
  const styleCss = styleId ? getStyleById(styleId).css : {};
  const containerStyleCss = { ...styleCss };
  delete containerStyleCss.border;
  delete containerStyleCss.borderWidth;
  delete containerStyleCss.borderStyle;
  delete containerStyleCss.borderColor;

  const fx = media.effects ?? {};
  const shadowPreset  = findById(SHADOW_PRESETS,  fx.shadowId);
  const glowPreset    = findById(GLOW_PRESETS, fx.glowId);
  const glowShadow    = fx._glowShadow ?? glowPreset?.shadow ?? null;
  const softPreset    = findById(SOFT_EDGES_PRESETS, fx.softEdgesId);
  const rot3d         = findById(ROTATION3D_PRESETS, fx.rotation3dId);

  const isInnerShadow = shadowPreset?.section === "inner";
  const outerShadow = isInnerShadow ? null : shadowPreset?.shadow;
  const shadows = [outerShadow, glowShadow].filter(Boolean);
  const boxShadowCss = shadows.length ? { boxShadow: shadows.join(", ") } : {};
  const maskCss = softPreset?.stop != null
    ? { WebkitMaskImage: `radial-gradient(ellipse at center, black ${softPreset.stop}%, transparent 100%)`,
        maskImage:        `radial-gradient(ellipse at center, black ${softPreset.stop}%, transparent 100%)` }
    : {};
  const transforms = [
    rotation ? `rotate(${rotation}deg)` : null,
    styleCss.transform ?? null,
  ].filter(Boolean).join(" ");
  return {
    position: "absolute",
    left: `${media.position?.x ?? 0}px`,
    top: `${media.position?.y ?? 0}px`,
    width: `${media.width ?? 200}px`,
    height: `${media.height ?? 120}px`,
    zIndex: media["z-index"] ?? 1,
    overflow: "hidden",
    ...(media.opacity != null && media.opacity < 1 ? { opacity: media.opacity } : {}),
    ...containerStyleCss,
    ...boxShadowCss,
    ...maskCss,
    ...(transforms || rot3d?.transform
      ? {
          transform: [transforms, rot3d?.transform?.replace("perspective(none) ", "")].filter(Boolean).join(" "),
          transformOrigin: "center center",
        }
      : {}),
  };
}

export function buildMediaBorderOverlayStyle(media) {
  const styleId = media.effects?.["style-id"];
  const styleCss = styleId ? getStyleById(styleId).css : {};
  const customBorder = media.effects?.border;
  const borderProps = customBorder?.color
    ? { border: `${customBorder.width ?? 2}px ${customBorder.dash ?? "solid"} ${customBorder.color}` }
    : {
        ...(styleCss.border ? { border: styleCss.border } : {}),
        ...(styleCss.borderWidth ? { borderWidth: styleCss.borderWidth } : {}),
        ...(styleCss.borderStyle ? { borderStyle: styleCss.borderStyle } : {}),
        ...(styleCss.borderColor ? { borderColor: styleCss.borderColor } : {}),
      };
  if (Object.keys(borderProps).length === 0) return null;
  return {
    position: "absolute",
    inset: 0,
    boxSizing: "border-box",
    pointerEvents: "none",
    borderRadius: "inherit",
    ...borderProps,
  };
}

export function buildBevelOverlayStyle(media) {
  const fx = media.effects ?? {};
  const bevelPreset  = findById(BEVEL_PRESETS,  fx.bevelId);
  const shadowPreset = findById(SHADOW_PRESETS, fx.shadowId);
  const insetShadow  = shadowPreset?.section === "inner" ? shadowPreset.shadow : null;
  const insets = [bevelPreset?.bevel, insetShadow].filter(Boolean);
  if (!insets.length) return null;
  return { position: "absolute", inset: 0, boxShadow: insets.join(", "), pointerEvents: "none", borderRadius: "inherit" };
}

export function buildMediaFilterStyle(media) {
  const effects = media.effects ?? {};
  const parts = [];
  const brightness = effects.brightness ?? 0;
  const contrast   = effects.contrast   ?? 0;

  const sharpen  = getEffectFilter(effects.sharpenId);
  const tint     = getEffectFilter(effects.tintId) ?? effects.tintFilter ?? null;
  const artistic = getEffectFilter(effects.artisticId) ?? effects.artisticFilter ?? null;

  if (sharpen)      parts.push(sharpen);
  if (brightness !== 0) parts.push(`brightness(${(1 + brightness).toFixed(3)})`);
  if (contrast !== 0)   parts.push(`contrast(${(1 + contrast).toFixed(3)})`);
  if (tint)         parts.push(tint);
  if (artistic)     parts.push(artistic);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function getMediaReflectionPreset(media) {
  const reflectionId = media.effects?.reflectionId;
  if (!reflectionId || reflectionId === "none") return null;
  const preset = findById(REFLECTION_PRESETS, reflectionId);
  return preset?.size > 0 ? preset : null;
}

export function buildMediaReflectionStyle(media, { relative = false } = {}) {
  const preset = getMediaReflectionPreset(media);
  if (!preset) return null;
  const width = media.width ?? 200;
  const height = media.height ?? 120;
  return {
    position: "absolute",
    left: relative ? 0 : (media.position?.x ?? 0),
    top: (
      relative
        ? height
        : (media.position?.y ?? 0) + height
    ) + (preset.offset ?? 0),
    width,
    height: Math.max(1, Math.round((preset.size / 100) * height)),
    overflow: "hidden",
    opacity: preset.opacity,
    ...(preset.blur > 0 ? { filter: `blur(${preset.blur}px)` } : {}),
    WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
    maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
    pointerEvents: "none",
    zIndex: media["z-index"] ?? 1,
  };
}

export function buildMediaReflectionContentStyle(media) {
  const containerStyle = buildMediaContainerStyle(media);
  return {
    position: "absolute",
    inset: 0,
    width: media.width ?? 200,
    height: media.height ?? 120,
    overflow: "hidden",
    boxSizing: "border-box",
    ...(containerStyle.borderRadius ? { borderRadius: containerStyle.borderRadius } : {}),
    transform: "scaleY(-1)",
    transformOrigin: "center center",
  };
}

export function buildMediaInnerStyle(media) {
  const scale = media.scale ?? 1;
  const rawCrop = Array.isArray(media.crop) ? media.crop : [];
  const [ct, , , cl] = clampCrop(media.crop);
  const hasCrop = rawCrop.some((value) => Number(value) !== 0);

  if (hasCrop) {
    const {
      renderedSourceWidth: srcW,
      renderedSourceHeight: srcH,
    } = getCroppedMediaGeometry(media);
    return {
      position: "absolute",
      width: `${srcW}px`,
      height: `${srcH}px`,
      left: `${-(cl / 100) * srcW}px`,
      top: `${-(ct / 100) * srcH}px`,
      objectFit: "fill",
      maxWidth: "none",
      maxHeight: "none",
      margin: 0,
    };
  }

  return {
    width: "100%",
    height: "100%",
    objectFit: "fill",
    display: "block",
    maxWidth: "none",
    maxHeight: "none",
    margin: 0,
    ...(scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center center" } : {}),
  };
}

export function buildVideoAttributes(media) {
  const playback = media.playback ?? {};
  return {
    ...(playback.autoplay ? { autoPlay: true } : {}),
    ...(playback.loop ? { loop: true } : {}),
    ...(playback.muted ? { muted: true } : {}),
  };
}

export function buildSlideContainerStyle(width, height) {
  return {
    position: "relative",
    width: `${width}px`,
    height: `${height}px`,
    overflow: "hidden",
  };
}

export function getTextContent(textElement) {
  return (
    textElement?.paragraphs
      ?.map((paragraph) =>
        paragraph?.runs?.map((run) => run?.text || "").join(""),
      )
      .join("\n") || ""
  );
}

export function getTextLines(textElement) {
  if (!textElement?.paragraphs?.length) return [];

  return textElement.paragraphs.flatMap((paragraph) => {
    const text = paragraph?.runs?.map((run) => run?.text || "").join("") ?? "";
    return text.split("\n");
  });
}

export function getSlideDimensions(presentation) {
  return getSlideSize(presentation);
}

export function getVisibleSlidesForPreview(slides) {
  return (slides || []).filter((slide) => !slide.hidden);
}

export function getSlideTextElements(slide) {
  return getTextElements(slide);
}

export function getSlideMediaElements(slide) {
  return getMediaElements(slide);
}

export function initRevealDeck(
  containerElement,
  width,
  height,
  initialSlide = 0,
) {
  const deck = new Reveal(containerElement, {
    controls: true,
    progress: true,
    center: true,
    hash: false,
    embedded: true,
    width,
    height,
    margin: 0,
    minScale: 0.1,
    maxScale: 10,
    plugins: [],
  });

  deck.initialize().then(() => {
    requestAnimationFrame(() => {
      deck.layout();
      if (initialSlide > 0) {
        deck.slide(initialSlide);
      }
    });
  });

  return deck;
}

export function buildColorThemeStyle(presentation) {
  const colorTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
  const cssVars = {};
  colorTheme.forEach((entry) => { 
    const color = entry.color;
    const normalized = typeof color === "string" && color.length === 9 && color.startsWith("#")
      ? color.slice(0, 7)
      : color;
    cssVars[`--${entry["css-variable-name"]}`] = normalized;
  });
  return cssVars;
}

const VALID_TRANSITIONS = new Set(TRANSITIONS.map((t) => t.value));
const TRANSITION_SPEED_MAP = { 0.3: "fast", 0.75: "default", 1.5: "slow" };

export function getRevealTransition(slide) {
  const transition = slide?.contents?.transition;
  if (transition && VALID_TRANSITIONS.has(transition)) return transition;
  return DEFAULT_TRANSITION;
}

export function getRevealTransitionSpeed(slide) {
  const duration = slide?.contents?.transitionDuration ?? 0.75;
  return TRANSITION_SPEED_MAP[duration] ?? "default";
}

const FRAGMENT_EFFECT_CLASSES = new Set([
  "grow",
  "shrink",
  "shrink-down",
  "fade-out",
  "fade-up",
  "fade-down",
  "fade-left",
  "fade-right",
  "fade-in-then-out",
  "fade-in-then-semi-out",
  "highlight-red",
  "highlight-green",
  "highlight-blue",
  "highlight-current-red",
  "highlight-current-green",
  "highlight-current-blue",
  "strike",
]);

const SPEED_MAP = {
  0.5: "fast",
  1: undefined,
  2: "slow",
};

export function buildAnimationMap(slide) {
  const animations = slide?.contents?.animations ?? [];
  const map = new Map();
  animations.forEach((animation) => {
    if (animation?.id) map.set(animation.id, animation);
  });
  return map;
}

export function buildAdjustedAnimationMap(slide) {
  const animations = slide?.contents?.animations ?? [];
  const textElements = getTextElements(slide);
  if (!animations.length) return new Map();

  const sorted = [...animations].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  const adjustedStartMap = new Map(); 
  let next = 1;
  for (const anim of sorted) {
    adjustedStartMap.set(anim.id, next);
    const byParagraph = (anim["effect-options"]?.sequence ?? "as-one-object") !== "as-one-object";
    if (byParagraph) {
      const textEl = textElements.find((el) => el.id === anim.id);
      const lines = getTextLines(textEl ?? { paragraphs: [] });
      next += lines.length || 1;
    } else {
      next += 1;
    }
  }

  const map = new Map();
  animations.forEach((animation) => {
    if (!animation?.id) return;
    const adjustedSeq = adjustedStartMap.get(animation.id);
    map.set(animation.id, adjustedSeq !== undefined
      ? { ...animation, sequence: adjustedSeq }
      : animation,
    );
  });
  return map;
}

function fragmentClassNameFor(effect) {
  const classes = ["fragment"];
  if (
    effect !== "fade-in" &&
    effect !== "none" &&
    FRAGMENT_EFFECT_CLASSES.has(effect)
  ) {
    classes.push(effect);
  }
  return classes.join(" ");
}

function buildFragmentProps(animation, sequenceOverride) {
  if (!animation) return null;

  const effect = animation.effect ?? "fade-in";
  const sequence = sequenceOverride ?? animation.sequence;
  const rawSpeed = animation.speed;
  const speed = SPEED_MAP[rawSpeed];

  return {
    className: fragmentClassNameFor(effect),
    "data-fragment-index": Number.isFinite(sequence) ? sequence : undefined,
    "data-fragment-speed": speed,
  };
}

export function getFragmentProps(animation) {
  return buildFragmentProps(animation);
}

export function getPerLineFragments(textElement, animation, lines) {
  if (!animation) return null;

  const sequenceMode = animation["effect-options"]?.sequence ?? "as-one-object";
  if (sequenceMode === "as-one-object") return null;
  if (!lines || lines.length <= 1) return null;

  const paragraphs = textElement?.paragraphs ?? [];

  return paragraphs.map((paragraph, index) => {
    const fragIndex =
      sequenceMode === "all-at-once"
        ? animation.sequence
        : animation.sequence + index;

    return {
      paragraph,
      fragmentProps: buildFragmentProps(animation, fragIndex),
    };
  });
}

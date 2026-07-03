import {
  getSlideSize,
  getVisibleSlides,
  escapeHtml,
  getTextElements,
  getMediaElements,
  getPlaceholderFormatting,
  getPlaceholderPadding,
  getPlaceholderBackground,
} from "../render/slidesetRenderUtils";
import {
  buildTextElementStyle,
  buildMediaContainerStyle,
  buildMediaInnerStyle,
  buildMediaFilterStyle,
  buildMediaBorderOverlayStyle,
  buildBevelOverlayStyle,
  buildMediaReflectionStyle,
  buildMediaReflectionContentStyle,
  buildVideoAttributes,
  buildAnimationMap,
  styleToString,
} from "../render/revealRenderer";
import {
  isSafeLinkHref,
  resolveParagraphIndentStyles,
  resolveTextStyle,
  validStyleValue,
} from "../text/textFormatting";
import {
  getListMarker,
  getListIndent,
  LIST_MARKER_WIDTH_EM,
} from "../utils/listUtils";
import { downloadHtml } from "./downloadHtml";
import { downloadBackend } from "./downloadBackend";
import { getMediaFile } from "../persistence/persistenceFacade";
import { fontFormat, fontExtension } from "../utils/fontFormat";
import JSZip from "jszip";
import revealJsSource from "../../assets/reveal-dist/reveal.js?raw";
import revealCssSource from "../../assets/reveal-dist/reveal.css?raw";
import revealThemeCssSource from "../../assets/reveal-dist/theme/white.css?raw";

function buildColorThemeCss(presentation) {
  const colorTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
  if (colorTheme.length === 0) return "";
  const vars = colorTheme
    .filter((entry) =>
      /^[a-zA-Z0-9_-]+$/.test(entry?.["css-variable-name"] ?? "")
      && /^#[0-9a-fA-F]{3,8}$/.test(entry?.color ?? ""),
    )
    .map((entry) => `  --${entry["css-variable-name"]}: ${entry.color};`)
    .join("\n");
  return `:root {\n${vars}\n}`;
}

const FRAGMENT_EFFECT_CLASSES = new Set([
  "grow", "shrink", "shrink-down", "fade-out", "fade-up", "fade-down",
  "fade-left", "fade-right", "fade-in-then-out", "fade-in-then-semi-out",
  "highlight-red", "highlight-green", "highlight-blue",
  "highlight-current-red", "highlight-current-green", "highlight-current-blue",
  "strike",
]);

const SPEED_MAP = { 0.5: "fast", 1: undefined, 2: "slow" };
const TRANSITION_SPEED_MAP = { 0.3: "fast", 0.75: "default", 1.5: "slow" };

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function collectBackgroundImageRefs(slides) {
  return slides
    .map((slide) => slide.contents?.background)
    .filter((bg) => bg && typeof bg === "object" && bg.type === "image" && bg["file-link"])
    .map((bg) => ({ "file-link": bg["file-link"], "media-type": "image" }));
}

async function resolveMediaLinks(slides, masterElements = {}) {
  const resolvedMap = new Map();
  const allMedia = [
    ...(masterElements.media ?? []),
    ...slides.flatMap((slide) => getMediaElements(slide)),
    ...collectBackgroundImageRefs(slides),
  ];
  for (const media of allMedia) {
    const fileLink = media["file-link"];
    if (fileLink?.startsWith("indexeddb://") && !resolvedMap.has(fileLink)) {
      const key = fileLink.replace("indexeddb://", "");
      const blob = await getMediaFile(key);
      if (blob) {
        resolvedMap.set(fileLink, await blobToDataUrl(blob));
      } else {
        console.warn(`[exportToReveal] Media not found for "${fileLink}", exporting with an empty src.`);
        resolvedMap.set(fileLink, "");
      }
    }
  }
  return resolvedMap;
}

async function resolveMediaForZip(slides, masterElements = {}) {
  const resolvedMap = new Map();
  const counters = { image: 1, video: 1 };
  const allMedia = [
    ...(masterElements.media ?? []),
    ...slides.flatMap((slide) => getMediaElements(slide)),
    ...collectBackgroundImageRefs(slides),
  ];
  for (const media of allMedia) {
    const fileLink = media["file-link"];
    if (!fileLink || resolvedMap.has(fileLink)) continue;
    if (fileLink.startsWith("indexeddb://")) {
      const key = fileLink.replace("indexeddb://", "");
      const blob = await getMediaFile(key);
      if (blob) {
        const kind = media["media-type"] === "video" ? "video" : "image";
        const ext = blob.type.split("/")[1] ?? (kind === "video" ? "mp4" : "jpg");
        const filename = `media/${kind}/${kind}_${counters[kind]++}.${ext}`;
        resolvedMap.set(fileLink, { src: filename, blob });
      } else {
        console.warn(`[exportToRevealZip] Media not found for "${fileLink}", exporting with an empty src.`);
        resolvedMap.set(fileLink, { src: "", blob: null });
      }
    } else {
      resolvedMap.set(fileLink, { src: fileLink, blob: null });
    }
  }
  return resolvedMap;
}

async function resolveFontsForHtml(fonts) {
  const map = new Map();
  for (const font of fonts ?? []) {
    const fontId = font["font-id"];
    const fileLink = font["font-file"];
    if (!fontId || !fileLink) continue;
    if (fileLink.startsWith("indexeddb://")) {
      const key = fileLink.replace("indexeddb://", "");
      const blob = await getMediaFile(key);
      if (blob) {
        map.set(fontId, { src: await blobToDataUrl(blob), mimeType: blob.type, originalPath: fileLink });
      }
    } else {
      map.set(fontId, { src: fileLink, mimeType: "", originalPath: fileLink });
    }
  }
  return map;
}

async function resolveFontsForZip(fonts) {
  const map = new Map();
  let counter = 1;
  for (const font of fonts ?? []) {
    const fontId = font["font-id"];
    const fileLink = font["font-file"];
    if (!fontId || !fileLink) continue;
    if (fileLink.startsWith("indexeddb://")) {
      const key = fileLink.replace("indexeddb://", "");
      const blob = await getMediaFile(key);
      if (blob) {
        const ext = fontExtension(fontFormat(fileLink, blob.type));
        const filename = `fonts/font_${counter++}.${ext}`;
        map.set(fontId, { src: filename, blob, mimeType: blob.type, originalPath: fileLink });
      }
    } else {
      map.set(fontId, { src: fileLink, blob: null, mimeType: "", originalPath: fileLink });
    }
  }
  return map;
}

function buildFontFaceCss(fontMap) {
  const rules = [];
  for (const [fontId, info] of fontMap) {
    const format = fontFormat(info.originalPath, info.mimeType);
    rules.push(
      `@font-face {\n  font-family: "${fontId}";\n  src: url("${info.src}") format("${format}");\n  font-weight: normal;\n  font-style: normal;\n}`,
    );
  }
  return rules.join("\n");
}

function buildAdjustedSequenceMap(animations, textElements) {
  if (!animations?.length) return new Map();
  const sorted = [...animations].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const result = new Map();
  let next = 1;
  for (const anim of sorted) {
    result.set(anim.id, next);
    const byParagraph = (anim["effect-options"]?.sequence ?? "as-one-object") !== "as-one-object";
    if (byParagraph) {
      const textEl = textElements.find((el) => el.id === anim.id);
      next += textEl?.paragraphs?.length ?? 1;
    } else {
      next += 1;
    }
  }
  return result;
}

function fragmentClassesFor(effect) {
  const classes = ["fragment"];
  if (effect !== "fade-in" && effect !== "none" && FRAGMENT_EFFECT_CLASSES.has(effect)) {
    classes.push(effect);
  }
  return classes.join(" ");
}

function fragmentDataAttrs(sequence, speedRaw) {
  const speed = SPEED_MAP[speedRaw];
  return [
    Number.isFinite(sequence) ? `data-fragment-index="${sequence}"` : "",
    speed ? `data-fragment-speed="${speed}"` : "",
  ].filter(Boolean).join(" ");
}

function applyFragment(innerHtml, wrapperStyle, animation) {
  if (!animation) return `<div style="${wrapperStyle}">${innerHtml}</div>`;
  const effect = animation.effect ?? "fade-in";
  const sequence = animation.sequence;
  const speedRaw = animation.speed;
  const classes = fragmentClassesFor(effect);
  const dataAttrs = fragmentDataAttrs(sequence, speedRaw);
  return `<div class="${classes}" ${dataAttrs} style="${wrapperStyle}">${innerHtml}</div>`;
}

const resolveStyleValue = resolveTextStyle;

export function buildPStyle(
  paragraphFormatting,
  listPaddingLeft = null,
  placeholderFormatting = {},
  masterFormatting = {},
) {
  const indentStyles = resolveParagraphIndentStyles(
    paragraphFormatting,
    placeholderFormatting,
    masterFormatting,
    listPaddingLeft,
  );
  const value = (key) => resolveStyleValue(
    paragraphFormatting[key],
    placeholderFormatting[key],
    masterFormatting[key],
  );
  const weight = value("weight");
  const italics = value("italics");
  return [
    weight != null
      ? `font-weight: ${weight === true ? "bold" : weight === false ? "normal" : weight}`
      : "",
    italics != null
      ? `font-style: ${italics === true || italics === "italic" ? "italic" : "normal"}`
      : "",
    value("color") ? `color: ${value("color")}` : "",
    value("size") ? `font-size: ${value("size")}` : "",
    value("font") ? `font-family: ${value("font")}` : "",
    value("text-decoration") ? `text-decoration: ${value("text-decoration")}` : "",
    value("align") ? `text-align: ${value("align")}` : "",
    value("margin")
      ? `margin: ${value("margin")}`
      : "margin: 0 0 4px 0",
    value("line-spacing") ? `line-height: ${value("line-spacing")}` : "",
    indentStyles.paddingLeft ? `padding-left: ${indentStyles.paddingLeft}` : "",
    indentStyles.textIndent ? `text-indent: ${indentStyles.textIndent}` : "",
  ].filter(Boolean).join("; ");
}

function buildRunHtml(run, fallbackFormatting = {}, slideAnchorMap = null) {
  const runFormatting = run.formatting ?? {};
  const superSub = run["super-sub-script"];
  const value = (key) =>
    validStyleValue(runFormatting[key])
    ?? validStyleValue(fallbackFormatting[key]);
  const weight = value("weight");
  const italics = value("italics");
  const style = [
    weight != null
      ? `font-weight: ${weight === true ? "bold" : weight === false ? "normal" : weight}`
      : "",
    italics != null
      ? `font-style: ${italics === true || italics === "italic" ? "italic" : "normal"}`
      : "",
    value("color") ? `color: ${value("color")}` : "",
    value("size") ? `font-size: ${value("size")}` : "",
    value("font") ? `font-family: ${value("font")}` : "",
    value("text-decoration") ? `text-decoration: ${value("text-decoration")}` : "",
    value("highlight") && value("highlight") !== "transparent" ? `background-color: ${value("highlight")}` : "",
    superSub === "super" ? "vertical-align: super; font-size: 0.75em" : "",
    superSub === "sub" ? "vertical-align: sub; font-size: 0.75em" : "",
  ].filter(Boolean).join("; ");
  const text = escapeHtml(run.text ?? "");
  if (isSafeLinkHref(run.link?.href)) {
    const slideMatch = /^#slide-(\d+)$/.exec(run.link.href);
    let href = run.link.href;
    if (slideMatch) {
      const visibleIndex = slideAnchorMap?.get(Number(slideMatch[1]));
      if (visibleIndex == null) {
        return style ? `<span style="${style}">${text}</span>` : text;
      }
      href = `#/${visibleIndex}`;
    }
    const target = slideMatch || run.link.target === "_self" ? "_self" : "_blank";
    return `<a href="${escapeHtml(href)}" target="${target}" rel="noopener noreferrer" style="${style}">${text}</a>`;
  }
  return style ? `<span style="${style}">${text}</span>` : text;
}

export function buildTextElementContent(
  textElement,
  animation,
  placeholderFormatting = {},
  masterFormatting = {},
  slideAnchorMap = null,
) {
  if (!textElement.paragraphs?.length) return "";
  const sequenceMode = animation?.["effect-options"]?.sequence ?? "as-one-object";
  const perLine = animation && sequenceMode !== "as-one-object";

  let numberedCounter = 0;
  return textElement.paragraphs
    .map((paragraph, pIdx) => {
      const paragraphFormatting = paragraph.formatting ?? {};
      const resolved = (key) => resolveStyleValue(
        paragraphFormatting[key],
        placeholderFormatting[key],
        masterFormatting[key],
      );
      const rawListType = resolved("list-type") ?? null;
      const listType = rawListType && rawListType !== "none" ? rawListType : null;
      const listLevel = resolved("indent-level") ?? 0;
      const listMarker = resolved("list-marker");
      const listNumberedStyle = resolved("list-numbered-style");

      if (listType === "numbered") numberedCounter++;
      else if (!listType) numberedCounter = 0;

      const listPaddingLeft = listType
        ? `calc(${getListIndent(listLevel, listType)} + ${LIST_MARKER_WIDTH_EM}em)`
        : null;
      const pStyle = buildPStyle(
        paragraphFormatting,
        listPaddingLeft,
        placeholderFormatting,
        masterFormatting,
      );

      const markerHtml = listType
        ? `<span style="display:inline-block;width:${LIST_MARKER_WIDTH_EM}em;margin-left:calc(-${LIST_MARKER_WIDTH_EM}em);text-align:right;padding-right:0.5em;box-sizing:border-box;">${
            listType === "numbered"
              ? getListMarker(numberedCounter - 1, "numbered", null, listNumberedStyle)
              : getListMarker(pIdx, "bullets", listMarker, null)
          }</span>`
        : "";

      const fallbackFormatting = {
        weight: resolved("weight"),
        italics: resolved("italics"),
        color: resolved("color"),
        size: resolved("size"),
        font: resolved("font"),
        "text-decoration": resolved("text-decoration"),
        highlight: resolved("highlight"),
      };
      const runsHtml = (paragraph.runs ?? [])
        .map((run) => buildRunHtml(run, fallbackFormatting, slideAnchorMap))
        .join("");

      if (!perLine) return `<p style="${pStyle}">${markerHtml}${runsHtml}</p>`;

      const fragIndex = sequenceMode === "all-at-once"
        ? animation.sequence
        : animation.sequence + pIdx;
      const classes = fragmentClassesFor(animation.effect ?? "fade-in");
      const dataAttrs = fragmentDataAttrs(
        fragIndex,
        animation.speed,
      );
      return `<p class="${classes}" ${dataAttrs} style="${pStyle}">${markerHtml}${runsHtml}</p>`;
    })
    .join("");
}

function buildReflectionHtml(media, src) {
  const reflectionStyle = buildMediaReflectionStyle(media);
  if (!reflectionStyle) return "";
  const contentStyle = buildMediaReflectionContentStyle(media);
  const cssFilter = buildMediaFilterStyle(media);
  const imageStyle = {
    ...buildMediaInnerStyle(media),
    ...(cssFilter ? { filter: cssFilter } : {}),
  };
  const bevelStyle = buildBevelOverlayStyle(media);
  const borderStyle = buildMediaBorderOverlayStyle(media);
  const borderHtml = borderStyle ? `<div style="${styleToString(borderStyle)}"></div>` : "";
  const bevelHtml = bevelStyle ? `<div style="${styleToString(bevelStyle)}"></div>` : "";
  return `<div aria-hidden="true" style="${styleToString(reflectionStyle)}"><div style="${styleToString(contentStyle)}"><img src="${escapeHtml(src)}" alt="" style="${styleToString(imageStyle)}" />${borderHtml}${bevelHtml}</div></div>`;
}

function buildMasterElementsHtml(presentation, masterFormatting, getSrc) {
  const masterElements = presentation?.slideset?.master?.elements ?? {};
  const textElements = masterElements.text ?? [];
  const mediaElements = masterElements.media ?? [];

  const textsHtml = textElements.filter((element) => !element.hidden).map((el) => {
    const style = styleToString(buildTextElementStyle(el, masterFormatting, {}));
    const content = buildTextElementContent(el, null);
    return `<div style="${style}">${content}</div>`;
  }).join("");

  const mediaHtml = mediaElements.filter((element) => !element.hidden && !!element["file-link"]).map((media, index) => {
    const src = getSrc(media["file-link"] ?? "");
    const isVideo = media["media-type"] === "video";
    const wrapperStyle = styleToString(buildMediaContainerStyle(media, index));
    const cssFilter = buildMediaFilterStyle(media);
    const innerStyle = styleToString({
      ...buildMediaInnerStyle(media),
      ...(cssFilter ? { filter: cssFilter } : {}),
    });
    const { autoPlay, loop, muted } = buildVideoAttributes(media);
    const showControls = media.playback?.controls !== false;
    const inner = isVideo
      ? `<video src="${escapeHtml(src)}" style="${innerStyle}" preload="metadata"${autoPlay ? " autoplay" : ""}${loop ? " loop" : ""}${muted ? " muted" : ""}${showControls ? " controls" : ""}></video>`
      : `<img src="${escapeHtml(src)}" alt="${escapeHtml(media.decorative ? "" : (media.alt ?? ""))}" style="${innerStyle}" />`;

    const borderStyle = buildMediaBorderOverlayStyle(media);
    const borderHtml = borderStyle ? `<div style="${styleToString(borderStyle)}"></div>` : "";
    const bevelStyle = buildBevelOverlayStyle(media);
    const bevelHtml = bevelStyle ? `<div style="${styleToString(bevelStyle)}"></div>` : "";
    const reflectionHtml = isVideo ? "" : buildReflectionHtml(media, src);

    return `<div style="${wrapperStyle}">${inner}${borderHtml}${bevelHtml}</div>${reflectionHtml}`;
  }).join("");

  return textsHtml + mediaHtml;
}

function buildDecorationsHtml(presentation, width, height) {
  const shapes = presentation?.slideset?.master?.decorations?.shapes;
  if (!shapes?.length) return "";

  const shapeSvgs = shapes.map((s) => {
    const base = `fill="${s.fill ?? "none"}" stroke="${s.stroke ?? "none"}" stroke-width="${s.strokeWidth ?? 0}" opacity="${s.opacity ?? 1}"`;
    switch (s.type) {
      case "rect": return `<rect ${base} x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx ?? 0}" ry="${s.ry ?? 0}"/>`;
      case "circle": return `<circle ${base} cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`;
      case "ellipse": return `<ellipse ${base} cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"/>`;
      case "polygon": return `<polygon ${base} points="${s.points}"/>`;
      case "path": return `<path ${base} d="${s.d}"/>`;
      case "line": return `<line fill="none" stroke="${s.stroke ?? s.fill ?? "none"}" stroke-width="${s.strokeWidth ?? 2}" opacity="${s.opacity ?? 1}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`;
      default: return "";
    }
  }).join("\n        ");

  return `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0;" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${shapeSvgs}</svg>`;
}

function buildBgFillHtml(bg, width, height, getSrc) {
  const src = getSrc(bg["file-link"] ?? "");
  if (!src) return "";
  const scale = bg.fitToCanvas ?? false;
  const ol = scale ? 0 : (bg.offsetLeft ?? 0) / 100;
  const or = scale ? 0 : (bg.offsetRight ?? 0) / 100;
  const ot = scale ? 0 : (bg.offsetTop ?? 0) / 100;
  const ob = scale ? 0 : (bg.offsetBottom ?? 0) / 100;
  const imgStyle = [
    "position:absolute",
    `left:${ol * width}px`,
    `top:${ot * height}px`,
    `width:${(1 - ol - or) * width}px`,
    `height:${(1 - ot - ob) * height}px`,
    `object-fit:${scale ? "fill" : "cover"}`,
    `opacity:${1 - (bg.transparency ?? 0) / 100}`,
    "max-width:none",
    "max-height:none",
    "margin:0",
  ].join(";");
  return `<div style="position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none;"><img src="${escapeHtml(src)}" alt="" style="${imgStyle}" /></div>`;
}

function buildSlideAnchorMap(presentation) {
  const map = new Map();
  let visibleIndex = 0;
  (presentation?.slideset?.slides ?? []).forEach((slide, index) => {
    if (!slide.hidden) {
      map.set(index + 1, visibleIndex);
      visibleIndex += 1;
    }
  });
  return map;
}

function buildSlideSection(slide, width, height, getSrc, masterFormatting, presentation, masterElementsHtml = "", slideAnchorMap = null) {
  const textElements = getTextElements(slide);
  const mediaElements = getMediaElements(slide);
  const transition = slide.contents?.transition ?? "slide";
  const transitionDuration = slide.contents?.transitionDuration ?? 0.75;
  const transitionSpeed = TRANSITION_SPEED_MAP[transitionDuration] ?? "default";
  const rawBackground = slide.contents?.background ?? null;
  const isImageBackground = rawBackground && typeof rawBackground === "object" && rawBackground.type === "image";
  const background = !rawBackground || isImageBackground
    ? "var(--bg-light, white)"
    : rawBackground;
  const backgroundImageHtml = isImageBackground
    ? buildBgFillHtml(rawBackground, width, height, getSrc)
    : "";
  const animationMap = buildAnimationMap(slide);
  const adjustedSeqMap = buildAdjustedSequenceMap(
    slide.contents?.animations ?? [],
    textElements,
  );

  const textElementsHtml = textElements
    .filter((element) => !element.hidden)
    .map((textElement) => {
      const animation = animationMap.get(textElement.id);
      const sequenceMode = animation?.["effect-options"]?.sequence ?? "as-one-object";
      const placeholderFormatting = getPlaceholderFormatting(presentation, slide, textElement);
      const placeholderPadding = getPlaceholderPadding(presentation, slide, textElement);
      const placeholderBackground = getPlaceholderBackground(presentation, slide, textElement);
      const style = styleToString(buildTextElementStyle(textElement, masterFormatting, placeholderFormatting, placeholderPadding, placeholderBackground));
      const adjustedAnim = animation && adjustedSeqMap.has(animation.id)
        ? { ...animation, sequence: adjustedSeqMap.get(animation.id) }
        : animation;
      const content = buildTextElementContent(
        textElement,
        adjustedAnim,
        placeholderFormatting,
        masterFormatting,
        slideAnchorMap,
      );
      if (!animation || sequenceMode === "as-one-object") {
        return applyFragment(content, style, adjustedAnim);
      }
      return `<div style="${style}">${content}</div>`;
    })
    .join("");

  const mediaElementsHtml = mediaElements
    .filter((element) => !element.hidden)
    .map((media, index) => {
      const animation = animationMap.get(media.id);
      const wrapperStyle = styleToString(buildMediaContainerStyle(media, index));
      const cssFilter = buildMediaFilterStyle(media);
      const innerStyle = styleToString({
        ...buildMediaInnerStyle(media),
        ...(cssFilter ? { filter: cssFilter } : {}),
      });
      const { autoPlay, loop, muted } = buildVideoAttributes(media);
      const showControls = media.playback?.controls !== false;
      const src = getSrc(media["file-link"] ?? "");
      const isVideo = media["media-type"] === "video";

      const mediaHtml = isVideo
        ? `<video src="${escapeHtml(src)}" style="${innerStyle}" preload="metadata"${autoPlay ? " autoplay" : ""}${loop ? " loop" : ""}${muted ? " muted" : ""}${showControls ? " controls" : ""}></video>`
        : `<img src="${escapeHtml(src)}" alt="${escapeHtml(media.decorative ? "" : (media.alt ?? ""))}" style="${innerStyle}" />`;

      const borderStyle = buildMediaBorderOverlayStyle(media);
      const borderHtml = borderStyle ? `<div style="${styleToString(borderStyle)}"></div>` : "";
      const bevelStyle = buildBevelOverlayStyle(media);
      const bevelHtml = bevelStyle ? `<div style="${styleToString(bevelStyle)}"></div>` : "";
      const reflectionHtml = isVideo ? "" : buildReflectionHtml(media, src);

      const innerHtml = `${mediaHtml}${borderHtml}${bevelHtml}`;
      const adjustedMediaAnim = animation && adjustedSeqMap.has(animation.id)
        ? { ...animation, sequence: adjustedSeqMap.get(animation.id) }
        : animation;
      return `${applyFragment(innerHtml, wrapperStyle, adjustedMediaAnim)}${reflectionHtml}`;
    })
    .join("");

  const notes = slide.contents?.notes ?? "";
  const notesHtml = notes ? `<aside class="notes">${escapeHtml(notes)}</aside>` : "";

  return `
    <section
      data-transition="${escapeHtml(transition)}"
      data-transition-speed="${transitionSpeed}"
      style="background: ${background || "white"};"
    >
      <div style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden;">
        ${backgroundImageHtml}
        <div style="position:absolute;inset:0;z-index:0;pointer-events:none;">
          ${buildDecorationsHtml(presentation, width, height)}
          ${masterElementsHtml}
        </div>
        ${textElementsHtml}
        ${mediaElementsHtml}
      </div>
      ${notesHtml}
    </section>`;
}

function buildHtmlContent(title, colorThemeCss, width, height, slideSections, fontFaceCss = "", revealAssets = {}) {
  const {
    cssTag = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js/dist/reveal.css">`,
    themeCssTag = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js/dist/theme/white.css">`,
    scriptTag = `<script src="https://cdn.jsdelivr.net/npm/reveal.js/dist/reveal.js"></script>`,
  } = revealAssets;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  ${cssTag}
  ${themeCssTag}
  <style>
    ${fontFaceCss}
    ${colorThemeCss}
    .reveal .slides section { text-align: left; }
    .reveal .slides section p { margin: 0 0 4px 0; }
    .reveal .slides section .fragment { transition-duration: 800ms; }
    .reveal .slides section .fragment[data-fragment-speed="fast"] { transition-duration: 200ms; }
    .reveal .slides section .fragment[data-fragment-speed="slow"] { transition-duration: 2200ms; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      ${slideSections}
    </div>
  </div>
${scriptTag}
  <script>
    Reveal.initialize({
      controls: true,
      progress: true,
      center: false,
      hash: true,
      width: ${width},
      height: ${height},
      margin: 0,
      minScale: 0.5,
      maxScale: 2.0,
      keyboard: true,
    });

    document.querySelector('.reveal').addEventListener('click', function(e) {
      if (e.target.closest('.controls') || e.target.closest('a') || e.target.closest('button')) return;
      if (e.clientX < window.innerWidth / 2) {
        Reveal.prev();
      } else {
        Reveal.next();
      }
    });
  </script>
</body>
</html>`;
}

export async function exportToReveal(presentation) {
  const { width, height } = getSlideSize(presentation);
  const slides = getVisibleSlides(presentation);
  const colorThemeCss = buildColorThemeCss(presentation);
  const title = escapeHtml(presentation?.slideset?.title ?? "Presentation");
  const filename = (presentation?.slideset?.filename ?? "presentation")
    .replace(/\.json$/, "");

  const masterElements = presentation?.slideset?.master?.elements ?? {};
  const resolvedMap = await resolveMediaLinks(slides, masterElements);
  const getSrc = (fileLink) => resolvedMap.get(fileLink) ?? fileLink;
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const masterElementsHtml = buildMasterElementsHtml(presentation, masterFormatting, getSrc);

  const fontMap = await resolveFontsForHtml(presentation?.slideset?.fonts);
  const fontFaceCss = buildFontFaceCss(fontMap);

  const slideAnchorMap = buildSlideAnchorMap(presentation);
  const slideSections = slides
    .map((slide) => buildSlideSection(slide, width, height, getSrc, masterFormatting, presentation, masterElementsHtml, slideAnchorMap))
    .join("\n");

  const htmlContent = buildHtmlContent(title, colorThemeCss, width, height, slideSections, fontFaceCss);
  downloadHtml(htmlContent, `${filename}.html`);
}

export async function exportToRevealZip(presentation) {
  const { width, height } = getSlideSize(presentation);
  const slides = getVisibleSlides(presentation);
  const colorThemeCss = buildColorThemeCss(presentation);
  const title = escapeHtml(presentation?.slideset?.title ?? "Presentation");
  const filename = (presentation?.slideset?.filename ?? "presentation")
    .replace(/\.json$/, "");

  const masterElements = presentation?.slideset?.master?.elements ?? {};
  const resolvedMap = await resolveMediaForZip(slides, masterElements);
  const getSrc = (fileLink) => resolvedMap.get(fileLink)?.src ?? fileLink;
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const masterElementsHtml = buildMasterElementsHtml(presentation, masterFormatting, getSrc);

  const fontMap = await resolveFontsForZip(presentation?.slideset?.fonts);
  const fontFaceCss = buildFontFaceCss(fontMap);

  const slideAnchorMap = buildSlideAnchorMap(presentation);
  const slideSections = slides
    .map((slide) => buildSlideSection(slide, width, height, getSrc, masterFormatting, presentation, masterElementsHtml, slideAnchorMap))
    .join("\n");

  const htmlContent = buildHtmlContent(title, colorThemeCss, width, height, slideSections, fontFaceCss, {
    cssTag: `<link rel="stylesheet" href="reveal/reveal.css">`,
    themeCssTag: `<link rel="stylesheet" href="reveal/theme/white.css">`,
    scriptTag: `<script src="reveal/reveal.js"></script>`,
  });

  const zip = new JSZip();
  zip.file("index.html", htmlContent);
  zip.file("reveal/reveal.js", revealJsSource);
  zip.file("reveal/reveal.css", revealCssSource);
  zip.file("reveal/theme/white.css", revealThemeCssSource);

  for (const [, resolved] of resolvedMap) {
    if (resolved.blob && resolved.src.startsWith("media/")) {
      zip.file(resolved.src, resolved.blob);
    }
  }

  for (const [, resolved] of fontMap) {
    if (resolved.blob && resolved.src.startsWith("fonts/")) {
      zip.file(resolved.src, resolved.blob);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBackend.saveBlob(blob, `${filename}.zip`);
}

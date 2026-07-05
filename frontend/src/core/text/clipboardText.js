import { createParagraphId } from "../utils/presentationUtils";

const PASTE_RUN_KEYS = new Set([
  "weight",
  "italics",
  "text-decoration",
  "color",
  "size",
  "font",
  "highlight",
]);

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "P",
  "PRE",
  "SECTION",
]);

const paragraphTextLength = (paragraph) =>
  (paragraph?.runs ?? []).reduce(
    (sum, run) => sum + (run.text?.length ?? 0),
    0,
  );

const normalizeDecoration = (...values) => {
  const tokens = new Set(
    values
      .flatMap((value) => String(value ?? "").split(/\s+/))
      .filter((value) => value && value !== "none"),
  );
  return [...tokens].join(" ");
};

const normalizeFontFamily = (value) =>
  String(value ?? "")
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");

const sameRunStyle = (left, right) =>
  JSON.stringify(left?.formatting ?? {}) ===
    JSON.stringify(right?.formatting ?? {}) &&
  (left?.["super-sub-script"] ?? "normal") ===
    (right?.["super-sub-script"] ?? "normal") &&
  JSON.stringify(left?.link ?? null) === JSON.stringify(right?.link ?? null);

const mergeClipboardRuns = (runs = []) => {
  const merged = [];
  for (const sourceRun of runs.filter(Boolean)) {
    const run = {
      ...sourceRun,
      text: sourceRun.text ?? "",
      formatting: { ...(sourceRun.formatting ?? {}) },
      link: sourceRun.link ?? null,
      "super-sub-script": sourceRun["super-sub-script"] ?? "normal",
    };
    if (run.text === "" && runs.length > 1) continue;
    const previous = merged.at(-1);
    if (previous && sameRunStyle(previous, run)) previous.text += run.text;
    else merged.push(run);
  }
  return merged.length
    ? merged
    : [{ text: "", formatting: {}, "super-sub-script": "normal", link: null }];
};

const buildClipboardRun = (text, formatting = {}) => {
  const runFormatting = Object.fromEntries(
    Object.entries(formatting).filter(
      ([key, value]) =>
        PASTE_RUN_KEYS.has(key) && value != null && value !== "mixed",
    ),
  );
  const superSubScript =
    formatting["super-sub-script"] === "super" ||
    formatting["super-sub-script"] === "sub"
      ? formatting["super-sub-script"]
      : "normal";
  return {
    text,
    formatting: runFormatting,
    "super-sub-script": superSubScript,
    link: null,
  };
};

export const plainTextToClipboardParagraphs = (text, formatting = {}) =>
  String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => ({
      formatting: {},
      runs: line ? [buildClipboardRun(line, formatting)] : [],
    }));

const contextForElement = (element, context) => {
  const next = {
    formatting: { ...(context.formatting ?? {}) },
    superSubScript: context.superSubScript ?? "normal",
  };
  const tag = element.tagName;
  const style = element.style;

  if (tag === "B" || tag === "STRONG") next.formatting.weight = "bold";
  if (tag === "I" || tag === "EM") next.formatting.italics = true;
  if (tag === "U")
    next.formatting["text-decoration"] = normalizeDecoration(
      next.formatting["text-decoration"],
      "underline",
    );
  if (tag === "S" || tag === "STRIKE" || tag === "DEL")
    next.formatting["text-decoration"] = normalizeDecoration(
      next.formatting["text-decoration"],
      "line-through",
    );
  if (tag === "SUP") next.superSubScript = "super";
  if (tag === "SUB") next.superSubScript = "sub";

  if (style?.fontWeight) {
    const numericWeight = Number.parseInt(style.fontWeight, 10);
    next.formatting.weight =
      style.fontWeight === "bold" || numericWeight >= 600
        ? "bold"
        : style.fontWeight;
  }
  if (style?.fontStyle)
    next.formatting.italics = style.fontStyle === "italic";
  if (style?.color) next.formatting.color = style.color;
  if (style?.fontSize) next.formatting.size = style.fontSize;
  if (style?.fontFamily)
    next.formatting.font = normalizeFontFamily(style.fontFamily);
  if (style?.backgroundColor)
    next.formatting.highlight = style.backgroundColor;
  if (style?.textDecoration)
    next.formatting["text-decoration"] = normalizeDecoration(
      next.formatting["text-decoration"],
      style.textDecoration,
    );
  if (style?.verticalAlign === "super" || style?.verticalAlign === "sub")
    next.superSubScript = style.verticalAlign;

  if (tag === "FONT") {
    if (element.getAttribute("color"))
      next.formatting.color = element.getAttribute("color");
    if (element.getAttribute("face"))
      next.formatting.font = normalizeFontFamily(element.getAttribute("face"));
  }

  return next;
};

const paragraphFormattingForElement = (element) => {
  const formatting = {};
  const align = element.style?.textAlign || element.getAttribute?.("align");
  if (["left", "center", "right", "justify"].includes(align))
    formatting.align = align;
  return formatting;
};

export const htmlToClipboardParagraphs = (html) => {
  if (!html || typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(String(html), "text/html");
  const paragraphs = [];
  let current = null;

  const ensureParagraph = (formatting = {}) => {
    if (!current) current = { formatting: { ...formatting }, runs: [] };
    return current;
  };
  const finishParagraph = (force = false) => {
    if (!current) {
      if (force) paragraphs.push({ formatting: {}, runs: [] });
      return;
    }
    if (force || current.runs.some((run) => run.text !== ""))
      paragraphs.push({
        ...current,
        runs: mergeClipboardRuns(current.runs),
      });
    current = null;
  };
  const appendText = (text, context, paragraphFormatting) => {
    const normalized = String(text ?? "").replace(/\u00a0/g, " ");
    const lines = normalized.replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((line, index) => {
      if (index > 0) finishParagraph(true);
      if (!line || (!current && !line.trim())) return;
      ensureParagraph(paragraphFormatting).runs.push({
        text: line,
        formatting: { ...(context.formatting ?? {}) },
        "super-sub-script": context.superSubScript ?? "normal",
        link: null,
      });
    });
  };
  const walk = (node, context = { formatting: {}, superSubScript: "normal" }) => {
    if (node.nodeType === 3) {
      appendText(node.nodeValue, context, {});
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node;
    if (element.tagName === "BR") {
      finishParagraph(true);
      return;
    }

    const isBlock = BLOCK_TAGS.has(element.tagName);
    if (isBlock && current) finishParagraph();
    const nextContext = contextForElement(element, context);
    const paragraphFormatting = isBlock
      ? paragraphFormattingForElement(element)
      : {};
    if (isBlock) ensureParagraph(paragraphFormatting);
    for (const child of element.childNodes) {
      if (child.nodeType === 3)
        appendText(child.nodeValue, nextContext, paragraphFormatting);
      else walk(child, nextContext);
    }
    if (isBlock) finishParagraph(true);
  };

  for (const child of document.body.childNodes) walk(child);
  finishParagraph();
  return paragraphs;
};

const sliceRuns = (runs = [], start, end) => {
  const result = [];
  let offset = 0;
  for (const run of runs) {
    const text = run.text ?? "";
    const runStart = offset;
    const runEnd = offset + text.length;
    const from = Math.max(start, runStart);
    const to = Math.min(end, runEnd);
    if (from < to) {
      result.push({
        ...run,
        formatting: { ...(run.formatting ?? {}) },
        text: text.slice(from - runStart, to - runStart),
      });
    }
    offset = runEnd;
  }
  return result;
};

export const extractClipboardParagraphs = (paragraphs, selection) => {
  if (!selection || !Array.isArray(paragraphs) || paragraphs.length === 0) {
    return [];
  }

  const anchor = {
    paragraphIdx: selection.paragraphIdx,
    offset: selection.rangeStart,
  };
  const focus = {
    paragraphIdx: selection.endParagraphIdx ?? selection.paragraphIdx,
    offset: selection.rangeEnd,
  };
  const anchorComesFirst =
    anchor.paragraphIdx < focus.paragraphIdx ||
    (anchor.paragraphIdx === focus.paragraphIdx &&
      anchor.offset <= focus.offset);
  const start = anchorComesFirst ? anchor : focus;
  const end = anchorComesFirst ? focus : anchor;

  if (
    !Number.isInteger(start.paragraphIdx) ||
    !Number.isInteger(end.paragraphIdx) ||
    start.paragraphIdx < 0 ||
    end.paragraphIdx >= paragraphs.length ||
    (start.paragraphIdx === end.paragraphIdx && start.offset === end.offset)
  ) {
    return [];
  }

  return paragraphs
    .slice(start.paragraphIdx, end.paragraphIdx + 1)
    .map((paragraph, relativeIndex) => {
      const paragraphIdx = start.paragraphIdx + relativeIndex;
      const textLength = paragraphTextLength(paragraph);
      const from =
        paragraphIdx === start.paragraphIdx
          ? Math.max(0, Math.min(start.offset, textLength))
          : 0;
      const to =
        paragraphIdx === end.paragraphIdx
          ? Math.max(0, Math.min(end.offset, textLength))
          : textLength;
      return {
        ...paragraph,
        formatting: { ...(paragraph.formatting ?? {}) },
        runs: sliceRuns(paragraph.runs, from, to),
      };
    });
};

export const clipboardParagraphsToPlainText = (paragraphs = []) =>
  paragraphs
    .map((paragraph) =>
      (paragraph.runs ?? []).map((run) => run.text ?? "").join(""),
    )
    .join("\n");

export const insertClipboardParagraphs = (
  paragraphs,
  selection,
  clipboardParagraphs,
) => {
  const sourceParagraphs = structuredClone(paragraphs ?? []);
  const insertedParagraphs = structuredClone(clipboardParagraphs ?? []);
  if (!sourceParagraphs.length || !selection || !insertedParagraphs.length)
    return null;

  const startParagraphIdx = Math.min(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const endParagraphIdx = Math.max(
    selection.paragraphIdx,
    selection.endParagraphIdx ?? selection.paragraphIdx,
  );
  const startOffset =
    startParagraphIdx === selection.paragraphIdx
      ? selection.rangeStart
      : selection.rangeEnd;
  const endOffset =
    endParagraphIdx === (selection.endParagraphIdx ?? selection.paragraphIdx)
      ? selection.rangeEnd
      : selection.rangeStart;
  const startParagraph = sourceParagraphs[startParagraphIdx];
  const endParagraph = sourceParagraphs[endParagraphIdx];
  if (!startParagraph || !endParagraph) return null;

  const safeStartOffset = Math.max(
    0,
    Math.min(startOffset, paragraphTextLength(startParagraph)),
  );
  const safeEndOffset = Math.max(
    0,
    Math.min(endOffset, paragraphTextLength(endParagraph)),
  );
  const beforeRuns = sliceRuns(startParagraph.runs, 0, safeStartOffset);
  const afterRuns = sliceRuns(
    endParagraph.runs,
    safeEndOffset,
    paragraphTextLength(endParagraph),
  );

  const replacementParagraphs =
    insertedParagraphs.length === 1
      ? [
          {
            ...startParagraph,
            runs: mergeClipboardRuns([
              ...beforeRuns,
              ...(insertedParagraphs[0].runs ?? []),
              ...afterRuns,
            ]),
          },
        ]
      : insertedParagraphs.map((inserted, index) => {
          const isFirst = index === 0;
          const isLast = index === insertedParagraphs.length - 1;
          return {
            ...(isFirst ? startParagraph : endParagraph),
            id: isFirst ? startParagraph.id : createParagraphId(),
            formatting: {
              ...(startParagraph.formatting ?? {}),
              ...(inserted.formatting ?? {}),
            },
            runs: mergeClipboardRuns([
              ...(isFirst ? beforeRuns : []),
              ...(inserted.runs ?? []),
              ...(isLast ? afterRuns : []),
            ]),
          };
        });

  const nextParagraphs = [
    ...sourceParagraphs.slice(0, startParagraphIdx),
    ...replacementParagraphs,
    ...sourceParagraphs.slice(endParagraphIdx + 1),
  ];
  const cursorParagraphIdx =
    startParagraphIdx + insertedParagraphs.length - 1;
  const cursorOffset =
    insertedParagraphs.length === 1
      ? safeStartOffset + paragraphTextLength(insertedParagraphs[0])
      : paragraphTextLength(insertedParagraphs.at(-1));

  return {
    paragraphs: nextParagraphs,
    selection: {
      paragraphIdx: cursorParagraphIdx,
      rangeStart: cursorOffset,
      endParagraphIdx: cursorParagraphIdx,
      rangeEnd: cursorOffset,
    },
  };
};

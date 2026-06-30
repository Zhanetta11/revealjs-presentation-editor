import { escapeHtml } from "../utils/presentationUtils";
import { getListMarker, getListIndent } from "../utils/listUtils";

const validStyleValue = (v) => (v != null && v !== "undefined" ? v : undefined);

export const RUN_ONLY_KEYS = new Set(["super-sub-script", "highlight"]);

export const SHARED_KEYS = new Set([
  "weight",
  "italics",
  "text-decoration",
  "color",
  "size",
  "font",
]);

export const RUN_LEVEL_KEYS = new Set([...SHARED_KEYS, ...RUN_ONLY_KEYS]);

export const splitFormattingUpdates = (updates) => {
  const runUpdates = {};
  const paraUpdates = {};
  for (const [k, v] of Object.entries(updates)) {
    if (RUN_LEVEL_KEYS.has(k)) runUpdates[k] = v;
    else paraUpdates[k] = v;
  }
  return { runUpdates, paraUpdates };
};

export const applyFormattingToParagraphs = (paragraphs, formattingUpdate) => {
  const paragraphUpdate = Object.fromEntries(
    Object.entries(formattingUpdate).filter(([k]) => !RUN_ONLY_KEYS.has(k)),
  );
  const runOnlyUpdate = Object.fromEntries(
    Object.entries(formattingUpdate).filter(([k]) => RUN_ONLY_KEYS.has(k)),
  );
  const sharedKeysBeingSet = Object.keys(paragraphUpdate).filter((k) => SHARED_KEYS.has(k));

  return (paragraphs ?? []).map((paragraph) => ({
    ...paragraph,
    formatting: { ...(paragraph.formatting ?? {}), ...paragraphUpdate },
    runs: (paragraph.runs ?? []).map((run) => {
      const rf = { ...(run.formatting ?? {}) };
      for (const k of sharedKeysBeingSet) delete rf[k];
      Object.assign(rf, runOnlyUpdate);
      return { ...run, formatting: rf };
    }),
  }));
};

export const getFormattingAtCursor = (textElement, selection) => {
  if (!selection) return {};
  const paragraphs = textElement?.paragraphs ?? [];
  const para = paragraphs[selection.paragraphIdx];
  if (!para) return {};
  const paraFmt = para.formatting ?? {};
  const runs = para.runs ?? [];

  if (selection.rangeStart === 0 && selection.paragraphIdx > 0) {
    const prevPara = paragraphs[selection.paragraphIdx - 1];
    if (prevPara) {
      const prevRuns = prevPara.runs ?? [];
      const prevParaFmt = prevPara.formatting ?? {};
      if (prevRuns.length) {
        return {
          ...prevParaFmt,
          ...(prevRuns[prevRuns.length - 1].formatting ?? {}),
        };
      }
      return prevParaFmt;
    }
  }

  if (!runs.length) return paraFmt;
  const lookupPos = Math.max(0, selection.rangeStart - 1);
  let offset = 0;
  for (const run of runs) {
    const start = offset;
    const end = offset + run.text.length;
    if (lookupPos >= start && lookupPos < end) {
      const runFmt = { ...(run.link?.href ? { "text-decoration": "underline" } : {}), ...(run.formatting ?? {}) };
      return { ...paraFmt, ...runFmt };
    }
    offset = end;
  }
  return { ...paraFmt, ...(runs[runs.length - 1].formatting ?? {}) };
};

export const computeCurrentFormatting = ({
  isEditing,
  activeSelection,
  selectedElementId,
  selectedTextEl,
  effectiveFormatting,
  pendingFormatting,
}) => {
  if (!isEditing) return effectiveFormatting;

  const sel = activeSelection;
  const hasRealSelection =
    sel &&
    sel.elementId === selectedElementId &&
    !(
      sel.paragraphIdx === (sel.endParagraphIdx ?? sel.paragraphIdx) &&
      sel.rangeStart === sel.rangeEnd
    );

  if (hasRealSelection) {
    const paragraphs = selectedTextEl?.paragraphs ?? [];
    const epIdx = sel.endParagraphIdx ?? sel.paragraphIdx;
    const selectedParagraphs = [];
    const overlapping = [];
    for (let pIdx = sel.paragraphIdx; pIdx <= epIdx; pIdx++) {
      const para = paragraphs[pIdx];
      if (!para) continue;
      const isTrailingBoundary =
        pIdx === epIdx &&
        epIdx > sel.paragraphIdx &&
        sel.rangeEnd === 0;
      if (isTrailingBoundary) continue;

      const paraFmt = para.formatting ?? {};
      selectedParagraphs.push(paraFmt);
      const pStart = pIdx === sel.paragraphIdx ? sel.rangeStart : 0;
      const pEnd = pIdx === epIdx ? sel.rangeEnd : Infinity;
      let offset = 0;
      for (const run of para.runs ?? []) {
        const start = offset;
        const end = offset + run.text.length;
        if (end > pStart && start < pEnd)
          overlapping.push({
            paragraphFormatting: paraFmt,
            runFormatting: run.formatting ?? {},
          });
        offset = end;
      }
    }

    const result = { ...effectiveFormatting };
    const paragraphKeys = new Set(
      selectedParagraphs.flatMap((formatting) =>
        Object.keys(formatting).filter((key) => !RUN_LEVEL_KEYS.has(key)),
      ),
    );
    for (const key of paragraphKeys) {
      const vals = selectedParagraphs.map(
        (formatting) => formatting[key] ?? effectiveFormatting[key],
      );
      result[key] = vals.every((v) => v === vals[0]) ? vals[0] : "mixed";
    }

    const runKeys = new Set([
      ...Object.keys(effectiveFormatting).filter((key) => RUN_LEVEL_KEYS.has(key)),
      ...selectedParagraphs.flatMap((formatting) =>
        Object.keys(formatting).filter((key) => RUN_LEVEL_KEYS.has(key)),
      ),
      ...overlapping.flatMap(({ runFormatting }) =>
        Object.keys(runFormatting).filter((key) => RUN_LEVEL_KEYS.has(key)),
      ),
    ]);
    for (const key of runKeys) {
      const vals = overlapping.map(
        ({ paragraphFormatting, runFormatting }) =>
          runFormatting[key] ??
          paragraphFormatting[key] ??
          effectiveFormatting[key],
      );
      if (vals.length > 0)
        result[key] = vals.every((v) => v === vals[0]) ? vals[0] : "mixed";
    }

    return result;
  }

  if (sel && sel.elementId === selectedElementId && selectedTextEl) {
    const cursorFmt = getFormattingAtCursor(selectedTextEl, sel);
    return { ...effectiveFormatting, ...cursorFmt, ...pendingFormatting };
  }

  return { ...effectiveFormatting, ...pendingFormatting };
};

export const resolveWeight = (elemValue, phValue, masterValue) => {
  const v = elemValue ?? phValue ?? masterValue;
  if (v === true || v === "bold") return "bold";
  if (v === false || v === "normal") return "normal";
  return v ?? "normal";
};

export const resolveEffectiveFormatting = (
  masterFormatting = {},
  placeholderFormatting = {},
  paragraphFormatting = {},
) => ({
  ...masterFormatting,
  ...placeholderFormatting,
  ...paragraphFormatting,
});

const parseIndentValue = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveParagraphIndentStyles = (
  formatting = {},
  placeholderFormatting = {},
  masterFormatting = {},
  basePaddingLeft = null,
) => {
  const resolveValue = (key) =>
    validStyleValue(formatting[key]) ??
    validStyleValue(placeholderFormatting[key]) ??
    validStyleValue(masterFormatting[key]);

  const specialIndent = resolveValue("special-indent");
  const specialIndentBy = parseIndentValue(resolveValue("special-indent-by"));
  const legacyTextIndent = parseIndentValue(resolveValue("text-indent"));
  const beforeText = parseIndentValue(resolveValue("before-text"));
  const legacyIndentLevel = parseIndentValue(resolveValue("indent-level"));

  let paddingLeft = basePaddingLeft;
  let textIndent = null;

  if (beforeText != null && beforeText > 0) {
    paddingLeft = basePaddingLeft
      ? `calc(${basePaddingLeft} + ${beforeText}px)`
      : `${beforeText}px`;
  } else if (
    !basePaddingLeft &&
    beforeText == null &&
    legacyIndentLevel != null &&
    legacyIndentLevel > 0
  ) {
    paddingLeft = getListIndent(legacyIndentLevel - 1, "indent");
  }

  if (
    (specialIndent === "first-line" || specialIndent === "hanging") &&
    specialIndentBy != null &&
    specialIndentBy > 0
  ) {
    if (specialIndent === "first-line") {
      textIndent = `${specialIndentBy}px`;
    } else {
      textIndent = `-${specialIndentBy}px`;
      paddingLeft = paddingLeft
        ? `calc(${paddingLeft} + ${specialIndentBy}px)`
        : `${specialIndentBy}px`;
    }
  } else if (legacyTextIndent != null && legacyTextIndent !== 0) {
    if (legacyTextIndent > 0) {
      textIndent = `${legacyTextIndent}px`;
    } else {
      const hangingBy = Math.abs(legacyTextIndent);
      textIndent = `-${hangingBy}px`;
      paddingLeft = paddingLeft
        ? `calc(${paddingLeft} + ${hangingBy}px)`
        : `${hangingBy}px`;
    }
  }

  return { paddingLeft, textIndent };
};

export const buildRunStyles = (runFormatting = {}) => {
  const styles = [];
  if (runFormatting.weight != null) {
    const w =
      runFormatting.weight === true
        ? "bold"
        : runFormatting.weight === false
          ? "normal"
          : runFormatting.weight;
    styles.push(`font-weight:${w}`);
  }
  if (runFormatting.italics != null)
    styles.push(
      `font-style:${runFormatting.italics === true || runFormatting.italics === "italic" ? "italic" : "normal"}`,
    );
  if (runFormatting.color) styles.push(`color:${runFormatting.color}`);
  if (runFormatting.size) styles.push(`font-size:${runFormatting.size}`);
  if (runFormatting.font && runFormatting.font !== "undefined") styles.push(`font-family:${runFormatting.font}`);
  if (
    runFormatting["text-decoration"] &&
    runFormatting["text-decoration"] !== "none"
  )
    styles.push(`text-decoration:${runFormatting["text-decoration"]}`);
  if (runFormatting.highlight && runFormatting.highlight !== "transparent")
    styles.push(`background-color:${runFormatting.highlight}`);
  return styles.join(";");
};

export const runsToHTML = (runs, fallbackFormatting) =>
  (runs ?? [])
    .map((run) => {
      const runFmt = run.formatting ?? {};
      const fb = fallbackFormatting ?? {};
      const pick = (own, fallback) => (own !== undefined ? own : fallback);
      const styles = buildRunStyles({
        weight: pick(runFmt.weight, fb.weight),
        italics: pick(runFmt.italics, fb.italics),
        color: pick(runFmt.color, fb.color),
        size: pick(runFmt.size, fb.size),
        font: pick(runFmt.font, fb.font),
        "text-decoration": pick(runFmt["text-decoration"], fb["text-decoration"]),
        highlight: pick(runFmt.highlight, fb.highlight),
      });
      const superSub = run["super-sub-script"];
      const superSubStyle =
        superSub === "super"
          ? "vertical-align:super;font-size:0.75em"
          : superSub === "sub"
            ? "vertical-align:sub;font-size:0.75em"
            : "";
      const linkStyle = run.link?.href
        ? [
            !runFmt.color ? "color:var(--link,#2563eb)" : "",
            !runFmt["text-decoration"] ? "text-decoration:underline" : "",
            "cursor:pointer",
          ].filter(Boolean).join(";")
        : "";
      const allStyles = [styles, superSubStyle, linkStyle].filter(Boolean).join(";");
      const text = escapeHtml(run.text ?? "");
      if (run.link?.href) {
        const title = `title="🔗 ${escapeHtml(run.link.href)}&#10;Ctrl+Click to follow link"`;
        return `<span style="${allStyles}" ${title} data-link="${escapeHtml(run.link.href)}">${text}</span>`;
      }
      return allStyles ? `<span style="${allStyles}">${text}</span>` : text;
    })
    .join("");

export const paragraphsToHTML = (paragraphs, masterFormatting = {}, placeholderFormatting = {}, renderBullets = false, startCounter = 0) => {
  let numberedCounter = startCounter;
  return (paragraphs ?? [])
    .map((paragraph, index) => {
      const formatting = paragraph.formatting ?? {};
      const r = (elemVal, phVal, masterVal) => validStyleValue(elemVal) ?? validStyleValue(phVal) ?? validStyleValue(masterVal);

      const rawListType = r(formatting["list-type"], placeholderFormatting["list-type"], masterFormatting["list-type"]);
      const listType = rawListType && rawListType !== "none" ? rawListType : null;
      if (listType === "numbered") numberedCounter++;
      else if (!listType) numberedCounter = 0;

      const listLevel = Number(r(formatting["indent-level"], placeholderFormatting["indent-level"], masterFormatting["indent-level"]) ?? 0);
      const listPaddingLeft = listType ? `calc(${getListIndent(listLevel, listType)} + 1.8em)` : null;
      const { paddingLeft, textIndent } = resolveParagraphIndentStyles(
        formatting,
        placeholderFormatting,
        masterFormatting,
        listPaddingLeft,
      );

      const markerHtml = renderBullets && listType
        ? `<span style="display:inline-block;width:1.8em;margin-left:calc(-1.8em);text-align:center;">${
            listType === "numbered"
              ? getListMarker(numberedCounter - 1, "numbered", null, r(formatting["list-numbered-style"], placeholderFormatting["list-numbered-style"], masterFormatting["list-numbered-style"]))
              : getListMarker(index, "bullets", r(formatting["list-marker"], placeholderFormatting["list-marker"], masterFormatting["list-marker"]), null)
          }</span>`
        : "";

      const resolvedFallback = {
        weight: r(formatting.weight, placeholderFormatting.weight, masterFormatting.weight),
        italics: r(formatting.italics, placeholderFormatting.italics, masterFormatting.italics),
        color: r(formatting.color, placeholderFormatting.color, masterFormatting.color),
        size: r(formatting.size, placeholderFormatting.size, masterFormatting.size),
        font: r(formatting.font, placeholderFormatting.font, masterFormatting.font),
        "text-decoration": r(formatting["text-decoration"], placeholderFormatting["text-decoration"], masterFormatting["text-decoration"]),
        highlight: r(formatting.highlight, placeholderFormatting.highlight, masterFormatting.highlight),
      };

      const styles = [
        buildRunStyles({ ...resolvedFallback, highlight: undefined }),
        formatting.align || placeholderFormatting.align || masterFormatting.align
          ? `text-align:${r(formatting.align, placeholderFormatting.align, masterFormatting.align)}`
          : "",
        formatting["line-spacing"] || placeholderFormatting["line-spacing"] || masterFormatting["line-spacing"]
          ? `line-height:${r(formatting["line-spacing"], placeholderFormatting["line-spacing"], masterFormatting["line-spacing"])}`
          : "",
        r(formatting.margin, placeholderFormatting.margin, masterFormatting.margin)
          ? `margin:${r(formatting.margin, placeholderFormatting.margin, masterFormatting.margin)}`
          : "",
        paddingLeft ? `padding-left:${paddingLeft}` : "",
        textIndent ? `text-indent:${textIndent}` : "",
      ]
        .filter(Boolean)
        .join(";");

      return `<div data-paragraph-index="${index}"${
        styles ? ` style="${styles}"` : ""
      }>${markerHtml}${runsToHTML(paragraph.runs, resolvedFallback)}</div>`;
    })
    .join("");
};

export const buildPendingFormattingStyles = (pendingFormatting = {}) => {
  const styleMap = {
    weight: (v) =>
      `font-weight:${v === true || v === "bold" ? "bold" : "normal"}`,
    italics: (v) =>
      `font-style:${v === true || v === "italic" ? "italic" : "normal"}`,
    "text-decoration": (v) => `text-decoration:${v}`,
    color: (v) => `color:${v}`,
    size: (v) => `font-size:${v}`,
    font: (v) => `font-family:${v}`,
    highlight: (v) => `background-color:${v}`,
  };
  return Object.entries(pendingFormatting)
    .filter(([, v]) => v != null)
    .map(([k, v]) => styleMap[k]?.(v))
    .filter(Boolean)
    .join(";");
};

export const resolveTextStyle = (
  elemValue,
  placeholderValue,
  masterValue,
  fallback,
) => validStyleValue(elemValue) ?? validStyleValue(placeholderValue) ?? validStyleValue(masterValue) ?? fallback;

export const extractPlainTextFromParagraphs = (
  paragraphs = [],
  separator = "\n",
) =>
  paragraphs
    .map((p) => (p.runs ?? []).map((r) => r.text ?? "").join(""))
    .join(separator);

export const getSelectionFormatting = (textElement, selection) => {
  if (!selection) return null;
  const { paragraphIdx, rangeStart, endParagraphIdx, rangeEnd } = selection;
  const epIdx = endParagraphIdx ?? paragraphIdx;
  const paragraphs = textElement?.paragraphs ?? [];
  const paraFmt = paragraphs[paragraphIdx]?.formatting ?? {};

  const overlapping = [];
  for (let pIdx = paragraphIdx; pIdx <= epIdx; pIdx++) {
    const para = paragraphs[pIdx];
    if (!para) continue;
    const thisParaFmt = para.formatting ?? {};
    const pStart = pIdx === paragraphIdx ? rangeStart : 0;
    const pEnd = pIdx === epIdx ? rangeEnd : Infinity;
    let offset = 0;
    for (const run of para.runs ?? []) {
      const start = offset;
      const end = offset + run.text.length;
      if (end > pStart && start < pEnd)
        overlapping.push({
          runFmt: { ...(run.link?.href ? { "text-decoration": "underline" } : {}), ...(run.formatting ?? {}) },
          paraFmt: thisParaFmt,
        });
      offset = end;
    }
  }
  if (!overlapping.length) return paraFmt;

  const allKeys = new Set([
    ...Object.keys(paraFmt),
    ...overlapping.flatMap(({ runFmt, paraFmt: pf }) => [
      ...Object.keys(runFmt),
      ...Object.keys(pf),
    ]),
  ]);
  const result = { ...paraFmt };
  for (const key of allKeys) {
    const vals = overlapping.map(
      ({ runFmt, paraFmt: pf }) => runFmt[key] ?? pf[key],
    );
    result[key] = vals.every((v) => v === vals[0]) ? vals[0] : "mixed";
  }
  return result;
};

export function migrateParagraphFormatting(paragraphs, placeholderFormatting, masterFormatting = {}) {
  if (!paragraphs) return paragraphs;
  return paragraphs.map((p) => {
    const userSetKeys = new Set(p.userSetKeys ?? []);

    const f = { ...(p.formatting ?? {}) };
    for (const key of Object.keys(f)) {
      if (userSetKeys.has(key)) continue;
      if (key in placeholderFormatting) {
        if (f[key] === placeholderFormatting[key]) delete f[key];
      } else if (key in masterFormatting) {
        if (f[key] === masterFormatting[key]) delete f[key];
      }
    }

    const runs = (p.runs ?? []).map((run) => {
      const rf = Object.fromEntries(
        Object.entries(run.formatting ?? {}).filter(([k, v]) => {
          if (RUN_ONLY_KEYS.has(k)) return true;
          return v !== f[k];
        }),
      );
      return { ...run, formatting: rf };
    });

    if (!f["list-type"] && p.bullets && p.bullets !== "none") {
      f["list-type"] = p.bullets === "number" ? "numbered" : "bullets";
    }

    return { ...p, formatting: f, runs };
  });
}

export const parseFormattingForDisplay = (
  formatting = {},
  fallbackFont = "Arial",
) => ({
  currentSize:
    formatting.size === "mixed" ? "" : parseInt(formatting.size ?? "24", 10),
  currentFont:
    formatting.font === "mixed" ? "" : (formatting.font ?? fallbackFont),
  currentAlign:
    formatting.align === "mixed" ? null : (formatting.align ?? "left"),
  currentColor: formatting.color ?? "#111111",
  currentHighlight: formatting.highlight ?? "transparent",
  currentLineSpacing: parseFloat(formatting["line-spacing"] ?? "1.15"),
});

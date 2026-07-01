import { createParagraphId, getSlides, setSlides } from "../utils/presentationUtils";
import { applyFormattingToParagraphs, RUN_ONLY_KEYS, SHARED_KEYS } from "../text/textFormatting";

export const CONTENT_PLACEHOLDER_PROMPTS = new Set([
  "",
  "Start editing your presentation.",
  "Click to edit text",
  "Click to add text",
]);

export const createEmptyParagraphs = (paragraphs = []) => {
  const first = paragraphs[0] ?? {};
  const firstRun = first.runs?.[0] ?? {};
  return [{ ...first, runs: [{ ...firstRun, text: "", link: null }] }];
};

export const createPromptParagraphs = (paragraphs = [], promptText) => {
  const first = paragraphs[0] ?? {};
  const firstRun = first.runs?.[0] ?? {};
  return [{ ...first, runs: [{ ...firstRun, text: promptText, link: null }] }];
};


const FONT_SIZE_DELTA_KEY = "font-size-delta";

const adjustFontSize = (size, delta, fallback = 24) => {
  const current = parseFloat(size);
  const next = Math.max(
    6,
    Math.min(120, (Number.isFinite(current) ? current : fallback) + delta),
  );
  return `${next}px`;
};

export const addTextElement = (presentation, slideIndex, textElement) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      text: [...(slide.contents?.text ?? []), textElement],
    },
  };

  return setSlides(presentation, slides);
};

export const updateTextElement = (
  presentation,
  slideIndex,
  textElementId,
  newText,
  userModified,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const updatedTextElements = (slide.contents?.text ?? []).map(
    (textElement) => {
      if (textElement.id !== textElementId) return textElement;

      const lines = newText.split("\n");
      const existingParagraphs = textElement.paragraphs ?? [];

      const updatedParagraphs = lines.map((line, i) => {
        const existing = existingParagraphs[i];
        return {
          id: existing?.id ?? createParagraphId(),
          formatting: existing?.formatting ?? {},
          bullets: existing?.bullets ?? "none",
          runs: [
            {
              formatting: existing?.runs?.[0]?.formatting ?? {},
              "super-sub-script": existing?.runs?.[0]?.["super-sub-script"] ?? "normal",
              text: line,
              link: existing?.runs?.[0]?.link ?? null,
            },
          ],
        };
      });

      return {
        ...textElement,
        userModified: userModified ?? textElement.userModified,
        paragraphs: updatedParagraphs,
      };
    },
  );

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedTextElements },
  };

  return setSlides(presentation, slides);
};

export const updateSingleParagraphFormatting = (
  presentation,
  slideIndex,
  elementId,
  paragraphIdx,
  formattingUpdate,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const updatedText = (slide.contents?.text ?? []).map((el) => {
    if (el.id !== elementId) return el;
    const updatedParagraphs = (el.paragraphs ?? []).map((para, pIdx) => {
      if (pIdx !== paragraphIdx) return para;
      return {
        ...para,
        formatting: { ...(para.formatting ?? {}), ...formattingUpdate },
      };
    });
    return { ...el, paragraphs: updatedParagraphs };
  });

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedText },
  };
  return setSlides(presentation, slides);
};

export const updateTextFormatting = (
  presentation,
  slideIndex,
  textElementId,
  formattingUpdate,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;
  const fontSizeDelta = Number(formattingUpdate[FONT_SIZE_DELTA_KEY] ?? 0);
  const directFormatting = Object.fromEntries(
    Object.entries(formattingUpdate).filter(
      ([key]) => key !== FONT_SIZE_DELTA_KEY,
    ),
  );

  const updatedTextElements = (slide.contents?.text ?? []).map((textElement) => {
    if (textElement.id !== textElementId) return textElement;

    let paragraphs = applyFormattingToParagraphs(textElement.paragraphs, directFormatting);

    if (fontSizeDelta) {
      paragraphs = paragraphs.map((paragraph) => {
        const pSize = paragraph.formatting?.size;
        return {
          ...paragraph,
          formatting: pSize != null
            ? { ...paragraph.formatting, size: adjustFontSize(pSize, fontSizeDelta) }
            : paragraph.formatting,
          runs: paragraph.runs.map((run) => ({
            ...run,
            formatting: {
              ...run.formatting,
              size: adjustFontSize(run.formatting?.size, fontSizeDelta, parseFloat(paragraph.formatting?.size) || 24),
            },
          })),
        };
      });
    }

    return { ...textElement, paragraphs };
  });

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedTextElements },
  };

  return setSlides(presentation, slides);
};

export const deleteTextElement = (presentation, slideIndex, elementId) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  slides[slideIndex] = {
    ...slide,
    contents: {
      ...slide.contents,
      text: (slide.contents?.text ?? []).filter((el) => el.id !== elementId),
      animations: (slide.contents?.animations ?? [])
        .filter((a) => a.id !== elementId)
        .map((a, index) => ({ ...a, sequence: index + 1 })),
    },
  };

  return setSlides(presentation, slides);
};

export const updateTextElementParagraphs = (
  presentation,
  slideIndex,
  elementId,
  paragraphs,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const updatedText = (slide.contents?.text ?? []).map((el) => {
    if (el.id !== elementId) return el;
    return { ...el, paragraphs, userModified: true };
  });

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedText },
  };

  return setSlides(presentation, slides);
};

export const updateTextRangeFormatting = (
  presentation,
  slideIndex,
  elementId,
  startParagraphIdx,
  rangeStart,
  endParagraphIdx,
  rangeEnd,
  formatting,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const clean = Object.fromEntries(
    Object.entries(formatting).filter(([, v]) => v !== "mixed"),
  );
  if (Object.keys(clean).length === 0) return presentation;
  const fontSizeDelta = Number(clean[FONT_SIZE_DELTA_KEY] ?? 0);
  delete clean[FONT_SIZE_DELTA_KEY];

  const runFormatting = Object.fromEntries(
    Object.entries(clean).filter(
      ([k]) => SHARED_KEYS.has(k) || RUN_ONLY_KEYS.has(k),
    ),
  );
  const paraFormatting = Object.fromEntries(
    Object.entries(clean).filter(
      ([k]) => !SHARED_KEYS.has(k) && !RUN_ONLY_KEYS.has(k),
    ),
  );

  const updatedText = (slide.contents?.text ?? []).map((el) => {
    if (el.id !== elementId) return el;

    const updatedParagraphs = (el.paragraphs ?? []).map((para, pIdx) => {
      if (pIdx < startParagraphIdx || pIdx > endParagraphIdx) return para;

      const paraLen = (para.runs ?? []).reduce((a, r) => a + r.text.length, 0);
      const pRangeStart = pIdx === startParagraphIdx ? rangeStart : 0;
      const pRangeEnd = pIdx === endParagraphIdx ? rangeEnd : paraLen;
      const isTrailingBoundary =
        pIdx === endParagraphIdx &&
        endParagraphIdx > startParagraphIdx &&
        rangeEnd === 0;
      const isSelectedParagraph = !isTrailingBoundary;

      const newParaFormatting =
        isSelectedParagraph && Object.keys(paraFormatting).length > 0
          ? { ...(para.formatting ?? {}), ...paraFormatting }
          : para.formatting;

      if (pRangeStart >= pRangeEnd) {
        return newParaFormatting === para.formatting
          ? para
          : { ...para, formatting: newParaFormatting };
      }

      const newRuns = [];
      let charOffset = 0;

      for (const run of (para.runs ?? [])) {
        const runStart = charOffset;
        const runEnd = charOffset + run.text.length;

        if (runEnd <= pRangeStart || runStart >= pRangeEnd) {
          newRuns.push(run);
        } else {
          if (runStart < pRangeStart) {
            newRuns.push({
              ...run,
              text: run.text.slice(0, pRangeStart - runStart),
            });
          }
          const selectedStart = Math.max(0, pRangeStart - runStart);
          const selectedEnd = Math.min(run.text.length, pRangeEnd - runStart);
          const selectedText = run.text.slice(selectedStart, selectedEnd);
          if (selectedText.length > 0) {
            const selectedFormatting = {
              ...(run.formatting ?? {}),
              ...runFormatting,
            };
            if (fontSizeDelta) {
              selectedFormatting.size = adjustFontSize(
                run.formatting?.size,
                fontSizeDelta,
                parseFloat(para.formatting?.size) || 24,
              );
            }
            newRuns.push({
              ...run,
              text: selectedText,
              formatting:
                Object.keys(runFormatting).length > 0 || fontSizeDelta
                  ? selectedFormatting
                  : run.formatting,
            });
          }
          if (runEnd > pRangeEnd) {
            newRuns.push({
              ...run,
              text: run.text.slice(pRangeEnd - runStart),
            });
          }
        }

        charOffset = runEnd;
      }

      return {
        ...para,
        formatting: newParaFormatting,
        runs: newRuns.length > 0 ? newRuns : para.runs,
      };
    });

    return { ...el, paragraphs: updatedParagraphs };
  });

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedText },
  };

  return setSlides(presentation, slides);
};

export const updateRunLink = (
  presentation,
  slideIndex,
  elementId,
  paragraphIdx,
  rangeStart,
  rangeEnd,
  link,
) => {
  const slides = [...getSlides(presentation)];
  const slide = slides[slideIndex];
  if (!slide) return presentation;

  const updatedText = (slide.contents?.text ?? []).map((el) => {
    if (el.id !== elementId) return el;

    const updatedParagraphs = (el.paragraphs ?? []).map((para, pIdx) => {
      if (pIdx !== paragraphIdx) return para;

      const newRuns = [];
      let charOffset = 0;

      for (const run of (para.runs ?? [])) {
        const runStart = charOffset;
        const runEnd = charOffset + run.text.length;

        if (runEnd <= rangeStart || runStart >= rangeEnd) {
          newRuns.push(run);
        } else {
          if (runStart < rangeStart) {
            newRuns.push({
              ...run,
              text: run.text.slice(0, rangeStart - runStart),
            });
          }
          const selectedStart = Math.max(0, rangeStart - runStart);
          const selectedEnd = Math.min(run.text.length, rangeEnd - runStart);
          newRuns.push({
            ...run,
            text: run.text.slice(selectedStart, selectedEnd),
            link,
          });
          if (runEnd > rangeEnd) {
            newRuns.push({ ...run, text: run.text.slice(rangeEnd - runStart) });
          }
        }

        charOffset = runEnd;
      }

      return { ...para, runs: newRuns };
    });

    return { ...el, paragraphs: updatedParagraphs };
  });

  slides[slideIndex] = {
    ...slide,
    contents: { ...slide.contents, text: updatedText },
  };

  return setSlides(presentation, slides);
};

import { createParagraphId } from "../utils/presentationUtils";

const parseSpanStyle = (style) => {
  const f = {};

  if (style.fontWeight) {
    const w = style.fontWeight;
    f.weight = w === "400" ? "normal" : w === "700" ? "bold" : w;
  }
  if (style.fontStyle === "italic") f.italics = true;
  if (style.color) f.color = style.color;
  if (style.fontSize) f.size = style.fontSize;
  if (style.fontFamily) {
    const font = style.fontFamily.replace(/^["']|["']$/g, "").trim();
    if (font && font !== "undefined") f.font = font;
  }
  if (style.textDecoration && style.textDecoration !== "none")
    f["text-decoration"] = style.textDecoration;
  if (style.backgroundColor && style.backgroundColor !== "transparent")
    f.highlight = style.backgroundColor;
  return f;
};

export const domToParagraphs = (el, existingParagraphs) => {
  const paragraphs = [[]];

  const addText = (text, fmt, link = null) => {
    if (!text) return;
    const lastPara = paragraphs[paragraphs.length - 1];
    const last = lastPara[lastPara.length - 1];
    if (
      last &&
      JSON.stringify(last.formatting) === JSON.stringify(fmt) &&
      JSON.stringify(last.link ?? null) === JSON.stringify(link ?? null)
    ) {
      last.text += text;
    } else {
      lastPara.push({
        text,
        formatting: fmt,
        "super-sub-script": "normal",
        link,
      });
    }
  };

  const walk = (node, fmt = {}, link = null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      addText(node.textContent, fmt, link);
    } else if (node.nodeName === "BR") {
      paragraphs.push([]);
    } else if (node.nodeName === "SPAN") {
      const merged = { ...fmt, ...parseSpanStyle(node.style) };
      const spanLink = node.dataset?.link
        ? { href: node.dataset.link, target: "_blank" }
        : link;
      node.childNodes.forEach((c) => walk(c, merged, spanLink));
    } else if (node.nodeName === "DIV" || node.nodeName === "P") {
      if (paragraphs[paragraphs.length - 1].length > 0) paragraphs.push([]);
      node.childNodes.forEach((c) => walk(c, fmt, link));
    } else {
      node.childNodes.forEach((c) => walk(c, fmt, link));
    }
  };

  el.childNodes.forEach((n) => walk(n));

  return paragraphs.map((runs, pIdx) => {
    const existing = (existingParagraphs ?? [])[pIdx];
    const isNewParagraph = !existing;
    const prevFormatting =
      pIdx > 0 ? ((existingParagraphs ?? [])[pIdx - 1]?.formatting ?? {}) : {};

    let formatting = existing?.formatting ?? {};
    if (
      isNewParagraph &&
      prevFormatting["list-type"] &&
      prevFormatting["list-type"] !== "none"
    ) {
      formatting = {
        "list-type": prevFormatting["list-type"],
        "indent-level": prevFormatting["indent-level"] ?? 0,
        ...(prevFormatting["list-marker"]
          ? { "list-marker": prevFormatting["list-marker"] }
          : {}),
        ...(prevFormatting["list-numbered-style"]
          ? { "list-numbered-style": prevFormatting["list-numbered-style"] }
          : {}),
      };
    }

    return {
      id: existing?.id ?? createParagraphId(),
      formatting,
      bullets: existing?.bullets ?? "none",
      runs: runs.length
        ? runs
        : [
            {
              text: "",
              formatting: {},
              "super-sub-script": "normal",
              link: null,
            },
          ],
    };
  });
};

export const getCaretOffset = (el) => {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
};

const getNodeAtOffset = (el, targetOffset) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let chars = 0;
  let node;
  let last = null;
  while ((node = walker.nextNode())) {
    last = node;
    const len = node.textContent.length;
    if (chars + len >= targetOffset)
      return { node, offset: targetOffset - chars };
    chars += len;
  }
  return last ? { node: last, offset: last.textContent.length } : null;
};

export const setCaretOffset = (el, offset) => {
  const pos = getNodeAtOffset(el, offset);
  if (!pos) return;
  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const paragraphToGlobal = (paragraphs, pIdx, charOffset) => {
  let global = charOffset;
  for (let i = 0; i < pIdx; i++) {
    global += (paragraphs[i]?.runs ?? []).reduce(
      (a, r) => a + r.text.length,
      0,
    );
  }
  return global;
};

export const restoreSelectionToDOM = (el, paragraphs, sel) => {
  if (!sel) return;
  const { paragraphIdx, rangeStart, endParagraphIdx, rangeEnd } = sel;
  const ep = endParagraphIdx ?? paragraphIdx;
  const startGlobal = paragraphToGlobal(paragraphs, paragraphIdx, rangeStart);
  const endGlobal = paragraphToGlobal(paragraphs, ep, rangeEnd);
  const startPos = getNodeAtOffset(el, startGlobal);
  const endPos = getNodeAtOffset(el, endGlobal);
  if (!startPos || !endPos) return;
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  const domSel = window.getSelection();
  domSel?.removeAllRanges();
  domSel?.addRange(range);
};

export const getCollapsedCursorOffset = (el) => {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;

  let paragraphIdx = 0;
  let rangeStart = 0;
  let found = false;
  let currentParaHasContent = false;

  const countContent = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      rangeStart += node.textContent.length;
      if (node.textContent.length > 0) currentParaHasContent = true;
    } else if (node.nodeName === "BR") {
      paragraphIdx++;
      rangeStart = 0;
      currentParaHasContent = false;
    } else if (node.nodeName === "DIV" || node.nodeName === "P") {
      if (currentParaHasContent) {
        paragraphIdx++;
        rangeStart = 0;
        currentParaHasContent = false;
      }
      node.childNodes.forEach(countContent);
    } else {
      node.childNodes.forEach(countContent);
    }
  };

  const walk = (node) => {
    if (found) return;

    const isBlock = node.nodeName === "DIV" || node.nodeName === "P";
    if (isBlock && currentParaHasContent) {
      paragraphIdx++;
      rangeStart = 0;
      currentParaHasContent = false;
    }

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        rangeStart += range.startOffset;
      } else {
        for (let i = 0; i < range.startOffset; i++)
          countContent(node.childNodes[i]);
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      rangeStart += node.textContent.length;
      if (node.textContent.length > 0) currentParaHasContent = true;
    } else if (node.nodeName === "BR") {
      paragraphIdx++;
      rangeStart = 0;
      currentParaHasContent = false;
    } else {
      node.childNodes.forEach(walk);
    }
  };

  if (el === range.startContainer) {
    for (let i = 0; i < range.startOffset; i++) countContent(el.childNodes[i]);
    return { paragraphIdx, rangeStart, rangeEnd: rangeStart };
  }

  el.childNodes.forEach(walk);

  return { paragraphIdx, rangeStart, rangeEnd: rangeStart };
};

export const getSelectionOffsets = (el) => {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer))
    return null;

  const locatePoint = (targetNode, targetOffset) => {
    let paragraphIdx = 0;
    let charOffset = 0;
    let paragraphHasContent = false;
    let result = null;

    const startBlock = () => {
      if (paragraphHasContent) {
        paragraphIdx++;
        charOffset = 0;
        paragraphHasContent = false;
      }
    };

    const consumeNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        charOffset += node.textContent?.length ?? 0;
        if (node.textContent?.length) paragraphHasContent = true;
        return;
      }
      if (node.nodeName === "BR") {
        paragraphIdx++;
        charOffset = 0;
        paragraphHasContent = false;
        return;
      }
      if (node.nodeName === "DIV" || node.nodeName === "P") startBlock();
      node.childNodes.forEach(consumeNode);
    };

    const walk = (node) => {
      if (result) return;

      if (node === targetNode) {
        if (node.nodeType === Node.TEXT_NODE) {
          result = {
            paragraphIdx,
            offset:
              charOffset +
              Math.min(targetOffset, node.textContent?.length ?? 0),
          };
        } else {
          for (let i = 0; i < targetOffset; i++) {
            const child = node.childNodes[i];
            if (child) consumeNode(child);
          }
          result = { paragraphIdx, offset: charOffset };
        }
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        consumeNode(node);
        return;
      }
      if (node.nodeName === "BR") {
        consumeNode(node);
        return;
      }
      if (node.nodeName === "DIV" || node.nodeName === "P") startBlock();
      node.childNodes.forEach(walk);
    };

    if (el === targetNode) {
      for (let i = 0; i < targetOffset; i++) {
        const child = el.childNodes[i];
        if (child) consumeNode(child);
      }
      return { paragraphIdx, offset: charOffset };
    }

    el.childNodes.forEach(walk);
    return result;
  };

  const start = locatePoint(range.startContainer, range.startOffset);
  const end = locatePoint(range.endContainer, range.endOffset);
  if (!start || !end) return null;

  return {
    paragraphIdx: start.paragraphIdx,
    rangeStart: start.offset,
    endParagraphIdx: end.paragraphIdx,
    rangeEnd: end.offset,
  };
};

import { useLayoutEffect, useState } from "react";

export default function useTextLayout({
  editableRef,
  innerHTML,
  textWidth,
  paragraphs,
  paragraphListInfos,
}) {
  const [paragraphTops, setParagraphTops] = useState([]);
  const [paragraphTextLefts, setParagraphTextLefts] = useState([]);
  const [paragraphTextTops, setParagraphTextTops] = useState([]);
  const [editableOffsetTop, setEditableOffsetTop] = useState(0);

  useLayoutEffect(() => {
    const editable = editableRef.current;
    if (!editable) return undefined;

    const measureParagraphs = () => {
      const paragraphElements = Array.from(editable.children).filter(
        (child) => child.tagName === "DIV" || child.tagName === "P",
      );
      paragraphElements.forEach((paragraph, index) => {
        const info = paragraphListInfos[index];
        if (info?.paddingLeft) {
          paragraph.style.paddingLeft = info.paddingLeft;
        }
      });

      const nextTops = paragraphElements.map(
        (paragraph) => paragraph.offsetTop,
      );
      const editableRect = editable.getBoundingClientRect();
      const scaleX =
        editable.offsetWidth > 0
          ? editableRect.width / editable.offsetWidth
          : 1;
      const scaleY =
        editable.offsetHeight > 0
          ? editableRect.height / editable.offsetHeight
          : 1;
      const textRects = paragraphElements.map((paragraph) => {
        const walker = document.createTreeWalker(
          paragraph,
          NodeFilter.SHOW_TEXT,
        );
        let textNode = walker.nextNode();
        while (textNode && !textNode.textContent?.length) {
          textNode = walker.nextNode();
        }
        if (!textNode) return null;

        const range = document.createRange();
        range.selectNodeContents(textNode);
        return (
          range.getClientRects?.()[0] ?? range.getBoundingClientRect?.()
        );
      });
      const nextTextLefts = textRects.map((textRect, index) => {
        const align = paragraphListInfos[index]?.align ?? "left";
        if (
          (align !== "center" && align !== "right") ||
          !textRect ||
          !Number.isFinite(textRect.left)
        ) {
          return null;
        }
        return Math.round(
          (editable.offsetLeft +
            (textRect.left - editableRect.left) / (scaleX || 1)) *
          1000,
        ) / 1000;
      });
      const nextTextTops = textRects.map((textRect) => {
        if (!textRect || !Number.isFinite(textRect.top)) return null;
        return (
          Math.round(
            ((textRect.top - editableRect.top) / (scaleY || 1)) * 1000,
          ) / 1000
        );
      });
      setParagraphTops((current) =>
        current.length === nextTops.length &&
        current.every((top, index) => top === nextTops[index])
          ? current
          : nextTops,
      );
      setParagraphTextLefts((current) =>
        current.length === nextTextLefts.length &&
        current.every((left, index) => left === nextTextLefts[index])
          ? current
          : nextTextLefts,
      );
      setParagraphTextTops((current) =>
        current.length === nextTextTops.length &&
        current.every((top, index) => top === nextTextTops[index])
          ? current
          : nextTextTops,
      );
      setEditableOffsetTop(editable.offsetTop);
    };

    measureParagraphs();
    const observer = new ResizeObserver(measureParagraphs);
    observer.observe(editable);
    Array.from(editable.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [
    editableRef,
    innerHTML,
    paragraphListInfos,
    paragraphs,
    textWidth,
  ]);

  return {
    paragraphTops,
    paragraphTextLefts,
    paragraphTextTops,
    editableOffsetTop,
  };
}

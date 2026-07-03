import { useLayoutEffect, useState } from "react";
import { getListIndent } from "../../../../../core/utils/listUtils";

export default function useTextLayout({
  editableRef,
  innerHTML,
  textWidth,
  paragraphs,
  paragraphListInfos,
}) {
  const [paragraphTops, setParagraphTops] = useState([]);
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
        paragraph.style.paddingLeft = info?.listType
          ? `calc(${getListIndent(info.listLevel, info.listType)} + 1.2em)`
          : getListIndent(info?.listLevel ?? 0, "indent");
      });

      const nextTops = paragraphElements.map(
        (paragraph) => paragraph.offsetTop,
      );
      setParagraphTops((current) =>
        current.length === nextTops.length &&
        current.every((top, index) => top === nextTops[index])
          ? current
          : nextTops,
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

  return { paragraphTops, editableOffsetTop };
}

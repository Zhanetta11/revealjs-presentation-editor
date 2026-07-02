import { useRef, useState, useEffect, useCallback } from "react";
import "./SlideList.css";
import SlideThumbnail from "../slides/SlideThumbnail";
import { getSlideCommentCounts } from "../../core/operations/slideOperations";

const MIN_WIDTH = 140;
const MAX_WIDTH = 400;

export default function SlideList({
  slides,
  selectedSlideId,
  onSelectSlide,
  onReorderSlide,
  onDeleteSlide,
  slideWidth,
  slideHeight,
  presentation,
}) {
  const commentCounts = getSlideCommentCounts(slides);
  const listRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(280);
  const isDraggingResize = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingResize.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;

    const onMouseMove = (ev) => {
      if (!isDraggingResize.current) return;
      const delta = ev.clientX - startX.current;
      setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
    };
    const onMouseUp = () => {
      isDraggingResize.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [panelWidth]);
  const itemRefs = useRef([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const lastScrollTime = useRef(0);
  const accumulated = useRef(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const total = slides?.length ?? 0;
      if (total === 0) return;

      accumulated.current += e.deltaY;

      const now = Date.now();
      if (now - lastScrollTime.current < 250) return;
      lastScrollTime.current = now;

      const delta = accumulated.current;
      accumulated.current = 0;

      if (delta > 0 && selectedSlideId < total - 1) {
        onSelectSlide(selectedSlideId + 1);
      } else if (delta < 0 && selectedSlideId > 0) {
        onSelectSlide(selectedSlideId - 1);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [slides, selectedSlideId, onSelectSlide]);

  useEffect(() => {
    const el = itemRefs.current[selectedSlideId];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSlideId]);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (index !== dragOverIndex) setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderSlide?.(draggedIndex, index);
      onSelectSlide(index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDeleteKey = (e, index) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if ((slides?.length ?? 0) <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectSlide(index);
    onDeleteSlide?.();
  };

  return (
    <aside className="slide-list" ref={listRef} style={{ width: panelWidth }}>
      <div className="slide-list-resizer" onMouseDown={onResizerMouseDown} />
      {(slides ?? []).map((slide, index) => {
        const slideTitle = slide.title?.content ?? `Slide ${index + 1}`;
        const isHidden = slide.hidden ?? false;
        const isActive = selectedSlideId === index;
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index && draggedIndex !== index;

        return (
          <div
            key={`slide-${index}`}
            className="slide-list-row"
            ref={(el) => (itemRefs.current[index] = el)}
          >
            <span className="slide-number">{index + 1}</span>

            <div
              className={[
                "slide-list-item",
                isActive ? "active" : "",
                isHidden ? "hidden-slide" : "",
                isDragging ? "dragging" : "",
                isDragOver ? "drag-over" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable
              tabIndex={0}
              onClick={() => onSelectSlide(index)}
              onKeyDown={(e) => handleDeleteKey(e, index)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              title={isHidden ? `${slideTitle} (hidden)` : slideTitle}
            >
              <SlideThumbnail
                slide={slide}
                commentCount={commentCounts[index]}
                slideWidth={slideWidth}
                slideHeight={slideHeight}
                presentation={presentation}
              />
            </div>
          </div>
        );
      })}
    </aside>
  );
}

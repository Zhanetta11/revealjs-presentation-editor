import { Fragment, useState } from "react";
import "./SlideSorterView.css";
import SlideThumbnail from "../slides/SlideThumbnail";

function SlideMiniature({
    slide,
    index,
    isSelected,
    isDragging,
    onClick,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    presentation,
}) {
    const { width = 1280, height = 720 } = presentation?.slideset?.master?.["slide-dimensions"] ?? {};
    const THUMB_W = 200;

    return (
        <div
            className={`sorter-slide${isSelected ? " selected" : ""}${slide.hidden ? " hidden" : ""}${isDragging ? " dragging" : ""}`}
            draggable
            onClick={() => onClick(index)}
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={onDragEnd}
        >
            <div className="sorter-slide-number">{index + 1}</div>
            <div className="sorter-slide-thumb" style={{ width: THUMB_W }}>
                {/* Same renderer as the sidebar slide list, so the sorter
                    shows text formatting, media, and backgrounds exactly
                    like the normal view instead of a simplified copy. */}
                <SlideThumbnail
                    slide={slide}
                    slideWidth={width}
                    slideHeight={height}
                    presentation={presentation}
                />
            </div>
            {slide.hidden && <div className="sorter-hidden-badge">Hidden</div>}
        </div>
    );
}

export default function SlideSorterView({ slides, selectedSlideIndex, onSelectSlide, onReorderSlide, presentation }) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [gapIndex, setGapIndex] = useState(null);

    const { width = 1280, height = 720 } = presentation?.slideset?.master?.["slide-dimensions"] ?? {};
    const indicatorHeight = height * (200 / width);

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const gap = e.clientX < rect.left + rect.width / 2 ? index : index + 1;
        if (gap !== gapIndex) setGapIndex(gap);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (draggedIndex !== null && gapIndex !== null) {
            const toIndex = gapIndex > draggedIndex ? gapIndex - 1 : gapIndex;
            if (toIndex !== draggedIndex) {
                onReorderSlide?.(draggedIndex, toIndex);
                onSelectSlide(toIndex);
            }
        }
        setDraggedIndex(null);
        setGapIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setGapIndex(null);
    };

    const isDragging = draggedIndex !== null;

    const indicator = (key) => (
        <div key={key} className="sorter-drop-indicator" style={{ height: indicatorHeight }}>
            <span className="sorter-drop-indicator-bar" />
        </div>
    );

    return (
        <div className="slide-sorter-view" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            {slides.map((slide, index) => (
                <Fragment key={slide.id ?? index}>
                    {isDragging && gapIndex === index && indicator(`gap-${index}`)}
                    <SlideMiniature
                        slide={slide}
                        index={index}
                        isSelected={index === selectedSlideIndex}
                        isDragging={draggedIndex === index}
                        onClick={onSelectSlide}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        presentation={presentation}
                    />
                </Fragment>
            ))}
            {isDragging && gapIndex === slides.length && indicator("gap-end")}
        </div>
    );
}

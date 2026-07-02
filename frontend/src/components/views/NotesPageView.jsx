import { useEffect, useRef } from "react";
import "./NotesPageView.css";
import { buildColorThemeStyle } from "../../core/render/revealRenderer";
import SlideThumbnail from "../slides/SlideThumbnail";

function NotesPage({
    slide,
    index,
    isSelected,
    presentation,
    width,
    height,
    onSelect,
    onUpdateSlideNotes,
    onBeginHistory,
    onCommitHistory,
}) {
    const PREVIEW_W = 600;

    return (
        <div
            className={`notes-page${isSelected ? " selected" : ""}`}
            onClick={() => onSelect(index)}
        >
            <div className="notes-page-number">{index + 1}</div>

            <div className="notes-page-slide-wrap">
                <div
                    className="notes-page-slide-frame"
                    style={{ width: PREVIEW_W }}
                >
                    {/* Same renderer as the sidebar and the slide sorter, so the
                        notes page shows media, backgrounds and text formatting. */}
                    <SlideThumbnail
                        slide={slide}
                        slideWidth={width}
                        slideHeight={height}
                        presentation={presentation}
                    />
                </div>
            </div>

            <div className="notes-page-notes-wrap">
                <div className="notes-page-notes-label">Notes</div>
                <textarea
                    className="notes-page-textarea"
                    value={slide?.contents?.notes ?? ""}
                    onFocus={() => {
                        onSelect(index);
                        onBeginHistory?.();
                    }}
                    onChange={(e) => onUpdateSlideNotes(e.target.value, index)}
                    onBlur={() => onCommitHistory?.()}
                    placeholder="Click to add notes"
                />
            </div>
        </div>
    );
}

export default function NotesPageView({
    slides,
    selectedSlideIndex,
    presentation,
    onSelectSlide,
    onUpdateSlideNotes,
    onBeginHistory,
    onCommitHistory,
}) {
    const colorThemeStyle = buildColorThemeStyle(presentation);
    const dims = presentation?.slideset?.master?.["slide-dimensions"];
    const width = dims?.width ?? 1280;
    const height = dims?.height ?? 720;

    const pageRefs = useRef({});

    useEffect(() => {
        pageRefs.current[selectedSlideIndex]?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
        });
    }, [selectedSlideIndex]);

    return (
        <div className="notes-page-view" style={colorThemeStyle}>
            {(slides ?? []).map((slide, index) => (
                <div
                    key={slide.id ?? index}
                    ref={(el) => (pageRefs.current[index] = el)}
                >
                    <NotesPage
                        slide={slide}
                        index={index}
                        isSelected={index === selectedSlideIndex}
                        presentation={presentation}
                        width={width}
                        height={height}
                        onSelect={onSelectSlide}
                        onUpdateSlideNotes={onUpdateSlideNotes}
                        onBeginHistory={onBeginHistory}
                        onCommitHistory={onCommitHistory}
                    />
                </div>
            ))}
        </div>
    );
}

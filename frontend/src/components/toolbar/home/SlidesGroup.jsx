import { useState, useRef, useEffect } from "react";
import {
  MdAdd,
  MdDelete,
  MdContentCopy,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import LayoutThumb from "../shared/LayoutThumb";
import "./SlidesGroup.css";

function LayoutGrid({ layouts, presentation, onSelect }) {
  return (
    <div className="layout-grid">
      {layouts.map((layout) => (
        <button
          key={layout["layout-id"]}
          className="layout-grid-item"
          onClick={() => onSelect(layout["layout-id"])}
        >
          <div className="layout-grid-thumb">
            <LayoutThumb layout={layout} presentation={presentation} />
          </div>
          <span className="layout-grid-label">
            {layout.name ?? layout["layout-id"]}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function SlidesGroup({
  onAddSlide,
  onApplyLayout,
  onDeleteSlide,
  onResetLayout,
  presentation,
  onDuplicateSlide,
  canDelete,
  onToggleSlideHidden,
  isSlideHidden,
  isSlideMasterOpen = false,
}) {
  const [showLayouts, setShowLayouts] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [newSlidePos, setNewSlidePos] = useState({ top: 0, left: 0 });
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const layouts = presentation?.slideset?.layouts ?? [];

  const newSlideBtnRef = useRef(null);
  const layoutBtnRef = useRef(null);

  const handleNewSlideToggle = () => {
    if (!showLayouts && newSlideBtnRef.current) {
      const rect = newSlideBtnRef.current.getBoundingClientRect();
      setNewSlidePos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowLayouts((v) => !v);
  };

  const handleLayoutPanelToggle = () => {
    if (!showLayoutPanel && layoutBtnRef.current) {
      const rect = layoutBtnRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowLayoutPanel((v) => !v);
  };

  const handleLayoutSelect = (layoutId) => {
    onAddSlide?.(layoutId);
    setShowLayouts(false);
  };

  useEffect(() => {
    if (!showLayouts) return;
    const handler = (e) => {
      if (
        newSlideBtnRef.current &&
        !newSlideBtnRef.current
          .closest(".toolbar-dropdown-container")
          .contains(e.target)
      ) {
        setShowLayouts(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLayouts]);

  useEffect(() => {
    if (!showLayoutPanel) return;
    const handler = (e) => {
      if (
        layoutBtnRef.current &&
        !layoutBtnRef.current
          .closest(".layout-apply-container")
          .contains(e.target)
      ) {
        setShowLayoutPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLayoutPanel]);

  return (
    <div className="ribbon-group slides-group">
      <div className="toolbar-dropdown-container">
        <button
          ref={newSlideBtnRef}
          className="toolbar-item large"
          onClick={handleNewSlideToggle}
          disabled={isSlideMasterOpen}
          title={isSlideMasterOpen ? "Close Slide Master to add slides" : "New Slide"}
        >
          <MdAdd />
          <span>
            New Slide <span className="toolbar-dropdown-mark">▾</span>
          </span>
        </button>

        {showLayouts && (
          <div
            className="layout-popup"
            style={{ top: newSlidePos.top, left: newSlidePos.left }}
          >
            <h4>Layouts</h4>
            <LayoutGrid
              layouts={layouts}
              presentation={presentation}
              onSelect={handleLayoutSelect}
            />
          </div>
        )}
      </div>

      <div className="mini-stack text-stack">
        <div className="layout-apply-container">
          <button
            ref={layoutBtnRef}
            className="mini-text-command layout-apply-btn"
            onClick={handleLayoutPanelToggle}
          >
            Layout <span className="toolbar-dropdown-mark">▾</span>
          </button>
          {showLayoutPanel && (
            <div
              className="layout-apply-popup"
              style={{ top: popupPos.top, left: popupPos.left }}
            >
              <h4>Layouts</h4>
              <LayoutGrid
                layouts={layouts}
                presentation={presentation}
                onSelect={(id) => {
                  onApplyLayout?.(id);
                  setShowLayoutPanel(false);
                }}
              />
            </div>
          )}
        </div>
        <button className="mini-text-command" onClick={onResetLayout}>
          Reset
        </button>
        <button className="mini-text-command" disabled>
          Section
        </button>
      </div>

      <button
        className="toolbar-item"
        onClick={onDeleteSlide}
        disabled={!canDelete}
      >
        <MdDelete />
        <span>Delete</span>
      </button>

      <button className="toolbar-item" onClick={onDuplicateSlide}>
        <MdContentCopy />
        <span>Duplicate</span>
      </button>

      <button className="toolbar-item" onClick={onToggleSlideHidden}>
        {isSlideHidden ? <MdVisibility /> : <MdVisibilityOff />}
        <span>{isSlideHidden ? "Show" : "Hide"}</span>
      </button>

      <div className="ribbon-group-title">Slides</div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  MdAdd,
  MdAddComment,
  MdImage,
  MdLink,
  MdTextFields,
  MdVideoLibrary,
} from "react-icons/md";
import LayoutThumb from "../shared/LayoutThumb";
import HyperlinkDialog from "../../canvas/dialogs/HyperlinkDialog";

export default function InsertTab({ onImageUpload, onVideoUpload, onAddSlide, onAddTextElement, currentBgImage, presentation, isSlideMasterOpen, selectedElement, selectedHyperlinkText = "", onHyperlink, onNewComment, showFormatBackground = false, onToggleFormatBackground }) {
  const layouts = presentation?.slideset?.layouts ?? [];
  const [showLayouts, setShowLayouts] = useState(false);
  const [newSlidePos, setNewSlidePos] = useState({ top: 0, left: 0 });
  const newSlideBtnRef = useRef(null);
  const [showHyperlinkDialog, setShowHyperlinkDialog] = useState(false);
  const isFormatBgOpen = showFormatBackground && !isSlideMasterOpen;

  const handleNewSlideToggle = () => {
    if (!showLayouts && newSlideBtnRef.current) {
      const rect = newSlideBtnRef.current.getBoundingClientRect();
      setNewSlidePos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowLayouts((v) => !v);
  };

  useEffect(() => {
    if (!showLayouts) return;
    const handler = (e) => {
      if (newSlideBtnRef.current && !newSlideBtnRef.current.closest(".insert-new-slide-container").contains(e.target)) {
        setShowLayouts(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLayouts]);

  return (
    <>
      <div className="ribbon-group">
        <div className="insert-new-slide-container">
          <button
            ref={newSlideBtnRef}
            className="toolbar-item large"
            onClick={handleNewSlideToggle}
          >
            <MdAdd />
            <span>New Slide</span>
          </button>

          {showLayouts && (
            <div className="layout-popup" style={{ top: newSlidePos.top, left: newSlidePos.left }}>
              <h4>Layouts</h4>
              <div className="layout-grid">
                {layouts.map((layout) => (
                  <button
                    key={layout["layout-id"]}
                    className="layout-grid-item"
                    onClick={() => { onAddSlide?.(layout["layout-id"]); setShowLayouts(false); }}
                  >
                    <div className="layout-grid-thumb">
                      <LayoutThumb layout={layout} presentation={presentation} />
                    </div>
                    <span className="layout-grid-label">{layout.name ?? layout["layout-id"]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ribbon-group-title">Slides</div>
      </div>

      <div className="ribbon-group">
        <label className="toolbar-item large toolbar-upload">
          <MdImage />
          <span>Pictures</span>
          <input type="file" accept="image/*" onChange={onImageUpload} hidden />
        </label>

        <label className="toolbar-item large toolbar-upload">
          <MdVideoLibrary />
          <span>Video</span>
          <input type="file" accept="video/*" onChange={onVideoUpload} hidden />
        </label>

        <button className="toolbar-item large" onClick={() => onAddTextElement?.()}>
          <MdTextFields />
          <span>Text Box</span>
        </button>

        <div className="ribbon-group-title">Insert</div>
      </div>

      <div className="ribbon-group toolbar-links-group">
        <button
          className="toolbar-item large"
          onClick={() => setShowHyperlinkDialog(true)}
          title="Insert Link"
        >
          <MdLink />
          <span>Link</span>
        </button>

        {showHyperlinkDialog && (
          <HyperlinkDialog
            selectedText={selectedHyperlinkText}
            presentation={presentation}
            onApply={(payload) => {
              const ok = onHyperlink?.(selectedElement?.id, payload);
              if (ok !== false) setShowHyperlinkDialog(false);
              return ok;
            }}
            onClose={() => setShowHyperlinkDialog(false)}
          />
        )}

        <div className="ribbon-group-title">Links</div>
      </div>

      <div className="ribbon-group toolbar-comments-group">
        <button
          className="toolbar-item large"
          onClick={() => onNewComment?.()}
          title="New Comment"
        >
          <MdAddComment />
          <span>Comment</span>
        </button>

        <div className="ribbon-group-title">Comments</div>
      </div>

      <div className="ribbon-group">
        <button
          className={`toolbar-item large${isFormatBgOpen ? " active" : ""}`}
          onClick={() => onToggleFormatBackground?.()}
          title="Format Background"
          disabled={isSlideMasterOpen}
        >
          <MdImage style={{ color: currentBgImage ? "#4caf50" : undefined }} />
          <span>Background<br/>Image</span>
        </button>

        <div className="ribbon-group-title">Background</div>
      </div>
    </>
  );
}

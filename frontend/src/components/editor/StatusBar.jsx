import "./StatusBar.css";
import { isElectron } from "../../core/platform/electron";

const SAVE_STATUS_LABEL = {
  pending: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
};

const folderName = (folderPath) => folderPath?.split(/[/\\]/).filter(Boolean).pop();

export default function StatusBar({
  selectedSlideIndex,
  totalSlides,
  saveStatus = "idle",
  linkedFolderPath = null,
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  showNotes,
  onToggleNotes,
  showComments,
  onToggleComments,
  commentCount = 0,
}) {
  const displayZoom = Math.round(Number(zoom) || 0);
  const saveStatusLabel = saveStatus === "saved"
    ? (!isElectron() ? "Saved" : linkedFolderPath ? `Saved to "${folderName(linkedFolderPath)}"` : "Saved (draft)")
    : SAVE_STATUS_LABEL[saveStatus];

  return (
    <footer className="status-bar">
      <div className="status-left">
        <span>
          Slide {selectedSlideIndex + 1} of {totalSlides}
        </span>

        {saveStatusLabel && (
          <span className={`save-status save-status-${saveStatus}`}>
            {saveStatusLabel}
          </span>
        )}

        <button
          className={`status-button ${showComments ? "active" : ""}`}
          onClick={onToggleComments}
          title="Toggle comments panel"
        >
          💬 Comments{commentCount > 0 ? ` (${commentCount})` : ""}
        </button>
      </div>

      <div className="status-right">
        <button
          className={`status-button ${showNotes ? "active" : ""}`}
          onClick={onToggleNotes}
        >
          Notes
        </button>

        <button className="zoom-button" onClick={onZoomOut} title="Zoom Out">
          −
        </button>

        <input
          className="zoom-slider"
          type="range"
          min="25"
          max="200"
          step="5"
          value={displayZoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />

        <button className="zoom-button" onClick={onZoomIn} title="Zoom In">
          +
        </button>

        <span className="zoom-value">{displayZoom}%</span>
      </div>
    </footer>
  );
}

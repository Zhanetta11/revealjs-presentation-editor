import { MdFileUpload, MdImage, MdVideocam } from "react-icons/md";

export default function PlaceholderActionButtons({
  onImageClick,
  onVideoClick,
  disabled = false,
}) {
  if (!disabled && !onImageClick && !onVideoClick) return null;

  const title = (label) =>
    disabled ? `${label} (available on slides)` : label;

  return (
    <div
      className="content-placeholder-buttons"
      aria-label="Content placeholder actions"
    >
      {(disabled || onImageClick) && (
        <button
          type="button"
          disabled={disabled}
          title={title("Insert Picture")}
          aria-label="Insert Picture"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) onImageClick?.();
          }}
        >
          <MdImage />
          <span className="placeholder-upload-badge">
            <MdFileUpload />
          </span>
        </button>
      )}
      {(disabled || onVideoClick) && (
        <button
          type="button"
          disabled={disabled}
          title={title("Insert Video")}
          aria-label="Insert Video"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) onVideoClick?.();
          }}
        >
          <MdVideocam />
          <span className="placeholder-upload-badge">
            <MdFileUpload />
          </span>
        </button>
      )}
    </div>
  );
}

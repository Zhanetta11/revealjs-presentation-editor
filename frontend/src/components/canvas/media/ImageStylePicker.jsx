import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IMAGE_STYLES } from "../../../core/model/imageStyles";
import {
  DEFAULT_VIDEO_PREVIEW_SRC,
  getVideoPosterReference,
} from "../../../core/render/mediaPreview";
import { useMediaSrc } from "../../../hooks/media/useMediaSrc";
import "./ImageStylePicker.css";

const svgSrc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8d8f0"/><stop offset="100%" stop-color="#d6eef8"/></linearGradient><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7bc67e"/><stop offset="100%" stop-color="#4caf50"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a5d6a7"/><stop offset="100%" stop-color="#66bb6a"/></linearGradient></defs><rect width="64" height="48" fill="url(#sky)"/><circle cx="10" cy="11" r="6" fill="#fdd835"/><ellipse cx="28" cy="14" rx="10" ry="6" fill="white" opacity="0.9"/><ellipse cx="38" cy="13" rx="8" ry="5" fill="white" opacity="0.8"/><ellipse cx="20" cy="16" rx="7" ry="4" fill="white" opacity="0.7"/><polygon points="0,48 0,28 12,16 24,26 36,12 52,26 64,18 64,48" fill="url(#g1)"/><polygon points="0,48 0,34 14,24 26,32 40,20 56,30 64,24 64,48" fill="url(#g2)"/></svg>`;
const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(svgSrc)}`;

export default function ImageStylePicker({ media, position, currentStyleId, onPreview, onSelect, onClose }) {
  const ref = useRef(null);
  const isVideo = media?.["media-type"] === "video";
  const resolvedPoster = useMediaSrc(getVideoPosterReference(media));
  const previewSrc = isVideo
    ? resolvedPoster ?? DEFAULT_VIDEO_PREVIEW_SRC
    : PLACEHOLDER;

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="image-style-picker" style={{ top: position.y, left: position.x }} onMouseLeave={() => onPreview?.(null)}>
      <div className="image-style-picker__grid">
        {IMAGE_STYLES.map((style) => {
          const isSelected = (currentStyleId ?? "none") === style.id;
          return (
            <button
              key={style.id}
              className={`image-style-picker__cell${isSelected ? " image-style-picker__cell--selected" : ""}`}
              title={style.label}
              onMouseEnter={() => onPreview?.(style.id)}
              onMouseDown={(e) => { e.stopPropagation(); onSelect(style.id); onClose(); }}
            >
              <div className="image-style-picker__preview-outer" style={style.css}>
                <div className="image-style-picker__preview-inner">
                  <img
                    src={previewSrc}
                    alt={isVideo ? "Video preview" : ""}
                    className="image-style-picker__img"
                    onError={
                      isVideo
                        ? (event) => {
                            event.currentTarget.src = DEFAULT_VIDEO_PREVIEW_SRC;
                          }
                        : undefined
                    }
                  />
                  {isVideo && (
                    <span
                      className="image-style-picker__video-badge"
                      aria-hidden="true"
                    >
                      ▶
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

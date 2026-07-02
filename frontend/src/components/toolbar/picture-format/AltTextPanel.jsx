import { useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdInfoOutline } from "react-icons/md";
import "./AltTextPanel.css";

export default function AltTextPanel({ media, onUpdate, onClose, overlay = false }) {
  const [draft, setDraft] = useState(() => ({
    mediaId: media?.id,
    altText: media?.alt ?? "",
    decorative: media?.decorative ?? false,
  }));
  const altText = draft.mediaId === media?.id ? draft.altText : media?.alt ?? "";
  const decorative = draft.mediaId === media?.id ? draft.decorative : media?.decorative ?? false;

  const commit = () => {
    onUpdate({ alt: decorative ? "" : altText, decorative });
  };

  const content = (
    <div className={`alt-panel${overlay ? " alt-panel--overlay" : ""}`}>
      <div className="alt-panel-header">
        <span className="alt-panel-title">Alt Text</span>
        <button className="alt-panel-close" onClick={onClose}><MdClose /></button>
      </div>

      <div className="alt-panel-body">
        <p className="alt-panel-desc">
          How would you describe this object and its context to someone who is blind or low vision?
        </p>
        <ul className="alt-panel-hints">
          <li>The subject(s) in detail</li>
          <li>The setting</li>
          <li>The actions or interactions</li>
          <li>Other relevant information</li>
        </ul>
        <p className="alt-panel-hint-note">
          <em>(1–2 detailed sentences recommended)</em>
        </p>

        <textarea
          className="alt-panel-textarea"
          value={decorative ? "" : altText}
          disabled={decorative}
          placeholder="Enter a description…"
          onChange={(e) => setDraft({ mediaId: media?.id, altText: e.target.value, decorative })}
          onBlur={commit}
        />

        <label className="alt-panel-decorative">
          <input
            type="checkbox"
            checked={decorative}
            onChange={(e) => {
              setDraft({ mediaId: media?.id, altText, decorative: e.target.checked });
              onUpdate({ decorative: e.target.checked, alt: e.target.checked ? "" : altText });
            }}
          />
          <span>Mark as decorative</span>
          <span className="alt-panel-decorative-info" title="Decorative images are ignored by screen readers">
            <MdInfoOutline />
          </span>
        </label>
      </div>
    </div>
  );

  return overlay ? createPortal(content, document.body) : content;
}

import { useState } from "react";
import { createPortal } from "react-dom";
import "./dialogs.css";

const numberFrom = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseVerticalMargin = (margin) => {
  const values = String(margin ?? "0")
    .match(/-?\d*\.?\d+/g)
    ?.map(Number) ?? [0];
  if (values.length === 1) return { before: values[0], after: values[0] };
  if (values.length === 2) return { before: values[0], after: values[1] };
  return { before: values[0] ?? 0, after: values[2] ?? values[0] ?? 0 };
};

const parseSpecialIndent = (formatting = {}) => {
  const special = formatting["special-indent"];
  const by = numberFrom(formatting["special-indent-by"], 0);

  if (special === "first-line" || special === "hanging") {
    return { special, by: Math.max(0, by) };
  }

  const legacyIndent = numberFrom(formatting["text-indent"], 0);
  if (legacyIndent > 0) {
    return { special: "first-line", by: legacyIndent };
  }
  if (legacyIndent < 0) {
    return { special: "hanging", by: Math.abs(legacyIndent) };
  }

  return { special: "none", by: 0 };
};

const getLineSpacingMode = (value) => {
  const numericValue = numberFrom(value, 1.15);
  if (Math.abs(numericValue - 1) < 0.001) return "single";
  if (Math.abs(numericValue - 1.5) < 0.001) return "one-and-half";
  if (Math.abs(numericValue - 2) < 0.001) return "double";
  return "multiple";
};

const getLineSpacingValueForMode = (mode, fallbackValue) => {
  if (mode === "single") return 1;
  if (mode === "one-and-half") return 1.5;
  if (mode === "double") return 2;
  return numberFrom(fallbackValue, 1.15);
};

export default function ParagraphDialog({ formatting = {}, onApply, onClose }) {
  const marginIsMixed = formatting.margin === "mixed";
  const lineSpacingIsMixed = formatting["line-spacing"] === "mixed";
  const specialIndentIsMixed =
    formatting["special-indent"] === "mixed" ||
    formatting["special-indent-by"] === "mixed" ||
    formatting["text-indent"] === "mixed";
  const beforeTextIsMixed =
    formatting["before-text"] === "mixed" ||
    formatting["indent-level"] === "mixed";
  const spacing = marginIsMixed
    ? { before: "", after: "" }
    : parseVerticalMargin(formatting.margin);
  const specialIndent = specialIndentIsMixed
    ? { special: "mixed", by: "" }
    : parseSpecialIndent(formatting);
  const initialLineSpacing = lineSpacingIsMixed
    ? ""
    : numberFrom(formatting["line-spacing"], 1.15);
  const initialLineSpacingMode = lineSpacingIsMixed
    ? "mixed"
    : getLineSpacingMode(initialLineSpacing);
  const legacyBeforeText =
    formatting["list-type"] && formatting["list-type"] !== "none"
      ? 0
      : Math.max(0, Number(formatting["indent-level"]) || 0) * 24;
  const initialBeforeText = beforeTextIsMixed
    ? ""
    : numberFrom(formatting["before-text"], legacyBeforeText);
  const [alignment, setAlignment] = useState(
    formatting.align ?? "left",
  );
  const [beforeText, setBeforeText] = useState(initialBeforeText);
  const [before, setBefore] = useState(spacing.before);
  const [after, setAfter] = useState(spacing.after);
  const [lineSpacingMode, setLineSpacingMode] = useState(initialLineSpacingMode);
  const [lineSpacing, setLineSpacing] = useState(initialLineSpacing);
  const [special, setSpecial] = useState(specialIndent.special);
  const [specialBy, setSpecialBy] = useState(specialIndent.by);

  const specialIndentEnabled = special !== "none";
  const isCustomLineSpacing = lineSpacingMode === "multiple";

  const handleLineSpacingModeChange = (nextMode) => {
    setLineSpacingMode(nextMode);
    setLineSpacing(getLineSpacingValueForMode(nextMode, lineSpacing));
  };

  const apply = () => {
    const safeSpecialBy = Math.max(0, Number(specialBy) || 0);
    const updates = {};

    if (alignment !== "mixed") updates.align = alignment;
    if (beforeText !== "")
      updates["before-text"] = Math.max(0, Number(beforeText) || 0);
    if (before !== "" && after !== "")
      updates.margin = `${Math.max(0, Number(before) || 0)}px 0 ${Math.max(
        0,
        Number(after) || 0,
      )}px 0`;
    if (lineSpacingMode !== "mixed") {
      const safeLineSpacing = Math.max(
        0.5,
        Number(getLineSpacingValueForMode(lineSpacingMode, lineSpacing)) || 1.15,
      );
      updates["line-spacing"] = String(safeLineSpacing);
    }
    if (special !== "mixed") {
      updates["special-indent"] = specialIndentEnabled ? special : "none";
      updates["special-indent-by"] = specialIndentEnabled ? safeSpecialBy : 0;
      updates["text-indent"] =
        special === "first-line"
          ? `${safeSpecialBy}px`
          : special === "hanging"
            ? `-${safeSpecialBy}px`
            : "0px";
    }

    onApply?.(updates);
    onClose?.();
  };

  return createPortal(
    <div className="text-dialog-backdrop" onMouseDown={onClose}>
      <section
        className="text-context-dialog paragraph-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Paragraph"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="text-context-dialog-header">
          <span>Paragraph</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="paragraph-dialog-section-title">
          Indents and Spacing
        </div>

        <fieldset>
          <legend>General</legend>
          <label>
            <span>Alignment:</span>
            <select
              value={alignment}
              onChange={(event) => setAlignment(event.target.value)}
            >
              {alignment === "mixed" && (
                <option value="mixed" disabled>
                  Mixed
                </option>
              )}
              <option value="left">Left</option>
              <option value="center">Centered</option>
              <option value="right">Right</option>
              <option value="justify">Justified</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Indentation</legend>
          <div className="paragraph-dialog-grid paragraph-dialog-grid--indent">
            <label>
              <span>Before text:</span>
              <input
                type="number"
                min="0"
                step="1"
                value={beforeText}
                onChange={(event) => setBeforeText(event.target.value)}
              />
            </label>
            <label>
              <span>Special:</span>
              <select
                value={special}
                onChange={(event) => setSpecial(event.target.value)}
              >
                {special === "mixed" && (
                  <option value="mixed" disabled>
                    Mixed
                  </option>
                )}
                <option value="none">(none)</option>
                <option value="first-line">First line</option>
                <option value="hanging">Hanging</option>
              </select>
            </label>
            <label
              className={specialIndentEnabled ? undefined : "paragraph-dialog-disabled"}
            >
              <span>By:</span>
              <input
                disabled={!specialIndentEnabled}
                type="number"
                min="0"
                step="1"
                value={specialBy}
                onChange={(event) => setSpecialBy(event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Spacing</legend>
          <div className="paragraph-dialog-grid paragraph-dialog-grid--spacing">
            <label>
              <span>Before:</span>
              <input
                type="number"
                min="0"
                step="1"
                value={before}
                onChange={(event) => setBefore(event.target.value)}
              />
            </label>
            <label>
              <span>Line Spacing:</span>
              <select
                value={lineSpacingMode}
                onChange={(event) => handleLineSpacingModeChange(event.target.value)}
              >
                {lineSpacingMode === "mixed" && (
                  <option value="mixed" disabled>
                    Mixed
                  </option>
                )}
                <option value="single">Single</option>
                <option value="one-and-half">1.5 lines</option>
                <option value="double">Double</option>
                <option value="multiple">Multiple</option>
              </select>
            </label>
            <label>
              <span>After:</span>
              <input
                type="number"
                min="0"
                step="1"
                value={after}
                onChange={(event) => setAfter(event.target.value)}
              />
            </label>
            <label>
              <span>At:</span>
              <input
                disabled={!isCustomLineSpacing}
                type="number"
                min="0.5"
                max="5"
                step="0.05"
                value={lineSpacing}
                onChange={(event) => setLineSpacing(event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <footer className="text-context-dialog-actions">
          <button type="button" className="primary" onClick={apply}>
            OK
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

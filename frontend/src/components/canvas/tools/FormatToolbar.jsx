import { useState } from "react";
import { createPortal } from "react-dom";
import {
  MdAddComment,
  MdBorderColor,
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdFormatColorText,
  MdFormatClear,
  MdFormatIndentDecrease,
  MdFormatIndentIncrease,
  MdFormatPaint,
} from "react-icons/md";
import ColorPicker from "./ColorPicker";
import { getAvailableFonts } from "../../../core/model/fontConfig";
import { parseFormattingForDisplay } from "../../../core/text/textFormatting";
import { MAX_LIST_INDENT_LEVEL } from "../../../core/utils/listUtils";
import "./FormatToolbar.css";

const stop = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

export default function FormatToolbar({
  elementId,
  formatting,
  onFormatTextElement,
  onHighlight,
  onNewComment,
  presentation,
  style,
  hasSelection = false,
  formatPainterClipboard = null,
  onFormatPainterCopy,
  onFormatPainterPaste,
  onFormInputMouseDown,
}) {
  const [lastHighlightColor, setLastHighlightColor] = useState("#ffff00");
  const [justCopied, setJustCopied] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ top: 0, left: 0 });
  const [highlightPickerPos, setHighlightPickerPos] = useState({
    top: 0,
    left: 0,
  });

  const fmt = (updates) => onFormatTextElement(elementId, updates);
  const fonts = getAvailableFonts(presentation);
  const {
    currentSize,
    currentFont,
    currentAlign,
    currentColor,
    currentHighlight,
  } = parseFormattingForDisplay(formatting, fonts[0]);

  const currentIndent =
    formatting["indent-level"] === "mixed"
      ? 0
      : Number(formatting["indent-level"] ?? 0);

  const hasPaste =
    formatPainterClipboard !== null &&
    (formatPainterClipboard.sourceElementId !== elementId || hasSelection);

  const handleFormatPainter = () => {
    if (hasPaste) {
      fmt({ ...formatPainterClipboard.formatting });
      onFormatPainterPaste?.();
      return;
    }

    onFormatPainterCopy?.(
      elementId,
      Object.fromEntries(
        Object.entries(formatting).filter(([, value]) => value !== "mixed"),
      ),
    );
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  };

  const openPicker = (event, picker) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = { top: rect.bottom + 4, left: rect.left };

    if (picker === "highlight") {
      setHighlightPickerPos(position);
      setShowHighlightPicker((visible) => !visible);
      setShowColorPicker(false);
    } else {
      setColorPickerPos(position);
      setShowColorPicker((visible) => !visible);
      setShowHighlightPicker(false);
    }
  };

  const clearFormatting = () =>
    fmt({
      font: null,
      size: null,
      color: null,
      weight: "normal",
      italics: false,
      "text-decoration": "none",
      highlight: null,
      align: null,
      "line-spacing": null,
      "list-type": null,
      "list-style": {},
      "list-marker": null,
      "list-numbered-style": null,
      "indent-level": 0,
      margin: null,
      "vertical-align": null,
      "super-sub-script": "normal",
    });

  return (
    <div
      className="format-toolbar"
      style={style}
      onMouseDown={stop}
      onMouseDownCapture={(event) => {
        const tag = event.target.tagName;
        if (tag !== "SELECT" && tag !== "INPUT" && tag !== "TEXTAREA") {
          event.preventDefault();
        } else {
          onFormInputMouseDown?.();
        }
      }}
      onClick={stop}
    >
      <div className="ft-rows">
        <div className="format-row format-row-top">
          <select
            className="font-select"
            value={currentFont}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              if (event.target.value) fmt({ font: event.target.value });
            }}
            title="Font"
          >
            {currentFont === "" && <option value="">—</option>}
            {fonts.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>

          <input
            className="size-input"
            type="number"
            min={6}
            max={120}
            value={currentSize}
            placeholder="—"
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              if (event.target.value) fmt({ size: `${event.target.value}px` });
            }}
            title="Font size"
          />

          <button
            type="button"
            className="fmt-btn font-size-btn"
            title="Increase font size"
            onClick={() => fmt({ "font-size-delta": 2 })}
          >
            A<sup>+</sup>
          </button>

          <button
            type="button"
            className="fmt-btn font-size-btn"
            title="Decrease font size"
            onClick={() => fmt({ "font-size-delta": -2 })}
          >
            A<sup>−</sup>
          </button>

          <div className="separator" />

          <button
            type="button"
            className="fmt-btn"
            title="Decrease indent"
            disabled={currentIndent <= 0}
            onClick={() =>
              fmt({ "indent-level": Math.max(0, currentIndent - 1) })
            }
          >
            <MdFormatIndentDecrease />
          </button>

          <button
            type="button"
            className="fmt-btn"
            title="Increase indent"
            disabled={currentIndent >= MAX_LIST_INDENT_LEVEL}
            onClick={() =>
              fmt({
                "indent-level": Math.min(
                  MAX_LIST_INDENT_LEVEL,
                  currentIndent + 1,
                ),
              })
            }
          >
            <MdFormatIndentIncrease />
          </button>
        </div>

        <div className="format-row format-row-bottom">
          <button
            type="button"
            className={`fmt-btn bold ${formatting.weight === "bold" ? "active" : ""}`}
            title="Bold"
            onClick={() =>
              fmt({ weight: formatting.weight === "bold" ? "normal" : "bold" })
            }
          >
            B
          </button>

          <button
            type="button"
            className={`fmt-btn italic ${formatting.italics === true ? "active" : ""}`}
            title="Italic"
            onClick={() =>
              fmt({ italics: formatting.italics === true ? false : true })
            }
          >
            I
          </button>

          <button
            type="button"
            className={`fmt-btn underline ${
              formatting["text-decoration"] === "underline" ? "active" : ""
            }`}
            title="Underline"
            onClick={() =>
              fmt({
                "text-decoration":
                  formatting["text-decoration"] === "underline"
                    ? "none"
                    : "underline",
              })
            }
          >
            U
          </button>

          <div className="separator" />

          {[
            ["left", MdFormatAlignLeft],
            ["center", MdFormatAlignCenter],
            ["right", MdFormatAlignRight],
          ].map(([align, Icon]) => (
            <button
              key={align}
              type="button"
              className={`fmt-btn align-btn ${
                currentAlign === align ? "active" : ""
              }`}
              title={`Align ${align}`}
              onClick={() => fmt({ align })}
            >
              <Icon />
            </button>
          ))}

          <div className="separator" />

          <div className="ft-color-container">
            <button
              type="button"
              className="fmt-btn color-btn"
              title="Text highlight color"
              onClick={(event) => openPicker(event, "highlight")}
            >
              <MdBorderColor />
              <span
                className="color-bar"
                style={{ background: lastHighlightColor }}
              />
              <span className="ft-color-arrow">▾</span>
            </button>

            {showHighlightPicker &&
              createPortal(
                <ColorPicker
                  color={
                    currentHighlight === "transparent"
                      ? "#ffff00"
                      : currentHighlight
                  }
                  allowNoColor
                  onNoColor={() => fmt({ highlight: null })}
                  onChange={(color) => {
                    setLastHighlightColor(color);
                    onHighlight
                      ? onHighlight(color)
                      : fmt({ highlight: color });
                  }}
                  onClose={() => setShowHighlightPicker(false)}
                  style={{
                    position: "fixed",
                    top: highlightPickerPos.top,
                    left: highlightPickerPos.left,
                    zIndex: 99999,
                  }}
                />,
                document.body,
              )}
          </div>

          <div className="ft-color-container">
            <button
              type="button"
              className="fmt-btn color-btn"
              title="Font color"
              onClick={(event) => openPicker(event, "font")}
            >
              <MdFormatColorText />
              <span
                className="color-bar"
                style={{ background: currentColor }}
              />
              <span className="ft-color-arrow">▾</span>
            </button>

            {showColorPicker &&
              createPortal(
                <ColorPicker
                  color={currentColor}
                  onChange={(color) => fmt({ color })}
                  onClose={() => setShowColorPicker(false)}
                  style={{
                    position: "fixed",
                    top: colorPickerPos.top,
                    left: colorPickerPos.left,
                    zIndex: 99999,
                  }}
                />,
                document.body,
              )}
          </div>

          <button
            type="button"
            className={`fmt-btn painter-btn ${
              hasPaste ? "painter-paste" : ""
            } ${justCopied ? "painter-copied" : ""}`}
            title={hasPaste ? "Apply copied formatting" : "Format Painter"}
            onClick={handleFormatPainter}
          >
            <MdFormatPaint />
          </button>

          <button
            type="button"
            className="fmt-btn clear-btn"
            title="Clear All Formatting"
            onClick={clearFormatting}
          >
            <MdFormatClear />
          </button>
        </div>
      </div>

      {Boolean(onNewComment) && (
        <>
          <div className="ft-separator-v" />

          <button
            type="button"
            className="ft-new-comment-btn"
            title="New Comment"
            onClick={onNewComment}
          >
            <MdAddComment className="ft-new-comment-icon" />
            <span className="ft-new-comment-label">
              New
              <br />
              Comment
            </span>
          </button>
        </>
      )}
    </div>
  );
}

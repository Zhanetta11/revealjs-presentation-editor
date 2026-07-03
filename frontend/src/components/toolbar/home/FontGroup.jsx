import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdBorderColor,
  MdDeleteOutline,
  MdFormatBold,
  MdFormatClear,
  MdFormatColorText,
  MdFormatItalic,
  MdFormatStrikethrough,
  MdFormatUnderlined,
  MdFontDownload,
} from "react-icons/md";
import ColorPicker from "../../canvas/tools/ColorPicker";
import { confirmDialog } from "../../../core/platform/dialogs";
import "./FontGroup.css";

const SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96,
];

function SizePicker({ value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value === "" ? "" : String(value));
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current
      .querySelector(".sz-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const commit = (valueToCommit) => {
    const number = parseInt(valueToCommit, 10);
    if (number >= 1 && number <= 400) onChange(number);
    setOpen(false);
  };

  return (
    <div className="sz-picker" ref={wrapRef}>
      <input
        className="toolbar-size"
        type="text"
        disabled={disabled}
        value={inputVal}
        onChange={(event) => setInputVal(event.target.value)}
        onFocus={() => {
          const rect = wrapRef.current?.getBoundingClientRect();
          if (rect) {
            setDropPos({
              top: rect.bottom + 2,
              left: rect.left,
              width: rect.width,
            });
          }
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(inputVal);
            event.target.blur();
          }
          if (event.key === "Escape") {
            setOpen(false);
            event.target.blur();
          }
        }}
        onBlur={(event) => {
          if (!wrapRef.current?.contains(event.relatedTarget)) commit(inputVal);
        }}
      />
      <span className="sz-picker-arrow">▾</span>
      {open && (
        <ul
          className="sz-dropdown"
          ref={listRef}
          onMouseDown={(event) => event.preventDefault()}
          style={{
            top: dropPos.top,
            left: dropPos.left,
            minWidth: dropPos.width,
          }}
        >
          {SIZES.map((size) => (
            <li
              key={size}
              className={`sz-item${
                String(size) === String(value) ? " sz-active" : ""
              }`}
              onClick={() => {
                setInputVal(String(size));
                commit(size);
              }}
            >
              {size}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ColorCommand({
  disabled,
  title,
  color,
  icon,
  onChange,
  allowNoColor = false,
  onNoColor,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  return (
    <div className="font-color-wrap">
      <button
        type="button"
        className={`font-command font-color-command ${className}`}
        disabled={disabled}
        title={title}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({ top: rect.bottom + 4, left: rect.left });
          setOpen((visible) => !visible);
        }}
      >
        {icon}
        <span className="font-color-bar" style={{ background: color }} />
        <span className="font-command-arrow">▾</span>
      </button>

      {open &&
        createPortal(
          <ColorPicker
            color={color}
            allowNoColor={allowNoColor}
            onNoColor={onNoColor}
            onChange={onChange}
            onClose={() => setOpen(false)}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: 99999,
            }}
          />,
          document.body,
        )}
    </div>
  );
}

export default function FontGroup({
  currentFormatting = {},
  isTextSelected = false,
  fonts = [],
  presentation,
  onFormatChange,
  onChangeCase,
  onFontUpload,
  onFontRemove,
}) {
  const [showCaseMenu, setShowCaseMenu] = useState(false);
  const [fontUpload, setFontUpload] = useState({
    loading: false,
    error: "",
  });
  const caseRef = useRef(null);
  const fontInputRef = useRef(null);

  useEffect(() => {
    if (!showCaseMenu) return;
    const close = (event) => {
      if (!caseRef.current?.contains(event.target)) setShowCaseMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showCaseMenu]);

  const fmt = (updates) => {
    if (isTextSelected && onFormatChange) onFormatChange(updates);
  };

  const currentFont =
    currentFormatting.font === "mixed"
      ? ""
      : (currentFormatting.font ?? fonts[0] ?? "Arial");
  const currentSize =
    currentFormatting.size === "mixed"
      ? ""
      : parseInt(currentFormatting.size ?? "28", 10);
  const isBold =
    currentFormatting.weight === "bold" || currentFormatting.weight === true;
  const isItalic =
    currentFormatting.italics === true ||
    currentFormatting.italics === "italic";
  const decoration = currentFormatting["text-decoration"] ?? "none";
  const isUnderline = decoration.includes("underline");
  const isStrikethrough = decoration.includes("line-through");
  const currentColor =
    currentFormatting.color === "mixed"
      ? "#111111"
      : (currentFormatting.color ?? "#111111");
  const currentHighlight =
    currentFormatting.highlight === "mixed" ||
    !currentFormatting.highlight ||
    currentFormatting.highlight === "transparent"
      ? "#fff200"
      : currentFormatting.highlight;
  const uploadedFontIds = new Set(
    (presentation?.slideset?.fonts ?? [])
      .filter((font) => font["font-id"] && font["font-file"])
      .map((font) => font["font-id"]),
  );
  const canRemoveCurrentFont =
    Boolean(onFontRemove) && uploadedFontIds.has(currentFont);

  const toggleDecoration = (name, active) => {
    const values = new Set(
      decoration === "none" ? [] : decoration.split(/\s+/).filter(Boolean),
    );
    if (active) values.delete(name);
    else values.add(name);
    fmt({
      "text-decoration": values.size > 0 ? [...values].join(" ") : "none",
    });
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
      "super-sub-script": null,
    });

  const uploadFont = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !onFontUpload) return;

    setFontUpload({ loading: true, error: "" });
    let lastName = null;
    try {
      for (const file of files) {
        const fontName = file.name
          .replace(/\.(ttf|otf|woff2?)$/i, "")
          .replace(/[_-]+/g, " ")
          .trim();
        if (!fontName) continue;
        await onFontUpload(fontName, file);
        lastName = fontName;
      }
      if (isTextSelected && lastName) fmt({ font: lastName });
      setFontUpload({ loading: false, error: "" });
    } catch (error) {
      console.error("[FontGroup] Failed to upload font:", error);
      setFontUpload({ loading: false, error: "One or more fonts could not be loaded." });
    }
  };

  const removeCurrentFont = async () => {
    if (!canRemoveCurrentFont) return;
    const confirmed = await confirmDialog(
      "Remove Font",
      `Remove the uploaded font "${currentFont}"?`,
    );
    if (!confirmed) return;

    onFontRemove(currentFont);
    if (isTextSelected) fmt({ font: "Arial" });
  };

  return (
    <div className="ribbon-group font-group">
      <div className="font-row font-row-top">
        <select
          className="toolbar-select"
          disabled={!isTextSelected}
          value={currentFont}
          onChange={(event) => {
            if (event.target.value) fmt({ font: event.target.value });
          }}
        >
          {/* Also cover a font value that's not in the list (e.g. text still
              referencing a removed uploaded font): without a matching option
              the controlled select gets stuck and stops firing onChange. */}
          {!fonts.includes(currentFont) && (
            <option value={currentFont}>{currentFont || "—"}</option>
          )}
          {fonts.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>

        <SizePicker
          key={currentSize}
          value={currentSize}
          disabled={!isTextSelected}
          onChange={(size) => fmt({ size: `${size}px` })}
        />

        <button
          className="font-command font-size-command"
          disabled={!isTextSelected}
          title="Increase font size"
          onClick={() => fmt({ "font-size-delta": 2 })}
        >
          A<sup>+</sup>
        </button>
        <button
          className="font-command font-size-command"
          disabled={!isTextSelected}
          title="Decrease font size"
          onClick={() => fmt({ "font-size-delta": -2 })}
        >
          A<sup>−</sup>
        </button>
        <button
          type="button"
          className="font-command font-upload-command"
          disabled={!onFontUpload || fontUpload.loading}
          title={
            fontUpload.error ||
            (fontUpload.loading ? "Loading font..." : "Upload font family")
          }
          onClick={() => fontInputRef.current?.click()}
        >
          <MdFontDownload />
        </button>
        <button
          type="button"
          className="font-command font-remove-command"
          disabled={!canRemoveCurrentFont}
          title={
            canRemoveCurrentFont
              ? `Remove uploaded font "${currentFont}"`
              : "Select an uploaded font to remove it"
          }
          aria-label="Remove uploaded font"
          onClick={removeCurrentFont}
        >
          <MdDeleteOutline />
        </button>
        <input
          ref={fontInputRef}
          className="font-upload-input"
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          multiple
          onChange={uploadFont}
        />
      </div>

      <div className="font-row font-row-bottom">
        <button
          className={`font-command${isBold ? " active" : ""}`}
          disabled={!isTextSelected}
          title="Bold"
          onClick={() => fmt({ weight: isBold ? "normal" : "bold" })}
        >
          <MdFormatBold />
        </button>
        <button
          className={`font-command${isItalic ? " active" : ""}`}
          disabled={!isTextSelected}
          title="Italic"
          onClick={() => fmt({ italics: !isItalic })}
        >
          <MdFormatItalic />
        </button>
        <button
          className={`font-command${isUnderline ? " active" : ""}`}
          disabled={!isTextSelected}
          title="Underline"
          onClick={() => toggleDecoration("underline", isUnderline)}
        >
          <MdFormatUnderlined />
        </button>
        <button
          className={`font-command${isStrikethrough ? " active" : ""}`}
          disabled={!isTextSelected}
          title="Strikethrough"
          onClick={() => toggleDecoration("line-through", isStrikethrough)}
        >
          <MdFormatStrikethrough />
        </button>
        <button
          className="font-command"
          disabled={!isTextSelected}
          title="Clear all formatting"
          onClick={clearFormatting}
        >
          <MdFormatClear />
        </button>

        <div className="font-case-wrap" ref={caseRef}>
          <button
            className="font-command font-case-command"
            disabled={!isTextSelected}
            title="Change case"
            onClick={() => setShowCaseMenu((open) => !open)}
          >
            Aa <span className="toolbar-dropdown-mark">▾</span>
          </button>
          {showCaseMenu && (
            <div className="font-case-menu">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeCase?.("sentence");
                  setShowCaseMenu(false);
                }}
              >
                Sentence case
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeCase?.("lower");
                  setShowCaseMenu(false);
                }}
              >
                lowercase
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeCase?.("upper");
                  setShowCaseMenu(false);
                }}
              >
                UPPERCASE
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeCase?.("title");
                  setShowCaseMenu(false);
                }}
              >
                Capitalize Each Word
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChangeCase?.("toggle");
                  setShowCaseMenu(false);
                }}
              >
                tOGGLE cASE
              </button>
            </div>
          )}
        </div>

        <ColorCommand
          disabled={!isTextSelected}
          title="Text highlight color"
          color={currentHighlight}
          icon={<MdBorderColor />}
          onChange={(color) => fmt({ highlight: color })}
          allowNoColor
          onNoColor={() => fmt({ highlight: null })}
        />
        <ColorCommand
          disabled={!isTextSelected}
          title="Font color"
          color={currentColor}
          icon={<MdFormatColorText />}
          onChange={(color) => fmt({ color })}
        />
      </div>

      <div className="ribbon-group-title">Font</div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  MdFormatAlignLeft,
  MdFormatAlignCenter,
  MdFormatAlignRight,
  MdFormatAlignJustify,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatIndentDecrease,
  MdFormatIndentIncrease,
  MdFormatLineSpacing,
  MdVerticalAlignTop,
  MdVerticalAlignCenter,
  MdVerticalAlignBottom,
} from "react-icons/md";
import { BULLET_STYLES, NUMBERED_STYLES } from "./homeTabConstants";
import {
  getListMarker,
  MAX_LIST_INDENT_LEVEL,
} from "../../../core/utils/listUtils";
import "./ParagraphGroup.css";

const LINE_SPACING_PRESETS = ["1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

function parseMargin(margin) {
  if (!margin) return { before: 0, after: 0 };
  const parts = String(margin).trim().split(/\s+/);
  const v = (s) => parseFloat(s) || 0;
  if (parts.length <= 2) return { before: v(parts[0]), after: v(parts[0]) };
  return { before: v(parts[0]), after: v(parts[2]) };
}

export default function ParagraphGroup({
  currentFormatting = {},
  isTextSelected = false,
  onFormatChange,
}) {
  const [showBulletPicker, setShowBulletPicker] = useState(false);
  const [showNumberedPicker, setShowNumberedPicker] = useState(false);
  const [showLineSpacing, setShowLineSpacing] = useState(false);
  const [showSpacingOptions, setShowSpacingOptions] = useState(false);
  const [showAlignText, setShowAlignText] = useState(false);
  const bulletPickerRef = useRef(null);
  const numberedPickerRef = useRef(null);
  const lineSpacingRef = useRef(null);
  const alignTextRef = useRef(null);

  const fmt = (updates) => {
    if (!isTextSelected || !onFormatChange) return;
    onFormatChange(updates);
  };

  const currentAlign = currentFormatting.align ?? "left";
  const currentListType = currentFormatting["list-type"] ?? null;
  const currentListLevel = currentFormatting["indent-level"] ?? 0;
  const currentLineSpacing = String(currentFormatting["line-spacing"] ?? "1.0");
  const { before, after } = parseMargin(currentFormatting.margin);
  const currentVerticalAlign = currentFormatting["vertical-align"] ?? "top";

  useEffect(() => {
    if (!showBulletPicker && !showNumberedPicker && !showLineSpacing && !showAlignText) return;
    const handleClick = (e) => {
      if (bulletPickerRef.current && !bulletPickerRef.current.contains(e.target))
        setShowBulletPicker(false);
      if (numberedPickerRef.current && !numberedPickerRef.current.contains(e.target))
        setShowNumberedPicker(false);
      if (lineSpacingRef.current && !lineSpacingRef.current.contains(e.target)) {
        setShowLineSpacing(false);
        setShowSpacingOptions(false);
      }
      if (alignTextRef.current && !alignTextRef.current.contains(e.target))
        setShowAlignText(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBulletPicker, showNumberedPicker, showLineSpacing, showAlignText]);

  return (
    <div className="ribbon-group paragraph-group">
      <div className="font-row paragraph-row paragraph-row--lists">
        {/* Bullets split-button */}
        <div className="list-split-btn" ref={bulletPickerRef}>
          <button
            className={`small-format${currentListType === "bullets" ? " active" : ""}`}
            disabled={!isTextSelected}
            title="Bulleted list"
            onClick={() =>
              fmt({
                "list-type": currentListType === "bullets" ? "none" : "bullets",
                "list-marker":
                  currentListType === "bullets"
                    ? null
                    : (currentFormatting["list-marker"] ?? "•"),
                "indent-level": 0,
              })
            }
          >
            <MdFormatListBulleted />
          </button>
          <button
            className="list-split-arrow"
            disabled={!isTextSelected}
            title="Bullet styles"
            onClick={() => {
              setShowBulletPicker((v) => !v);
              setShowNumberedPicker(false);
            }}
          >
            ▾
          </button>
          {showBulletPicker && (
            <div className="list-picker-popup">
              <div className="list-picker-grid">
                {BULLET_STYLES.map(({ marker, label }) => (
                  <button
                    key={label}
                    className={`list-picker-cell${
                      (currentFormatting["list-marker"] ?? "•") === marker &&
                      currentListType === "bullets"
                        ? " selected"
                        : ""
                    }`}
                    title={label}
                    onClick={() => {
                      fmt(
                        marker === null
                          ? { "list-type": "none", "list-marker": null, "indent-level": 0 }
                          : { "list-type": "bullets", "list-marker": marker, "indent-level": currentListLevel },
                      );
                      setShowBulletPicker(false);
                    }}
                  >
                    {marker === null ? (
                      <span className="list-picker-none">None</span>
                    ) : (
                      <span className="list-picker-preview">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="list-picker-row">
                            <span className="list-picker-marker">{marker}</span>
                            <span className="list-picker-line" />
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="list-split-btn" ref={numberedPickerRef}>
          <button
            className={`small-format${currentListType === "numbered" ? " active" : ""}`}
            disabled={!isTextSelected}
            title="Numbered list"
            onClick={() =>
              fmt({
                "list-type": currentListType === "numbered" ? "none" : "numbered",
                "list-numbered-style":
                  currentListType === "numbered"
                    ? null
                    : (currentFormatting["list-numbered-style"] ?? "decimal"),
                "indent-level": 0,
              })
            }
          >
            <MdFormatListNumbered />
          </button>
          <button
            className="list-split-arrow"
            disabled={!isTextSelected}
            title="Numbering styles"
            onClick={() => {
              setShowNumberedPicker((v) => !v);
              setShowBulletPicker(false);
            }}
          >
            ▾
          </button>
          {showNumberedPicker && (
            <div className="list-picker-popup">
              <div className="list-picker-grid list-picker-grid--numbered">
                {NUMBERED_STYLES.map(({ style, label }) => (
                  <button
                    key={label}
                    className={`list-picker-cell${
                      (currentFormatting["list-numbered-style"] ?? "decimal") === style &&
                      currentListType === "numbered"
                        ? " selected"
                        : ""
                    }`}
                    title={label}
                    onClick={() => {
                      fmt(
                        style === null
                          ? { "list-type": "none", "list-numbered-style": null, "indent-level": 0 }
                          : { "list-type": "numbered", "list-numbered-style": style, "indent-level": currentListLevel },
                      );
                      setShowNumberedPicker(false);
                    }}
                  >
                    {style === null ? (
                      <span className="list-picker-none">None</span>
                    ) : (
                      <span className="list-picker-preview">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="list-picker-row">
                            <span className="list-picker-marker" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {getListMarker(i, "numbered", null, style)}
                            </span>
                            <span className="list-picker-line" />
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className="small-format"
          disabled={!isTextSelected || currentListLevel <= 0}
          title="Decrease indent"
          onClick={() => fmt({ "indent-level": Math.max(0, currentListLevel - 1) })}
        >
          <MdFormatIndentDecrease />
        </button>
        <button
          className="small-format"
          disabled={!isTextSelected || currentListLevel >= MAX_LIST_INDENT_LEVEL}
          title="Increase indent"
          onClick={() => fmt({ "indent-level": Math.min(MAX_LIST_INDENT_LEVEL, currentListLevel + 1) })}
        >
          <MdFormatIndentIncrease />
        </button>

        {/* Line spacing split-button */}
        <div className="list-split-btn ls-split-btn" ref={lineSpacingRef}>
          <button
            className="small-format"
            disabled={!isTextSelected}
            title="Line spacing"
            onClick={() => { setShowLineSpacing((v) => !v); setShowSpacingOptions(false); }}
          >
            <MdFormatLineSpacing />
          </button>
          <button
            className="list-split-arrow"
            disabled={!isTextSelected}
            title="Line spacing options"
            onClick={() => { setShowLineSpacing((v) => !v); setShowSpacingOptions(false); }}
          >
            ▾
          </button>

          {showLineSpacing && !showSpacingOptions && (
            <div className="list-picker-popup ls-popup">
              {LINE_SPACING_PRESETS.map((val) => (
                <button
                  key={val}
                  className={`ls-preset-item${currentLineSpacing === val ? " selected" : ""}`}
                  onClick={() => { fmt({ "line-spacing": val }); setShowLineSpacing(false); }}
                >
                  {val}
                </button>
              ))}
              <div className="ls-popup-divider" />
              <button
                className="ls-options-link"
                onClick={() => setShowSpacingOptions(true)}
              >
                Line Spacing Options...
              </button>
            </div>
          )}

          {showLineSpacing && showSpacingOptions && (
            <div className="list-picker-popup ls-options-popup">
              <div className="ls-options-title">Paragraph Spacing</div>
              <div className="ls-options-row">
                <label className="ls-options-label">
                  <span>Line spacing</span>
                  <select
                    className="ls-options-select"
                    value={currentLineSpacing}
                    onChange={(e) => fmt({ "line-spacing": e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {LINE_SPACING_PRESETS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ls-options-row">
                <label className="ls-options-label">
                  <span>Before</span>
                  <input
                    type="number" min={0} max={200} step={2}
                    className="ls-options-input"
                    value={before}
                    onChange={(e) => fmt({ margin: `${Number(e.target.value)}px 0 ${after}px 0` })}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <span className="ls-options-unit">pt</span>
                </label>
              </div>
              <div className="ls-options-row">
                <label className="ls-options-label">
                  <span>After</span>
                  <input
                    type="number" min={0} max={200} step={2}
                    className="ls-options-input"
                    value={after}
                    onChange={(e) => fmt({ margin: `${before}px 0 ${Number(e.target.value)}px 0` })}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <span className="ls-options-unit">pt</span>
                </label>
              </div>
              <div className="ls-options-footer">
                <button className="ls-options-ok" onClick={() => { setShowLineSpacing(false); setShowSpacingOptions(false); }}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="font-row paragraph-row paragraph-row--alignment">
        {["left", "center", "right", "justify"].map((align) => (
          <button
            key={align}
            className={`small-format${currentAlign === align ? " active" : ""}`}
            disabled={!isTextSelected}
            title={`Align ${align}`}
            onClick={() => fmt({ align })}
          >
            {align === "left" && <MdFormatAlignLeft />}
            {align === "center" && <MdFormatAlignCenter />}
            {align === "right" && <MdFormatAlignRight />}
            {align === "justify" && <MdFormatAlignJustify />}
          </button>
        ))}

        {/* Align Text (vertical) */}
        <div className="list-split-btn ls-split-btn" ref={alignTextRef}>
          <button
            className="small-format"
            disabled={!isTextSelected}
            title="Align Text"
            onClick={() => setShowAlignText(v => !v)}
          >
            {currentVerticalAlign === "bottom" ? <MdVerticalAlignBottom /> :
             currentVerticalAlign === "middle" ? <MdVerticalAlignCenter /> :
             <MdVerticalAlignTop />}
          </button>
          <button
            className="list-split-arrow"
            disabled={!isTextSelected}
            onClick={() => setShowAlignText(v => !v)}
          >▾</button>

          {showAlignText && (
            <div className="list-picker-popup ls-popup">
              {[
                { value: "top", label: "Top", Icon: MdVerticalAlignTop },
                { value: "middle", label: "Middle", Icon: MdVerticalAlignCenter },
                { value: "bottom", label: "Bottom", Icon: MdVerticalAlignBottom },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  className={`ls-preset-item align-text-item${currentVerticalAlign === value ? " selected" : ""}`}
                  onClick={() => { fmt({ "vertical-align": value }); setShowAlignText(false); }}
                >
                  <Icon style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Overflow */}
      </div>

      <div className="ribbon-group-title">Paragraph</div>
    </div>
  );
}

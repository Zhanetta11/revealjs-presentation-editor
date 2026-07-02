import { useState, useRef, useEffect } from "react";
import "./SlideMasterView.css";
import { buildColorThemeStyle, buildTextElementStyle } from "../../core/render/revealRenderer";
import SlideDecorations from "../canvas/SlideDecorations";
import EditorCanvas from "../editor/EditorCanvas";
import { ColorsDropdown } from "../toolbar/design/ColorsDropdown";
import { DESIGN_THEMES, findActiveTheme, applyColorSchemeToDesign, updateThemeBackgroundFromScheme } from "../../core/model/designThemes";
import { SLIDE_SIZES } from "../../core/model/slideSizes";
import { getAvailableFonts } from "../../core/model/fontConfig";
import { renderShapes } from "../../core/render/shapeRenderer";
import { hasTitle, hasFooters } from "../../core/operations/masterOperations";
import { createPlaceholderPseudoElement } from "../../core/operations/layoutOperations";
import { paragraphsToHTML } from "../../core/text/textFormatting";
import { getPlaceholderBackground, getPlaceholderPadding } from "../../core/render/slidesetRenderUtils";


function ThemeThumbnailMini({ theme, isActive, onClick }) {
  const { bg, header, dots } = theme.preview;
  return (
    <button
      className={`sm-theme-thumb${isActive ? " active" : ""}`}
      onClick={() => onClick(theme)}
      title={theme.name}
    >
      <div className="sm-thumb-slide" style={{ background: bg }}>
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}
          viewBox="0 0 1280 720" preserveAspectRatio="none">
          {renderShapes(theme.decorations?.shapes ?? [])}
        </svg>
        <div className="sm-thumb-header" style={{ background: header }} />
        <div className="sm-thumb-lines">
          <div className="sm-thumb-line" style={{ background: header + "66", width: "65%" }} />
          <div className="sm-thumb-line" style={{ background: header + "44", width: "45%" }} />
        </div>
        <div className="sm-thumb-dots">
          {dots.map((color, i) => (
            <span key={i} className="sm-thumb-dot" style={{ background: color }} />
          ))}
        </div>
      </div>
      <span className="sm-thumb-label">{theme.name}</span>
    </button>
  );
}

function ThemesDropdown({ presentation, onApplyTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
  const activeTheme = findActiveTheme(currentTheme);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn, true);
    return () => document.removeEventListener("mousedown", fn, true);
  }, []);

  const active = activeTheme ?? DESIGN_THEMES[0];
  const { bg, header, dots } = active.preview;

  return (
    <div className="sm-themes-wrap" ref={ref}>
      <button
        className={`master-ribbon-btn master-ribbon-btn--large sm-themes-btn${open ? " open" : ""}`}
        onClick={() => setOpen(v => !v)}
        title="Themes"
      >
        <div className="sm-themes-preview" style={{ background: bg }}>
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}
            viewBox="0 0 1280 720" preserveAspectRatio="none">
            {renderShapes(active.decorations?.shapes ?? [])}
          </svg>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", background: header, zIndex: 1 }} />
          <div style={{ position: "absolute", bottom: 4, left: 4, display: "flex", gap: 2, zIndex: 1 }}>
            {dots.map((c, i) => (
              <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: c, display: "inline-block" }} />
            ))}
          </div>
        </div>
        <span>Themes<br />▾</span>
      </button>

      {open && (
        <div className="sm-themes-dropdown">
          <div className="sm-themes-dropdown-title">This Presentation</div>
          {activeTheme && (
            <div className="sm-themes-section">
              <ThemeThumbnailMini
                theme={activeTheme}
                isActive={true}
                onClick={(t) => { onApplyTheme(t.colorTheme, t.decorations); setOpen(false); }}
              />
            </div>
          )}
          <div className="sm-themes-dropdown-title" style={{ marginTop: 8 }}>All Themes</div>
          <div className="sm-themes-grid">
            {DESIGN_THEMES.map((theme) => (
              <ThemeThumbnailMini
                key={theme.id}
                theme={theme}
                isActive={theme.id === activeTheme?.id}
                onClick={(t) => { onApplyTheme(t.colorTheme, t.decorations); setOpen(false); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function SlideSizeDropdown({ presentation, onUpdateDimensions }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef(null);

  const currentW = presentation?.slideset?.master?.["slide-dimensions"]?.width ?? 1280;
  const currentH = presentation?.slideset?.master?.["slide-dimensions"]?.height ?? 720;
  const [customW, setCustomW] = useState(currentW);
  const [customH, setCustomH] = useState(currentH);

  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", fn, true);
    return () => document.removeEventListener("mousedown", fn, true);
  }, []);

  const applyCustom = () => {
    onUpdateDimensions({ width: customW, height: customH }, "custom", "px");
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <div className="sm-themes-wrap" ref={ref}>
      <button
        className={`master-ribbon-btn master-ribbon-btn--large sm-themes-btn${open ? " open" : ""}`}
        onClick={() => { setOpen(v => !v); setShowCustom(false); }}
        title="Slide Size"
      >
        <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
          <rect x="0.5" y="0.5" width="31" height="21" rx="1.5" stroke="#4472c4" strokeWidth="1.2" fill="#dce6f4" />
          <line x1="0.5" y1="4.5" x2="31.5" y2="4.5" stroke="#4472c4" strokeWidth="0.8" />
        </svg>
        <span>Slide<br />Size ▾</span>
      </button>

      {open && (
        <div className="sm-themes-dropdown" style={{ minWidth: 220 }}>
          {SLIDE_SIZES.map((size) => {
            const isActive = size.width === currentW && size.height === currentH;
            return (
              <button
                key={size.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", background: isActive ? "#eef1f6" : "none",
                  border: "none", padding: "8px 12px", cursor: "pointer",
                  borderRadius: 3, fontFamily: "inherit", textAlign: "left",
                }}
                onClick={() => {
                  onUpdateDimensions({ width: size.width, height: size.height }, size.aspectRatio, "px");
                  setOpen(false);
                }}
              >
                <svg width={size.aspectRatio === "16:9" ? 26 : 20} height={16} viewBox={size.aspectRatio === "16:9" ? "0 0 26 16" : "0 0 20 16"} fill="none" style={{ flexShrink: 0 }}>
                  <rect x="0.5" y="0.5" width={size.aspectRatio === "16:9" ? 25 : 19} height="15" rx="1" stroke="#888" strokeWidth="1" fill="#f8f8f8" />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: "#222" }}>{size.label}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>{size.width} × {size.height} px</span>
                </div>
                {isActive && <span style={{ marginLeft: "auto", color: "#4472c4", fontSize: 14 }}>✓</span>}
              </button>
            );
          })}

          <div style={{ borderTop: "1px solid #e0e0e0", marginTop: 4 }}>
            <button
              className="slide-size-option slide-size-custom-btn"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                width: "100%", border: "none", padding: "8px 10px", cursor: "pointer",
                borderRadius: 3, fontFamily: "inherit", fontSize: 12,
                color: "#4472c4", background: "none",
              }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => setShowCustom(v => !v)}
            >
              ⚙ Custom Slide Size...
            </button>

            {showCustom && (
              <div className="slide-size-custom-form" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="slide-size-custom-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span>Width (px)</span>
                  <input type="number" value={customW} min={100} max={9999}
                    onChange={(e) => setCustomW(e.target.value)}
                    className="slide-size-custom-input"
                    style={{ width: 70, fontSize: 12, padding: "2px 4px", border: "1px solid #ccc", borderRadius: 3 }} />
                </label>
                <label className="slide-size-custom-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span>Height (px)</span>
                  <input type="number" value={customH} min={100} max={9999}
                    onChange={(e) => setCustomH(e.target.value)}
                    className="slide-size-custom-input"
                    style={{ width: 70, fontSize: 12, padding: "2px 4px", border: "1px solid #ccc", borderRadius: 3 }} />
                </label>
                <button
                  onClick={applyCustom}
                  style={{
                    padding: "4px 8px", fontSize: 12, background: "#4472c4", color: "#fff",
                    border: "none", borderRadius: 3, cursor: "pointer", alignSelf: "flex-end",
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function MasterThumb({ label, isSelected, onClick, presentation, layout, isMaster }) {
  const containerRef = useRef(null);
  const [thumbW, setThumbW] = useState(isMaster ? 160 : 140);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setThumbW(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const colorThemeStyle = buildColorThemeStyle(presentation);
  const dims = presentation?.slideset?.master?.["slide-dimensions"];
  const width = dims?.width ?? 1280;
  const height = dims?.height ?? 720;
  const scale = thumbW / width;
  const thumbH = Math.round(height * scale);
  const bgColor = presentation?.slideset?.master?.["color-theme"]
    ?.find((e) => e["css-variable-name"] === "bg-light")?.color ?? "#fff";

  return (
    <div
      className={`master-thumb-wrap${isSelected ? " selected" : ""}${isMaster ? " is-master" : " is-layout"}`}
      onClick={onClick}
    >
      <div ref={containerRef} className="master-thumb-frame" style={{ ...colorThemeStyle, width: "100%", height: thumbH }}>
        <div style={{
          position: "relative", width, height,
          transform: `scale(${scale})`, transformOrigin: "top left",
          background: bgColor, overflow: "hidden",
        }}>
          <SlideDecorations presentation={presentation} width={width} height={height} layoutId={layout?.["layout-id"]} />
          {(layout?.placeholders ?? []).map((ph, i) => {
            const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
            const phFmt = ph.formatting ?? {};
            if (ph.type !== "text") {
              return (
                <div key={i} style={{
                  position: "absolute",
                  left: ph.position?.x ?? 0,
                  top: ph.position?.y ?? 0,
                  width: ph.width,
                  height: ph.height,
                  border: "1px dashed rgba(80,80,80,0.4)",
                  boxSizing: "border-box",
                  background: "rgba(200,200,200,0.15)",
                }} />
              );
            }
            const pseudoEl = createPlaceholderPseudoElement(ph);
            const pseudoSlide = { "layout-id": layout?.["layout-id"] };
            const placeholderBackground = getPlaceholderBackground(presentation, pseudoSlide, pseudoEl);
            const placeholderPadding = getPlaceholderPadding(presentation, pseudoSlide, pseudoEl);
            const elStyle = buildTextElementStyle(pseudoEl, i, masterFormatting, phFmt, placeholderPadding, placeholderBackground);
            const html = paragraphsToHTML(pseudoEl.paragraphs, masterFormatting, phFmt, true);
            return (
              <div
                key={i}
                style={{ ...elStyle, outline: "1px dashed rgba(80,80,80,0.4)" }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          })}
        </div>
      </div>
      <span className="master-thumb-label">
        {isMaster ? label : (layout?.name ?? layout?.["layout-id"] ?? label)}
      </span>
    </div>
  );
}

export function SlideMasterRibbon({
  onClose, presentation, onApplyTheme, onApplyFont, onUpdateDimensions,
  masterName, onRenameMaster, selectedMasterLayoutId, onInsertLayout, onRenameLayout,
  onDeleteLayout,
  onAddTextElement, onImageUpload, onVideoUpload,
  onAddContentPlaceholder,
  onToggleTitle, onToggleFooters,
}) {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [renaming, setRenaming] = useState(false);
  const [showPlaceholderMenu, setShowPlaceholderMenu] = useState(false);
  const [placeholderMenuPosition, setPlaceholderMenuPosition] = useState({ top: 80, left: 0 });
  const placeholderBtnRef = useRef(null);
  const placeholderMenuRef = useRef(null);

  const colorTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
  const currentFont = presentation?.slideset?.master?.formatting?.font ?? "Arial";
  const isRenamingLayout = !!selectedMasterLayoutId;
  const selectedLayout = selectedMasterLayoutId
    ? (presentation?.slideset?.layouts ?? []).find((l) => l["layout-id"] === selectedMasterLayoutId)
    : null;

  const titleVisible = hasTitle(presentation, selectedMasterLayoutId ?? null);
  const footersVisible = hasFooters(presentation, selectedMasterLayoutId ?? null);

  const handleToggleTitle = () => onToggleTitle?.(selectedMasterLayoutId ?? null);
  const handleToggleFooters = () => onToggleFooters?.(selectedMasterLayoutId ?? null);
  const currentName = isRenamingLayout
    ? (selectedLayout?.name ?? selectedMasterLayoutId)
    : (masterName ?? "Office Theme");
  const [nameVal, setNameVal] = useState(currentName);

  const commitRename = () => {
    setRenaming(false);
    if (isRenamingLayout) {
      onRenameLayout?.(selectedMasterLayoutId, nameVal);
    } else {
      onRenameMaster?.(nameVal);
    }
  };

  useEffect(() => {
    if (!showPlaceholderMenu) return;
    const handler = (e) => {
      if (
        placeholderBtnRef.current && !placeholderBtnRef.current.contains(e.target) &&
        placeholderMenuRef.current && !placeholderMenuRef.current.contains(e.target)
      ) {
        setShowPlaceholderMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlaceholderMenu]);

  const handleInsertPlaceholder = (type) => {
    setShowPlaceholderMenu(false);
    if (type === "text") {
      onAddTextElement?.();
    } else if (type === "content") {
      onAddContentPlaceholder?.();
    } else if (type === "image") {
      imageInputRef.current?.click();
    } else if (type === "video") {
      videoInputRef.current?.click();
    }
  };

  return (
    <>
      <div className="slide-master-ribbon">

        <div className="ribbon-group master-ribbon-group">
          <div className="master-ribbon-row">
            <button className="master-ribbon-btn master-ribbon-btn--large" onClick={onInsertLayout}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="4" width="28" height="22" rx="2" stroke="#4472c4" strokeWidth="1.2" fill="#f0f4fc" />
                <rect x="5" y="7" width="22" height="6" rx="1" fill="#dce6f4" stroke="#4472c4" strokeWidth="0.7" />
                <line x1="16" y1="17" x2="16" y2="23" stroke="#4472c4" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="13" y1="20" x2="19" y2="20" stroke="#4472c4" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>Insert<br />Layout</span>
            </button>
            <div className="master-ribbon-small-col">
              <button
                className="master-ribbon-btn master-ribbon-btn--small"
                disabled={!selectedMasterLayoutId}
                onClick={() => selectedMasterLayoutId && onDeleteLayout?.(selectedMasterLayoutId)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="2" y1="2" x2="12" y2="12" stroke={selectedMasterLayoutId ? "#c00" : "#aaa"} strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="2" y2="12" stroke={selectedMasterLayoutId ? "#c00" : "#aaa"} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Delete
              </button>
              <button
                className="master-ribbon-btn master-ribbon-btn--small"
                onClick={() => {
                  setNameVal(currentName);
                  setRenaming(true);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 10 L9 3 L11 5 L4 12 L2 12 Z" stroke="#4472c4" strokeWidth="1" fill="#dce6f4" />
                </svg>
                Rename
              </button>
            </div>
          </div>
          <span className="ribbon-group-title">Edit Master</span>
        </div>

        <div className="ribbon-group master-ribbon-group">
          <div className="master-ribbon-row" style={{ position: "relative" }}>
            <div style={{ position: "relative" }}>
              <button
                ref={placeholderBtnRef}
                className="master-ribbon-btn master-ribbon-btn--large"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setPlaceholderMenuPosition({ top: rect.bottom + 4, left: rect.left });
                  setShowPlaceholderMenu((v) => !v);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="3" y="5" width="26" height="18" rx="2" stroke="#4472c4" strokeWidth="1.2" fill="#dce6f4" strokeDasharray="3 2" />
                  <line x1="16" y1="10" x2="16" y2="18" stroke="#4472c4" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1="12" y1="14" x2="20" y2="14" stroke="#4472c4" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span>Insert<br />Placeholder ▾</span>
              </button>
              {showPlaceholderMenu && (
                <div ref={placeholderMenuRef} className="placeholder-type-menu" style={{
                  position: "fixed",
                  top: placeholderMenuPosition.top,
                  left: placeholderMenuPosition.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  zIndex: 9999,
                  minWidth: 140,
                }}>
                  {[
                    { type: "text", label: "Text" },
                    { type: "content", label: "Content", layoutOnly: true },
                    { type: "image", label: "Picture" },
                    { type: "video", label: "Video" },
                  ].map(({ type, label, layoutOnly }) => {
                    const disabled = layoutOnly && !selectedMasterLayoutId;
                    return (
                      <button
                        key={type}
                        disabled={disabled}
                        title={disabled ? "Select a layout to insert a content placeholder" : undefined}
                        onClick={() => handleInsertPlaceholder(type)}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "7px 14px", border: "none", background: "none",
                          cursor: disabled ? "not-allowed" : "pointer", fontSize: 13,
                          color: disabled ? "#aaa" : "inherit",
                        }}
                        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#f0f4fc"; }}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="master-ribbon-checks">
              <label className="master-check-row" style={!selectedMasterLayoutId ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
                <input
                  type="checkbox"
                  checked={titleVisible}
                  onChange={handleToggleTitle}
                  disabled={!selectedMasterLayoutId}
                />
                {" "}Title
              </label>
              <label className="master-check-row" style={!selectedMasterLayoutId ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
                <input
                  type="checkbox"
                  checked={footersVisible}
                  onChange={handleToggleFooters}
                  disabled={!selectedMasterLayoutId}
                />
                {" "}Footers
              </label>
            </div>
          </div>
          <span className="ribbon-group-title">Master Layout</span>
        </div>

        <div className="ribbon-group master-ribbon-group sm-edit-theme-group">
          <div className="master-ribbon-row">
            <ThemesDropdown presentation={presentation} onApplyTheme={onApplyTheme} />
          </div>
          <span className="ribbon-group-title">Edit Theme</span>
        </div>

        <div className="ribbon-group master-ribbon-group">
          <div className="master-ribbon-row" style={{ flexDirection: "column", gap: 6, alignItems: "flex-start" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", width: 50, fontWeight: 500 }}>Colors</span>
              <ColorsDropdown
                currentSchemeId={presentation?.slideset?.master?.["current-color-scheme-id"]}
                onColorSchemeSelect={(colorScheme) => {
                  const activeTheme = findActiveTheme(colorTheme);
                  if (activeTheme) {
                    const decorations = applyColorSchemeToDesign(activeTheme, colorScheme);
                    const updatedColorTheme = updateThemeBackgroundFromScheme(colorTheme, colorScheme);
                    onApplyTheme?.(updatedColorTheme, decorations?.decorations, {
                      colorSchemeId: colorScheme.id,
                    });
                  }
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", width: 50, fontWeight: 500 }}>Fonts</span>
              <select
                value={currentFont}
                onChange={(e) => {
                  onApplyFont?.({ font: e.target.value });
                }}
                style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 3, width: 160, height: 24, cursor: "pointer", lineHeight: "16px", verticalAlign: "middle" }}
              >
                {getAvailableFonts(presentation).map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
            </div>

          </div>
          <span className="ribbon-group-title">Customize</span>
        </div>

        <div className="ribbon-group master-ribbon-group sm-edit-theme-group">
          <div className="master-ribbon-row">
            <SlideSizeDropdown presentation={presentation} onUpdateDimensions={onUpdateDimensions} />
          </div>
          <span className="ribbon-group-title">Size</span>
        </div>

        <div className="ribbon-group master-close-group">
          <button className="master-close-btn" onClick={onClose}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="3" fill="#c00" stroke="#a00" strokeWidth="0.8" />
              <line x1="8" y1="8" x2="20" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="20" y1="8" x2="8" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Close<br />Master View</span>
          </button>
          <span className="ribbon-group-title">Close</span>
        </div>
      </div>

      {renaming && (
        <div className="master-rename-overlay" onClick={() => setRenaming(false)}>
          <div className="master-rename-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="master-rename-title">{isRenamingLayout ? "Rename Layout" : "Rename Master"}</div>
            <input
              className="master-rename-input"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              autoFocus
            />
            <div className="master-rename-actions">
              <button className="master-rename-ok" onClick={commitRename}>OK</button>
              <button className="master-rename-cancel" onClick={() => setRenaming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImageUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onVideoUpload} />
    </>
  );
}

export default function SlideMasterView({
  presentation,
  activeMasterSlide,
  selectedMasterLayoutId,
  onSelectedLayoutChange,
  selectedMasterElementId,
  onSelectMasterElement,
  onSaveSelection,
  onMasterViewChangeText,
  onMasterViewChangeParagraphs,
  onMasterViewFormatText,
  onMasterViewMoveText,
  onMasterViewResizeText,
  onMasterViewMoveMedia,
  onMasterViewResizeMedia,
  onMasterViewAutoFitText,
  onMasterViewAutoFitMedia,
  onMasterViewDeleteText,
  onMasterViewDeleteMedia,
  onMasterViewDeleteSelection,
  cropSignal,
  onBeginHistory,
  onCommitHistory,
  onCancelHistory,
  onUndo,
  onRedo,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
}) {
  const [canvasZoom, setCanvasZoom] = useState(75);
  const canvasAreaRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(200);
  const isDraggingResize = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const onResizerMouseDown = (e) => {
    e.preventDefault();
    isDraggingResize.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;

    const onMouseMove = (ev) => {
      if (!isDraggingResize.current) return;
      const delta = ev.clientX - resizeStartX.current;
      setPanelWidth(Math.min(400, Math.max(140, resizeStartWidth.current + delta)));
    };
    const onMouseUp = () => {
      isDraggingResize.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const layouts = presentation?.slideset?.layouts ?? [];
  const selectedLayout = selectedMasterLayoutId
    ? layouts.find((l) => l["layout-id"] === selectedMasterLayoutId) ?? null
    : null;

  const dims = presentation?.slideset?.master?.["slide-dimensions"];
  const slideW = dims?.width ?? 1280;
  const slideH = dims?.height ?? 720;

  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const compute = () => {
      const availW = el.clientWidth - 80;
      const availH = el.clientHeight - 80;
      const zoomByW = (availW / slideW) * 100;
      const zoomByH = (availH / slideH) * 100;
      const computed = Math.floor(Math.min(zoomByW, zoomByH, 100));
      if (computed > 0) setCanvasZoom(computed);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slideW, slideH]);

  const handleSelectLayout = (layoutId) => {
    onSelectMasterElement?.(null);
    onSelectedLayoutChange?.(layoutId);
  };

  return (
    <div className="slide-master-body slide-master-body--full">
      <div className="master-panel" style={{ width: panelWidth }}>
        <div className="master-panel-resizer" onMouseDown={onResizerMouseDown} />
        <MasterThumb
          label="Office Theme"
          isSelected={selectedMasterLayoutId === null}
          isMaster={true}
          presentation={presentation}
          layout={null}
          onClick={() => handleSelectLayout(null)}
        />
        {layouts.map((layout) => (
          <MasterThumb
            key={layout["layout-id"]}
            label={layout["layout-id"]}
            isSelected={selectedMasterLayoutId === layout["layout-id"]}
            isMaster={false}
            presentation={presentation}
            layout={layout}
            onClick={() => handleSelectLayout(layout["layout-id"])}
          />
        ))}
      </div>

      <div className="master-canvas-area" ref={canvasAreaRef}>
        <EditorCanvas
          slide={activeMasterSlide}
          presentation={presentation}
          zoom={canvasZoom}
          showNotes={false}
          placeholderActionsDisabled
          hideMasterElements={!selectedLayout}
          selectedElementId={selectedMasterElementId}
          selectedElementIds={selectedMasterElementId ? [selectedMasterElementId] : []}
          onSelectElement={onSelectMasterElement}
          onChangeTextElement={onMasterViewChangeText}
          onChangeParagraphs={onMasterViewChangeParagraphs}
          onFormatTextElement={onMasterViewFormatText}
          onSaveSelection={onSaveSelection}
          onMoveTextElement={onMasterViewMoveText}
          onResizeTextElement={onMasterViewResizeText}
          onMoveMediaElement={onMasterViewMoveMedia}
          onResizeMediaElement={onMasterViewResizeMedia}
          onDeleteMedia={onMasterViewDeleteMedia}
          onDeleteTextElement={onMasterViewDeleteText}
          onDeleteSelection={() => onMasterViewDeleteSelection?.(selectedMasterElementId)}
          updateElement={onMasterViewAutoFitText}
          updateMedia={onMasterViewAutoFitMedia}
          cropSignal={cropSignal}
          onBeginHistory={onBeginHistory}
          onCommitHistory={onCommitHistory}
          onCancelHistory={onCancelHistory}
          onUndo={onUndo}
          onRedo={onRedo}
          onBringToFront={onBringToFront}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onSendToBack={onSendToBack}
        />
        <div className="master-canvas-label">
          {selectedMasterLayoutId === null
            ? "Slide Master — changes apply to all slides"
            : `Layout: ${selectedLayout?.name ?? selectedLayout?.["layout-id"] ?? ""} — changes apply to slides using this layout`}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import "./DesignTab.css";
import { getAvailableFonts } from "../../../core/model/fontConfig";
import { toHex6 } from "../../../core/utils/colorUtils";
import { DESIGN_THEMES, COLOR_SCHEMES, findActiveTheme, applyColorSchemeToDesign, updateThemeBackgroundFromScheme, THEME_PALETTE_COLUMNS, STANDARD_COLORS } from "../../../core/model/designThemes";
import { SLIDE_SIZES, clampSlideDimension } from "../../../core/model/slideSizes";
import { renderShapes } from "../../../core/render/shapeRenderer";
import { ColorsDropdown } from "./ColorsDropdown";
import FormatBackgroundPanel from "../shared/FormatBackgroundPanel";


export function ColorPalettePopup({ currentColor, onSelect, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", fn, true);
        return () => document.removeEventListener("mousedown", fn, true);
    }, [onClose]);

    return (
        <div className="bg-palette-popup" ref={ref}>
            <div className="bg-palette-section-label">Theme Colors</div>
            <div className="bg-palette-grid">
                {THEME_PALETTE_COLUMNS.map((col, ci) =>
                    col.map((color, ri) => (
                        <button
                            key={`${ci}-${ri}`}
                            className={`bg-palette-swatch${toHex6(currentColor).toLowerCase() === color.toLowerCase() ? " selected" : ""}`}
                            style={{ background: color }}
                            title={color}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={() => { onSelect(color); onClose(); }}
                        />
                    ))
                )}
            </div>
            <div className="bg-palette-section-label" style={{ marginTop: 10 }}>Standard Colors</div>
            <div className="bg-palette-standard-row">
                {STANDARD_COLORS.map((color) => (
                    <button
                        key={color}
                        className={`bg-palette-swatch${toHex6(currentColor).toLowerCase() === color.toLowerCase() ? " selected" : ""}`}
                        style={{ background: color }}
                        title={color}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => { onSelect(color); onClose(); }}
                    />
                ))}
            </div>
            <div className="bg-palette-more-row">
                <label className="bg-palette-more-btn">
                    🎨 More Colors...
                    <input type="color" value={toHex6(currentColor)} className="design-bg-input"
                        onChange={(e) => onSelect(e.target.value)} />
                </label>
            </div>
        </div>
    );
}


function ThemeThumbnail({ theme, isActive, onClick }) {
    const { bg, header, dots } = theme.preview;
    return (
        <button
            className={`design-theme-thumb${isActive ? " active" : ""}`}
            onClick={() => onClick(theme)}
            title={theme.name}
        >
            <div className="thumb-slide" style={{ background: bg }}>
                <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}
                    viewBox="0 0 1280 720" preserveAspectRatio="none">
                    {renderShapes(theme.decorations?.shapes ?? [])}
                </svg>
                <div className="thumb-header" style={{ background: header }} />
                <div className="thumb-lines">
                    <div className="thumb-line" style={{ background: header + "66", width: "65%" }} />
                    <div className="thumb-line" style={{ background: header + "44", width: "45%" }} />
                </div>
                <div className="thumb-dots">
                    {dots.map((color, i) => <span key={i} className="thumb-dot" style={{ background: color }} />)}
                </div>
            </div>
            <span className="thumb-label">{theme.name}</span>
        </button>
    );
}

function RightPanel({ presentation, onApplyFont, onUpdateDimensions, onApplySlideBackground, onApplyBgFillImage, onApplyBackgroundToAll, selectedSlide, currentColorSchemeId, onColorSchemeChange }) {
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [showCustomSize, setShowCustomSize] = useState(false);
    const [showFormatBg, setShowFormatBg] = useState(false);
    const sizeRef = useRef(null);

    const currentFont = presentation?.slideset?.master?.formatting?.font ?? "Arial";

    const currentW = presentation?.slideset?.master?.["slide-dimensions"]?.width ?? 1280;
    const currentH = presentation?.slideset?.master?.["slide-dimensions"]?.height ?? 720;
    const [customW, setCustomW] = useState(currentW);
    const [customH, setCustomH] = useState(currentH);

    useEffect(() => {
        const fn = (e) => {
            if (sizeRef.current && !sizeRef.current.contains(e.target)) {
                setShowSizeMenu(false);
                setShowCustomSize(false);
            }
        };
        document.addEventListener("mousedown", fn, true);
        return () => document.removeEventListener("mousedown", fn, true);
    }, []);

    const applyPreset = (size) => {
        onUpdateDimensions({ width: size.width, height: size.height }, size.aspectRatio, "px");
        setShowSizeMenu(false);
    };

    const applyCustom = () => {
        const w = clampSlideDimension(customW, 1280);
        const h = clampSlideDimension(customH, 720);
        onUpdateDimensions({ width: w, height: h }, "custom", "px");
        setShowSizeMenu(false);
        setShowCustomSize(false);
    };

    const currentPreset = SLIDE_SIZES.find(s => s.width === currentW && s.height === currentH);
    const sizeLabel = currentPreset ? currentPreset.aspectRatio : "Custom";

    return (
        <>
        <div className="design-right-panel">

            <div className="design-right-section">
                <div className="design-customize-row">
                    <span className="design-customize-label">Colors</span>
                    <ColorsDropdown
                        currentSchemeId={currentColorSchemeId}
                        onColorSchemeSelect={onColorSchemeChange}
                    />
                </div>

                <div className="design-customize-row">
                    <span className="design-customize-label">Fonts</span>
                    <select
                        className="design-font-select"
                        value={currentFont}
                        onChange={(e) => { e.stopPropagation(); onApplyFont({ font: e.target.value }); }}
                    >
                        {getAvailableFonts(presentation).map(f => (
                            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                        ))}
                    </select>
                </div>

                <div className="ribbon-group-title">Customize</div>
            </div>

            <div className="design-right-divider" />

            <div className="design-right-section">
                <div className="design-customize-row">
                    <span className="design-customize-label">Size</span>
                    <div className="design-slide-size-wrap" ref={sizeRef}>
                        <button
                            className="design-slide-size-btn"
                            onClick={() => { setShowSizeMenu(v => !v); setShowCustomSize(false); }}
                        >
                            <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                                <rect x="0.5" y="0.5" width="19" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                                <line x1="0.5" y1="3.5" x2="19.5" y2="3.5" stroke="currentColor" strokeWidth="0.8" />
                            </svg>
                            <span>{sizeLabel}</span>
                            <span className="design-slide-size-dim">{currentW}×{currentH}</span>
                            <span className="design-slide-size-arrow">▼</span>
                        </button>

                        {showSizeMenu && (
                            <div className="slide-size-dropdown">
                                {SLIDE_SIZES.map((size) => {
                                    const isActive = size.width === currentW && size.height === currentH;
                                    return (
                                        <button
                                            key={size.label}
                                            className={`slide-size-option${isActive ? " active" : ""}`}
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={() => applyPreset(size)}
                                        >
                                            <div className="slide-size-option-icon">
                                                <svg width={size.aspectRatio === "16:9" ? 32 : 26} height={size.aspectRatio === "16:9" ? 18 : 20} viewBox="0 0 32 18" fill="none">
                                                    <rect x="0.5" y="0.5" width="31" height="17" rx="1" stroke="#666" strokeWidth="1" fill="#f8f8f8" />
                                                </svg>
                                            </div>
                                            <div className="slide-size-option-text">
                                                <span className="slide-size-option-label">{size.label}</span>
                                                <span className="slide-size-option-dim">{size.width} × {size.height} px</span>
                                            </div>
                                            {isActive && <span className="slide-size-check">✓</span>}
                                        </button>
                                    );
                                })}

                                <div className="slide-size-divider" />

                                <button
                                    className="slide-size-option slide-size-custom-btn"
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={() => setShowCustomSize(v => !v)}
                                >
                                    <span>⚙ Custom Slide Size...</span>
                                </button>

                                {showCustomSize && (
                                    <div className="slide-size-custom-form">
                                        <label className="slide-size-custom-row">
                                            <span>Width (px)</span>
                                            <input type="number" value={customW} min={100} max={9999}
                                                onChange={(e) => setCustomW(e.target.value)} className="slide-size-custom-input" />
                                        </label>
                                        <label className="slide-size-custom-row">
                                            <span>Height (px)</span>
                                            <input type="number" value={customH} min={100} max={9999}
                                                onChange={(e) => setCustomH(e.target.value)} className="slide-size-custom-input" />
                                        </label>
                                        <button className="slide-size-custom-apply" onClick={applyCustom}>Apply</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="ribbon-group-title">Slide Size</div>
            </div>

        </div>

        {showFormatBg && (
            <FormatBackgroundPanel
                slide={selectedSlide}
                presentation={presentation}
                onApplySlideBackground={onApplySlideBackground}
                onApplyBgFillImage={onApplyBgFillImage}
                onApplyBackgroundToAll={onApplyBackgroundToAll}
                onClose={() => setShowFormatBg(false)}
            />
        )}
        </>
    );
}

export default function DesignTab({ presentation, onApplyTheme, onApplyFont, onUpdateDimensions, onApplySlideBackground, onApplyBgFillImage, onApplyBackgroundToAll, selectedSlide }) {
    const currentTheme = useMemo(
        () => presentation?.slideset?.master?.["color-theme"] ?? [],
        [presentation?.slideset?.master],
    );
    const savedColorSchemeId = presentation?.slideset?.master?.["current-color-scheme-id"];
    const activeTheme = findActiveTheme(currentTheme);

    const lastAppliedDesignId = presentation?.slideset?.master?.["last-applied-design-id"];

    const currentColorSchemeId = savedColorSchemeId;

    useEffect(() => {
        if (activeTheme?.id && activeTheme.id !== lastAppliedDesignId) {
            const defaultScheme = COLOR_SCHEMES.find(s => s.id === activeTheme.defaultColorSchemeId);
            if (defaultScheme) {
                const decorations = applyColorSchemeToDesign(activeTheme, defaultScheme);
                const updatedColorTheme = updateThemeBackgroundFromScheme(currentTheme, defaultScheme);
                onApplyTheme(updatedColorTheme, decorations?.decorations, {
                    colorSchemeId: defaultScheme.id,
                    designId: activeTheme.id,
                });
            }
        }
    }, [activeTheme, currentTheme, lastAppliedDesignId, onApplyTheme]);

    const applyAndSaveColorScheme = (colorScheme) => {
        if (activeTheme) {
            const decorations = applyColorSchemeToDesign(activeTheme, colorScheme);
            const updatedColorTheme = updateThemeBackgroundFromScheme(currentTheme, colorScheme);
            onApplyTheme(updatedColorTheme, decorations?.decorations, {
                colorSchemeId: colorScheme.id,
            });
        }
    };

    const handleColorSchemeSelect = (colorScheme) => {
        applyAndSaveColorScheme(colorScheme);
    };

    return (
        <div className="design-tab-wrapper">
            <div className="ribbon-group design-tab-group">
                <div className="design-themes-row">
                    {DESIGN_THEMES.map((theme) => (
                        <ThemeThumbnail
                            key={theme.id}
                            theme={theme}
                            isActive={theme.id === activeTheme?.id}
                            onClick={(t) => onApplyTheme(t.colorTheme, t.decorations)}
                        />
                    ))}
                </div>
                <span className="ribbon-group-title">Themes</span>
            </div>

            <div className="design-tab-divider" />

            <RightPanel
                presentation={presentation}
                onApplyFont={onApplyFont}
                onUpdateDimensions={onUpdateDimensions}
                onApplySlideBackground={onApplySlideBackground}
                onApplyBgFillImage={onApplyBgFillImage}
                onApplyBackgroundToAll={onApplyBackgroundToAll}
                currentColorSchemeId={currentColorSchemeId}
                onColorSchemeChange={handleColorSchemeSelect}
                selectedSlide={selectedSlide}
            />
        </div>
    );
}

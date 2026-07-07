import { useState, useRef, useEffect } from "react";
import "./ColorsDropdown.css";
import { COLOR_SCHEMES } from "../../../core/model/designThemes";
import { ThemeColorEditor } from "./ThemeColorEditor";

function ColorPalettePreview({ colors }) {
  return (
    <div className="colors-palette-preview">
      {colors.slice(0, 5).map((color, idx) => (
        <span
          key={idx}
          className="colors-palette-swatch"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

export function ColorsDropdown({ onColorSchemeSelect, onColorSchemeHover, onColorSchemeLeave, currentSchemeId, colorTheme, onUpdateThemeColor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const ref = useRef(null);

  const currentScheme = COLOR_SCHEMES.find(s => s.id === currentSchemeId);
  const displayName = currentScheme?.name ?? "Colors";

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        onColorSchemeLeave?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [onColorSchemeLeave]);

  const handleItemClick = (scheme) => {
    onColorSchemeSelect(scheme);
    setIsOpen(false);
  };

  return (
    <div className="colors-dropdown-wrapper" ref={ref}>
      <button
        className="colors-dropdown-btn"
        onClick={() => {
          if (isOpen) onColorSchemeLeave?.();
          setIsOpen(!isOpen);
        }}
        title={displayName}
      >
        <span className="colors-dropdown-label">{displayName}</span>
        <span className="colors-dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="colors-dropdown-panel">
          <div className="colors-list" onMouseLeave={() => onColorSchemeLeave?.()}>
            {COLOR_SCHEMES.map((scheme) => (
              <button
                key={scheme.id}
                className={`colors-item ${
                  currentSchemeId === scheme.id ? "active" : ""
                }`}
                onMouseEnter={() => onColorSchemeHover?.(scheme)}
                onClick={() => handleItemClick(scheme)}
                title={scheme.name}
              >
                <ColorPalettePreview colors={scheme.colors} />
                <span className="colors-item-name">{scheme.name}</span>
              </button>
            ))}
          </div>
          {onUpdateThemeColor && (
            <>
              <div className="colors-dropdown-divider" />
              <button
                className="colors-customize-btn"
                onClick={() => {
                  setIsOpen(false);
                  setShowCustomizeDialog(true);
                }}
              >
                🎨 Customize Colors...
              </button>
            </>
          )}
        </div>
      )}

      {showCustomizeDialog && (
        <div className="theme-customize-dialog-overlay">
          <div className="theme-customize-dialog">
            <div className="theme-customize-dialog-header">
              <h2>Customize Colors</h2>
              <button
                className="theme-customize-close-btn"
                onClick={() => setShowCustomizeDialog(false)}
              >
                ✕
              </button>
            </div>

            <div className="theme-customize-dialog-body">
              <ThemeColorEditor
                colorTheme={colorTheme ?? []}
                onColorChange={onUpdateThemeColor}
              />
            </div>

            <div className="theme-customize-dialog-footer">
              <button
                className="theme-customize-save-btn"
                onClick={() => setShowCustomizeDialog(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useRef, useCallback, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { useMediaSrc } from "../../../hooks/useMediaSrc";
import "./FormatBackgroundPanel.css";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function colorWithAlpha(hex6, transparencyPct) {
  const { r, g, b } = hexToRgb(hex6);
  const alpha = Math.round((1 - transparencyPct / 100) * 255);
  return `rgba(${r},${g},${b},${(alpha / 255).toFixed(3)})`;
}

function parseStoredColor(stored) {
  if (!stored || stored === "#FFFFFFFF") return { hex: "#ffffff", transparency: 0 };
  if (stored.startsWith("rgba")) {
    const m = stored.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
    if (m) {
      const r = parseInt(m[1]).toString(16).padStart(2, "0");
      const g = parseInt(m[2]).toString(16).padStart(2, "0");
      const b = parseInt(m[3]).toString(16).padStart(2, "0");
      const transparency = Math.round((1 - parseFloat(m[4])) * 100);
      return { hex: `#${r}${g}${b}`, transparency };
    }
  }
  return { hex: stored.slice(0, 7), transparency: 0 };
}

function BgImagePreview({ fileLink }) {
  const src = useMediaSrc(fileLink);
  return src ? (
    <div className="fbp-picture-preview">
      <img src={src} alt="" />
    </div>
  ) : null;
}

function getThemeBgLight(presentation) {
  const colorTheme = presentation?.slideset?.master?.["color-theme"] ?? [];
  const entry = colorTheme.find((e) => e["css-variable-name"] === "bg-light");
  if (!entry?.color) return "#ffffff";
  const c = entry.color.replace("#", "");
  return `#${c.slice(0, 6)}`;
}

export default function FormatBackgroundPanel({
  slide,
  presentation,
  onApplySlideBackground,
  onApplyBgFillImage,
  onApplyBackgroundToAll,
  onClose,
}) {
  const panelRef = useRef(null);
  const resizeState = useRef(null);
  const [width, setWidth] = useState(280);

  const onResizeMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    resizeState.current = { startX: e.clientX, startWidth: width };
    e.preventDefault();

    const onMove = (ev) => {
      const { startX, startWidth } = resizeState.current;
      const newWidth = Math.max(200, Math.min(500, startWidth + (startX - ev.clientX)));
      setWidth(newWidth);
    };
    const onUp = () => {
      resizeState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  const storedBg = slide?.contents?.background ?? null;
  const isImageBg = storedBg && typeof storedBg === "object" && storedBg.type === "image";
  const bgImage = isImageBg ? storedBg["file-link"] : null;
  const storedSettings = isImageBg ? storedBg : {};

  const themeBgLight = getThemeBgLight(presentation);
  const effectiveBg = isImageBg ? null : (!storedBg || storedBg === "#FFFFFFFF" ? themeBgLight : storedBg);
  const parsed = parseStoredColor(effectiveBg);
  const [fillTypeOverride, setFillTypeOverride] = useState(null);
  const fillType = fillTypeOverride ?? (bgImage ? "picture" : "solid");
  const [solidColor, setSolidColor] = useState(parsed.hex);
  const [transparency, setTransparency] = useState(parsed.transparency);
  const [picTransparency, setPicTransparency] = useState(storedSettings.transparency ?? 0);
  const [offsetLeft, setOffsetLeft] = useState(storedSettings.offsetLeft ?? 0);
  const [offsetRight, setOffsetRight] = useState(storedSettings.offsetRight ?? 0);
  const [offsetTop, setOffsetTop] = useState(storedSettings.offsetTop ?? 0);
  const [offsetBottom, setOffsetBottom] = useState(storedSettings.offsetBottom ?? 0);
  const [fitToCanvas, setScaleToCanvas] = useState(storedSettings.fitToCanvas ?? false);

  const slideId = slide?.id;
  useEffect(() => {
    const bg = slide?.contents?.background ?? null;
    const isImg = bg && typeof bg === "object" && bg.type === "image";
    const settings = isImg ? bg : {};
    const effective = isImg ? null : (!bg || bg === "#FFFFFFFF" ? themeBgLight : bg);
    const p = parseStoredColor(effective);
    setFillTypeOverride(null);
    setSolidColor(p.hex);
    setTransparency(p.transparency);
    setPicTransparency(settings.transparency ?? 0);
    setOffsetLeft(settings.offsetLeft ?? 0);
    setOffsetRight(settings.offsetRight ?? 0);
    setOffsetTop(settings.offsetTop ?? 0);
    setOffsetBottom(settings.offsetBottom ?? 0);
    setScaleToCanvas(settings.fitToCanvas ?? false);
  }, [slideId, slide?.contents?.background, themeBgLight]);

  const fileInputRef = useRef(null);

  const currentSettings = () => ({
    transparency: picTransparency, offsetLeft, offsetRight, offsetTop, offsetBottom, fitToCanvas,
  });

  const applyImageBackground = (settings) => {
    if (!bgImage) return;
    onApplySlideBackground?.({ type: "image", "file-link": bgImage, ...settings });
  };

  const handleColorChange = (hex) => {
    setSolidColor(hex);
    onApplySlideBackground?.(colorWithAlpha(hex, transparency));
  };

  const handleTransparencyChange = (val) => {
    setTransparency(val);
    onApplySlideBackground?.(colorWithAlpha(solidColor, val));
  };

  const handlePicTransparencyChange = (val) => {
    setPicTransparency(val);
    applyImageBackground({ ...currentSettings(), transparency: val });
  };

  const handleOffsetChange = (field, val, setter) => {
    setter(val);
    applyImageBackground({ ...currentSettings(), [field]: val });
  };

  const handleScaleToCanvas = (checked) => {
    setScaleToCanvas(checked);
    if (checked) {
      setOffsetLeft(0); setOffsetRight(0); setOffsetTop(0); setOffsetBottom(0);
      applyImageBackground({ transparency: picTransparency, offsetLeft: 0, offsetRight: 0, offsetTop: 0, offsetBottom: 0, fitToCanvas: true });
    } else {
      applyImageBackground({ ...currentSettings(), fitToCanvas: false });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFillTypeOverride("picture");
      onApplyBgFillImage?.(file, currentSettings());
    }
    e.target.value = "";
  };

  const handleRemovePicture = () => {
    onApplySlideBackground?.(null);
    setFillTypeOverride("solid");
  };

  const handleReset = () => {
    setSolidColor(themeBgLight);
    setTransparency(0);
    setPicTransparency(0);
    setOffsetLeft(0); setOffsetRight(0); setOffsetTop(0); setOffsetBottom(0);
    setScaleToCanvas(false);
    setFillTypeOverride("solid");
    onApplySlideBackground?.(null);
  };

  const handleApplyToAll = () => {
    if (fillType === "solid") {
      onApplyBackgroundToAll?.(colorWithAlpha(solidColor, transparency));
    } else if (fillType === "picture") {
      onApplyBackgroundToAll?.({ type: "image", "file-link": bgImage, ...currentSettings() });
    }
  };

  return (
    <div className="fbp-panel" ref={panelRef} style={{ flexBasis: width }}>
      <div className="fbp-resize-handle" onMouseDown={onResizeMouseDown} />
      <div className="fbp-header">
        <span className="fbp-title">Format Background</span>
        <button className="fbp-close" onClick={onClose}><MdClose /></button>
      </div>

      <div className="fbp-body">
        <div className="fbp-section">
          <div className="fbp-section-title">▲ Fill</div>

          <label className="fbp-radio">
            <input type="radio" name="fill" checked={fillType === "solid"} onChange={() => setFillTypeOverride("solid")} />
            Solid fill
          </label>
          <label className="fbp-radio">
            <input type="radio" name="fill" checked={fillType === "picture"} onChange={() => setFillTypeOverride("picture")} />
            Picture fill
          </label>
        </div>

        <div className="fbp-divider" />

        {/* Solid fill */}
        {fillType === "solid" && (
          <div className="fbp-section">
            <div className="fbp-row">
              <span className="fbp-label">Color</span>
              <input
                type="color"
                className="fbp-color-input"
                value={solidColor}
                onChange={e => handleColorChange(e.target.value)}
              />
            </div>
            <div className="fbp-row">
              <span className="fbp-label">Transparency</span>
              <input
                type="range"
                min={0} max={100}
                value={transparency}
                onChange={e => handleTransparencyChange(Number(e.target.value))}
                className="fbp-slider"
              />
              <span className="fbp-value">{transparency} %</span>
            </div>
          </div>
        )}

        {/* Picture fill */}
        {fillType === "picture" && (
          <div className="fbp-section">
            <div className="fbp-subsection-title">Picture source</div>
            <div className="fbp-row fbp-row-gap">
              <button className="fbp-btn-primary" onClick={() => fileInputRef.current?.click()}>
                Insert...
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
            </div>

            {bgImage && (
              <>
                <BgImagePreview fileLink={bgImage} />
                <button className="fbp-btn fbp-btn-remove" onClick={handleRemovePicture}>
                  Remove picture
                </button>
              </>
            )}

            <div className="fbp-row">
              <span className="fbp-label">Transparency</span>
              <input
                type="range"
                min={0} max={100}
                value={picTransparency}
                onChange={e => handlePicTransparencyChange(Number(e.target.value))}
                className="fbp-slider"
                disabled={!bgImage}
              />
              <span className="fbp-value">{picTransparency} %</span>
            </div>

            <div className="fbp-divider" style={{ margin: "8px 0" }} />

            <div className="fbp-row">
              <span className="fbp-label">Offset left</span>
              <input type="number" className="fbp-number" value={offsetLeft} onChange={e => handleOffsetChange("offsetLeft", Number(e.target.value), setOffsetLeft)} disabled={!bgImage} />
              <span className="fbp-unit">%</span>
            </div>
            <div className="fbp-row">
              <span className="fbp-label">Offset right</span>
              <input type="number" className="fbp-number" value={offsetRight} onChange={e => handleOffsetChange("offsetRight", Number(e.target.value), setOffsetRight)} disabled={!bgImage} />
              <span className="fbp-unit">%</span>
            </div>
            <div className="fbp-row">
              <span className="fbp-label">Offset top</span>
              <input type="number" className="fbp-number" value={offsetTop} onChange={e => handleOffsetChange("offsetTop", Number(e.target.value), setOffsetTop)} disabled={!bgImage} />
              <span className="fbp-unit">%</span>
            </div>
            <div className="fbp-row">
              <span className="fbp-label">Offset bottom</span>
              <input type="number" className="fbp-number" value={offsetBottom} onChange={e => handleOffsetChange("offsetBottom", Number(e.target.value), setOffsetBottom)} disabled={!bgImage} />
              <span className="fbp-unit">%</span>
            </div>

            <label className="fbp-checkbox" style={!bgImage ? { opacity: 0.4, pointerEvents: "none" } : {}}>
              <input
                type="checkbox"
                checked={fitToCanvas}
                onChange={e => handleScaleToCanvas(e.target.checked)}
                disabled={!bgImage}
              />
              Fit to canvas
            </label>
          </div>
        )}
      </div>

      <div className="fbp-footer">
        <button className="fbp-btn fbp-btn-secondary" onClick={handleApplyToAll}>
          Apply to All
        </button>
        <button className="fbp-btn" onClick={handleReset}>
          Reset Background
        </button>
      </div>
    </div>
  );
}

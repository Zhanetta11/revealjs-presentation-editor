import { useState, useRef, useCallback, useEffect } from "react";
import { useMediaSrc } from "../../../hooks/media/useMediaSrc";
import {
  SHARPEN_PRESETS,
  COLOR_SATURATION,
  COLOR_TONE,
  RECOLOR_PRESETS,
  ARTISTIC_EFFECTS,
  SHADOW_PRESETS,
  REFLECTION_PRESETS,
  GLOW_PRESETS,
  SOFT_EDGES_PRESETS,
  BEVEL_PRESETS,
  ROTATION3D_PRESETS,
  PICTURE_PRESETS,
  GLOW_COLORS,
  GLOW_SIZES,
  buildGlowShadow,
} from "../../../core/model/imageEffects";
import {
  MdTune,
  MdColorLens,
  MdOpacity,
  MdRestartAlt,
  MdCrop,
  MdFlipToFront,
  MdFlipToBack,
  MdLock,
  MdLockOpen,
  MdAccessibility,
  MdAutoAwesome,
  MdImage,
  MdKeyboardArrowUp,
  MdKeyboardArrowDown,
  MdApps,
  MdOutlineBorderColor,
  MdChevronRight,
  MdCheck,
} from "react-icons/md";
import { createPortal } from "react-dom";
import ImageStylePicker from "../../canvas/media/ImageStylePicker";
import AltTextPanel from "./AltTextPanel";
import { IMAGE_STYLES } from "../../../core/model/imageStyles";
import "./PictureFormatTab.css";

const SVG_PREVIEW = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8d8f0"/><stop offset="100%" stop-color="#d6eef8"/></linearGradient><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7bc67e"/><stop offset="100%" stop-color="#4caf50"/></linearGradient></defs><rect width="64" height="48" fill="url(#sky)"/><circle cx="10" cy="11" r="6" fill="#fdd835"/><polygon points="0,48 0,28 12,16 24,26 36,12 52,26 64,18 64,48" fill="url(#g1)"/></svg>`,
)}`;

function Popover({ children, anchorRect, wide }) {
  const ref = useRef(null);
  const left = anchorRect
    ? Math.min(anchorRect.left, window.innerWidth - (wide ? 360 : 220) - 8)
    : 100;
  const style = anchorRect
    ? { position: "fixed", top: anchorRect.bottom + 4, left, zIndex: 9999 }
    : { position: "fixed", top: 100, left: 100, zIndex: 9999 };

  return createPortal(
    <div
      ref={ref}
      className="pft-popover"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

function SliderRow({ label, min, max, value, onChange, onBeginHistory, onCommitHistory }) {
  return (
    <div className="pft-slider-row">
      <span className="pft-slider-label">{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseDown={(e) => { e.stopPropagation(); onBeginHistory?.(); }}
        onMouseUp={onCommitHistory}
      />
      <span className="pft-slider-val">{value}</span>
    </div>
  );
}


const BC_BRIGHTNESS = [-0.4, -0.2, 0, 0.2, 0.4];
const BC_CONTRAST   = [0.4, 0.2, 0, -0.2, -0.4];

function CorrectionsPopover({ src, effects, onUpdate, anchorRect, onBeginHistory, onCommitHistory }) {
  const activeBrightness = effects.brightness ?? 0;
  const activeContrast   = effects.contrast   ?? 0;
  const activeSharpen    = effects.sharpenId  ?? "none";

  const applyBc = useCallback((b, c) => {
    onUpdate({ effects: { ...effects, brightness: b, contrast: c } });
  }, [effects, onUpdate]);

  const applySharpen = useCallback((preset) => {
    onUpdate({ effects: { ...effects, sharpenId: preset.id } });
  }, [effects, onUpdate]);

  const bcFilter = (b, c) => {
    const parts = [];
    if (b !== 0) parts.push(`brightness(${(1 + b).toFixed(2)})`);
    if (c !== 0) parts.push(`contrast(${(1 + c).toFixed(2)})`);
    return parts.join(" ") || "none";
  };

  const isActiveBc = (b, c) =>
    Math.abs(activeBrightness - b) < 0.05 && Math.abs(activeContrast - c) < 0.05;

  return (
    <Popover anchorRect={anchorRect} wide>
      <div className="pft-corr-section-title">Sharpen/Soften</div>
      <div className="pft-corr-row">
        {SHARPEN_PRESETS.map((p) => {
          const style = p.filter ? { filter: p.filter } : undefined;
          return (
            <button
              key={p.id}
              className={`pft-corr-cell${activeSharpen === p.id ? " pft-corr-cell--active" : ""}`}
              title={p.label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applySharpen(p); }}
            >
              <div className="pft-corr-thumb">
                {src
                  ? <img src={src} alt="" style={style} />
                  : <div className="pft-corr-placeholder" style={style} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pft-corr-section-title" style={{ marginTop: 10 }}>Brightness/Contrast</div>
      <div className="pft-corr-bc-labels">
        {BC_BRIGHTNESS.map((b) => (
          <span key={b}>{b > 0 ? `+${Math.round(b * 100)}%` : `${Math.round(b * 100)}%`}</span>
        ))}
      </div>
      <div className="pft-corr-grid">
        {BC_CONTRAST.map((c) =>
          BC_BRIGHTNESS.map((b) => {
            const active = isActiveBc(b, c);
            return (
              <button
                key={`${b},${c}`}
                className={`pft-corr-cell${active ? " pft-corr-cell--active" : ""}`}
                title={`Brightness: ${b > 0 ? "+" : ""}${Math.round(b * 100)}%  Contrast: ${c > 0 ? "+" : ""}${Math.round(c * 100)}%`}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyBc(b, c); }}
              >
                <div className="pft-corr-thumb">
                  {src
                    ? <img src={src} alt="" style={{ filter: bcFilter(b, c) }} />
                    : <div className="pft-corr-placeholder" style={{ filter: bcFilter(b, c) }} />}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="pft-corr-footer">
        <SliderRow label="Brightness" min={-100} max={100}
          value={Math.round(activeBrightness * 100)}
          onChange={(v) => applyBc(v / 100, activeContrast)}
          onBeginHistory={onBeginHistory} onCommitHistory={onCommitHistory} />
        <SliderRow label="Contrast" min={-100} max={100}
          value={Math.round(activeContrast * 100)}
          onChange={(v) => applyBc(activeBrightness, v / 100)}
          onBeginHistory={onBeginHistory} onCommitHistory={onCommitHistory} />
      </div>
    </Popover>
  );
}

function ImgThumb({ src, cssFilter, label, active, onSelect }) {
  const style = cssFilter ? { filter: cssFilter } : undefined;
  return (
    <button
      className={`pft-color-cell${active ? " pft-color-cell--active" : ""}`}
      title={label}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); }}
    >
      <div className="pft-color-thumb">
        {src
          ? <img src={src} alt="" style={style} />
          : <div className="pft-corr-placeholder" style={style} />}
      </div>
    </button>
  );
}

function ColorPopover({ src, effects, onUpdate, anchorRect }) {
  const currentId = effects.tintId ?? "none";

  const apply = useCallback((preset) => {
    onUpdate({ effects: { ...effects, tintId: preset.id } });
  }, [effects, onUpdate]);

  return (
    <Popover anchorRect={anchorRect} wide>
      <div className="pft-color-section-title">Color Saturation</div>
      <div className="pft-color-row">
        {COLOR_SATURATION.map((p) => (
          <ImgThumb key={p.id} src={src} cssFilter={p.filter} label={p.label}
            active={currentId === p.id} onSelect={() => apply(p)} />
        ))}
      </div>

      <div className="pft-color-section-title" style={{ marginTop: 10 }}>Color Tone</div>
      <div className="pft-color-row">
        {COLOR_TONE.map((p) => (
          <ImgThumb key={p.id} src={src} cssFilter={p.filter} label={p.label}
            active={currentId === p.id} onSelect={() => apply(p)} />
        ))}
      </div>

      <div className="pft-color-section-title" style={{ marginTop: 10 }}>Recolor</div>
      <div className="pft-color-recolor-grid">
        {RECOLOR_PRESETS.map((p) => (
          <ImgThumb key={p.id} src={src} cssFilter={p.filter} label={p.label}
            active={currentId === p.id} onSelect={() => apply(p)} />
        ))}
      </div>

      <div className="pft-color-footer">
        <button className="pft-color-link"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); apply(RECOLOR_PRESETS[0]); }}>
          ↺ Reset Color
        </button>
      </div>
    </Popover>
  );
}

const THEME_COLORS = [
  ["#FFFFFF","#000000","#E7E6E6","#44546A","#4472C4","#ED7D31","#FFC000","#70AD47","#FF0000","#7030A0"],
  ["#F2F2F2","#7F7F7F","#D0CECE","#D6DCE5","#D9E2F3","#FCE4D6","#FFF2CC","#E2EFDA","#FFE0E0","#EAD1DC"],
  ["#D9D9D9","#595959","#AEAAAA","#ACB9CA","#B4C7E7","#F8CBAD","#FFE699","#C6E0B4","#FFC7CE","#D5A6BD"],
  ["#BFBFBF","#404040","#757070","#8497B0","#8EAADB","#F4B183","#FFD966","#A9D18E","#FF9999","#C27BA0"],
  ["#A6A6A6","#262626","#3A3838","#323F4F","#2E75B6","#C55A11","#BF9000","#538135","#CC0000","#6A2E74"],
  ["#808080","#0D0D0D","#171515","#222A35","#1F4E79","#843C0C","#7F6000","#375623","#990000","#4A1362"],
];

const STANDARD_COLORS = [
  "#C00000","#FF0000","#FFC000","#FFFF00","#92D050","#00B050","#00B0F0","#0070C0","#002060","#7030A0",
];

const WEIGHT_PRESETS = [
  { label: "¼ pt",  px: 0.5  },
  { label: "½ pt",  px: 1    },
  { label: "1 pt",  px: 1.5  },
  { label: "1½ pt", px: 2    },
  { label: "2¼ pt", px: 3    },
  { label: "3 pt",  px: 4    },
  { label: "4½ pt", px: 6    },
  { label: "6 pt",  px: 8    },
];

const DASH_PRESETS = [
  { id: "solid",    label: "Solid",       style: "solid",  gap: null },
  { id: "dashed",   label: "Dash",        style: "dashed", gap: null },
  { id: "dotted",   label: "Round Dot",   style: "dotted", gap: null },
  { id: "double",   label: "Double",      style: "double", gap: null },
  { id: "groove",   label: "Groove",      style: "groove", gap: null },
];

function PictureBorderPopover({ effects, onUpdate, anchorRect }) {
  const [sub, setSub] = useState(null);
  const border = effects.border ?? {};
  const currentColor = border.color ?? null;
  const currentPx    = border.width ?? 2;
  const currentDash  = border.dash  ?? "solid";

  const applyColor = (color) => {
    onUpdate({ effects: { ...effects, border: { ...border, color } } });
  };
  const applyWeight = (px) => {
    const color = currentColor ?? "#000000";
    onUpdate({ effects: { ...effects, border: { ...border, color, width: px } } });
  };
  const applyDash = (dash) => {
    const color = currentColor ?? "#000000";
    onUpdate({ effects: { ...effects, border: { ...border, color, dash } } });
  };
  const removeOutline = () => {
    const rest = { ...effects };
    delete rest.border;
    onUpdate({ effects: rest });
  };

  return (
    <Popover anchorRect={anchorRect}>
      <div className="pft-border-section">Theme Colors</div>
      <div className="pft-border-theme">
        {THEME_COLORS.map((row, ri) => (
          <div key={ri} className="pft-border-color-row">
            {row.map((c) => (
              <button key={c} className={`pft-border-swatch${currentColor === c ? " pft-border-swatch--active" : ""}`}
                style={{ background: c, border: c === "#FFFFFF" ? "1px solid #d1d5db" : "1px solid transparent" }}
                onMouseDown={(e) => { e.preventDefault(); applyColor(c); }} />
            ))}
          </div>
        ))}
      </div>

      <div className="pft-border-section" style={{ marginTop: 8 }}>Standard Colors</div>
      <div className="pft-border-color-row" style={{ marginBottom: 8 }}>
        {STANDARD_COLORS.map((c) => (
          <button key={c} className={`pft-border-swatch${currentColor === c ? " pft-border-swatch--active" : ""}`}
            style={{ background: c }}
            onMouseDown={(e) => { e.preventDefault(); applyColor(c); }} />
        ))}
      </div>

      <div className="pft-border-divider" />

      <button className="pft-border-action" onMouseDown={(e) => { e.preventDefault(); removeOutline(); }}>
        <span className="pft-border-no-outline-icon" />
        <span>No Outline</span>
      </button>

      <div className="pft-border-divider" />

      {/* Weight */}
      <div className="pft-border-submenu-row" onMouseEnter={() => setSub("weight")} onMouseLeave={() => setSub(null)}>
        <span className="pft-border-action-icon">≡</span>
        <span style={{ flex: 1 }}>Weight</span>
        <MdChevronRight />
        {sub === "weight" && (
          <div className="pft-border-sub">
            {WEIGHT_PRESETS.map((w) => (
              <button key={w.px} className="pft-border-sub-item"
                onMouseDown={(e) => { e.preventDefault(); applyWeight(w.px); }}>
                <MdCheck style={{ opacity: Math.abs(currentPx - w.px) < 0.1 ? 1 : 0, fontSize: 12, marginRight: 4 }} />
                <div style={{ width: 60, height: w.px, background: "#374151", margin: "0 8px", alignSelf: "center", minHeight: 1 }} />
                <span>{w.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dashes */}
      <div className="pft-border-submenu-row" onMouseEnter={() => setSub("dash")} onMouseLeave={() => setSub(null)}>
        <span className="pft-border-action-icon">╌</span>
        <span style={{ flex: 1 }}>Dashes</span>
        <MdChevronRight />
        {sub === "dash" && (
          <div className="pft-border-sub">
            {DASH_PRESETS.map((d) => (
              <button key={d.id} className="pft-border-sub-item"
                onMouseDown={(e) => { e.preventDefault(); applyDash(d.id); }}>
                <MdCheck style={{ opacity: currentDash === d.id ? 1 : 0, fontSize: 12, marginRight: 4 }} />
                <div style={{ width: 60, height: 2, borderBottom: `2px ${d.style} #374151`, margin: "0 8px", alignSelf: "center" }} />
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}

const SHADOW_SECTIONS = [
  { key: "none",        title: "No Shadow" },
  { key: "outer",       title: "Outer" },
  { key: "inner",       title: "Inner" },
  { key: "perspective", title: "Perspective" },
];

const FX_MENU = [
  { key: "presetId",     label: "Preset",      icon: "⊞",  presets: null,               special: "preset"   },
  { key: "shadowId",     label: "Shadow",      icon: "🌑", presets: SHADOW_PRESETS,     special: "shadow"   },
  { key: "reflectionId", label: "Reflection",  icon: "🪞", presets: REFLECTION_PRESETS, special: "reflection" },
  { key: "glowId",       label: "Glow",        icon: "✨", presets: GLOW_PRESETS,     special: "glow"       },
  { key: "softEdgesId",  label: "Soft Edges",  icon: "🌫", presets: SOFT_EDGES_PRESETS, special: "softEdges" },
  { key: "bevelId",      label: "Bevel",       icon: "⬡",  presets: BEVEL_PRESETS,     special: "bevel"     },
  { key: "rotation3dId", label: "3-D Rotation",icon: "🔄", presets: ROTATION3D_PRESETS, special: "rotation3d" },
];

function PresetSubPanel({ src, effects, onSelect, onHover, onHoverClear }) {
  const none = PICTURE_PRESETS[0];
  const presets = PICTURE_PRESETS.slice(1);

  const buildStyle = (p) => {
    const style = {};
    const fx = p.effects;
    if (fx.shadowId) {
      const sp = SHADOW_PRESETS.find((s) => s.id === fx.shadowId);
      if (sp?.shadow) style.boxShadow = sp.shadow;
    }
    if (fx.bevelId) {
      const bp = BEVEL_PRESETS.find((b) => b.id === fx.bevelId);
      if (bp?.bevel) style.boxShadow = [style.boxShadow, bp.bevel].filter(Boolean).join(", ");
    }
    if (fx.rotation3dId) {
      const rp = ROTATION3D_PRESETS.find((r) => r.id === fx.rotation3dId);
      if (rp?.transform) style.transform = rp.transform.replace("perspective(none) ", "");
    }
    return style;
  };

  const activeId = effects.presetId ?? "none";

  return (
    <div className="pft-fx-preset-panel">
      <div className="pft-fx-preset-section-title">No Presets</div>
      <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1, 1fr)" }}>
        <button
          className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
          title="No Preset"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(none); }}
          onMouseEnter={() => onHover?.(none)}
          onMouseLeave={() => onHoverClear?.()}
        >
          <div className="pft-fx-thumb">
            {src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}
          </div>
        </button>
      </div>
      <div className="pft-fx-preset-section-title" style={{ marginTop: 8 }}>Presets</div>
      <div className="pft-fx-preset-grid">
        {presets.map((p) => (
          <button
            key={p.id}
            className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
            title={p.label}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
            onMouseEnter={() => onHover?.(p)}
            onMouseLeave={() => onHoverClear?.()}
          >
            <div className="pft-fx-thumb" style={buildStyle(p)}>
              {src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReflectionThumb({ src, preset }) {
  if (!src || preset.size === 0) {
    return <div className="pft-fx-thumb">{src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}</div>;
  }
  const reflH = Math.round((preset.size / 100) * 40);
  return (
    <div className="pft-fx-thumb pft-fx-refl-thumb">
      <img src={src} alt="" style={{ height: 40 - Math.round(reflH * 0.35) - (preset.offset ?? 0) * 0.5, flexShrink: 0 }} />
      {preset.offset > 0 && <div style={{ height: preset.offset * 0.5 }} />}
      <img
        src={src} alt=""
        style={{
          height: reflH,
          transform: "scaleY(-1)",
          opacity: preset.opacity,
          filter: preset.blur > 0 ? `blur(${preset.blur * 0.4}px)` : undefined,
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function ReflectionSubPanel({ src, activeId, onSelect, onHover, onHoverClear }) {
  const none = REFLECTION_PRESETS.find((p) => p.section === "none");
  const variations = REFLECTION_PRESETS.filter((p) => p.section === "variations");
  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel">
      <div>
        <div className="pft-fx-preset-section-title">No Reflection</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1,1fr)" }}>
          <button
            className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
            title="No Reflection"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(none); }}
            onMouseEnter={() => onHover?.(none)} onMouseLeave={() => onHoverClear?.()}
          >
            <ReflectionThumb src={src} preset={none} />
          </button>
        </div>
      </div>
      <div>
        <div className="pft-fx-preset-section-title">Reflection Variations</div>
        <div className="pft-fx-preset-grid">
          {variations.map((p) => (
            <button
              key={p.id}
              className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
              title={p.label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
              onMouseEnter={() => onHover?.(p)} onMouseLeave={() => onHoverClear?.()}
            >
              <ReflectionThumb src={src} preset={p} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const THEME_COLORS_GLOW = [
  "#FFFFFF","#000000","#E7E6E6","#44546A","#4472C4","#ED7D31","#A5A5A5","#FFC000","#5B9BD5","#70AD47",
];
const STD_COLORS_GLOW = [
  "#C00000","#FF0000","#FFC000","#FFFF00","#92D050","#00B050","#00B0F0","#0070C0","#002060","#7030A0",
];

function GlowSubPanel({ src, activeId, onApply, onHover, onHoverClear }) {
  const [colorPicker, setColorPicker] = useState(false);

  const applyVariant = (colorHex, sizeIdx) => {
    const id = `custom-${colorHex.replace("#","")}-${sizeIdx}`;
    onApply({ id, shadow: buildGlowShadow(colorHex, sizeIdx), color: colorHex });
  };

  const applyColor = (hex) => {
    onApply({ id: `custom-${hex.replace("#","")}-1`, shadow: buildGlowShadow(hex, 1), color: hex });
    setColorPicker(false);
  };

  const nonePreset = GLOW_PRESETS.find((p) => p.id === "none");

  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel" style={{ minWidth: 280 }}>
      {/* No Glow */}
      <div>
        <div className="pft-fx-preset-section-title">No Glow</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1,1fr)" }}>
          <button
            className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
            title="No Glow"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onApply(nonePreset); }}
            onMouseEnter={() => onHover?.(nonePreset)} onMouseLeave={() => onHoverClear?.()}
          >
            <div className="pft-fx-thumb">{src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}</div>
          </button>
        </div>
      </div>

      {/* Glow Variations — 6 cols × 4 rows */}
      <div>
        <div className="pft-fx-preset-section-title">Glow Variations</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(6,1fr)", gap: 3 }}>
          {GLOW_SIZES.map((_, si) =>
            GLOW_COLORS.map((c) => {
              const id = `${c.key}-${si}`;
              const shadow = buildGlowShadow(c.hex, si);
              return (
                <button
                  key={id}
                  className={`pft-fx-sub-item${activeId === id ? " pft-fx-sub-item--active" : ""}`}
                  title={`${c.key}, ${GLOW_SIZES[si].pt}pt`}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyVariant(c.hex, si); }}
                  onMouseEnter={() => onHover?.({ id, shadow })} onMouseLeave={() => onHoverClear?.()}
                >
                  <div className="pft-fx-thumb" style={{ boxShadow: buildGlowShadow(c.hex, si) }}>
                    {src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* More Glow Colors */}
      <div className="pft-border-divider" />
      <div style={{ position: "relative" }}>
        <button
          className="pft-border-action"
          style={{ justifyContent: "space-between" }}
          onMouseEnter={() => setColorPicker(true)}
          onMouseLeave={() => setColorPicker(false)}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MdColorLens style={{ fontSize: 15 }} /> More Glow Colors
          </span>
          <MdChevronRight />
        </button>
        {colorPicker && (
          <div
            className="pft-border-popover"
            style={{ left: "100%", top: 0, bottom: "auto", minWidth: 200, padding: 10 }}
            onMouseEnter={() => setColorPicker(true)}
            onMouseLeave={() => setColorPicker(false)}
          >
            <div className="pft-border-section-label">Theme Colors</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 2, marginBottom: 8 }}>
              {THEME_COLORS_GLOW.map((hex) => (
                <button key={hex} className="pft-border-swatch"
                  style={{ background: hex, border: "1px solid #d1d5db" }}
                  title={hex}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyColor(hex); }}
                />
              ))}
            </div>
            <div className="pft-border-section-label">Standard Colors</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 2 }}>
              {STD_COLORS_GLOW.map((hex) => (
                <button key={hex} className="pft-border-swatch"
                  style={{ background: hex }}
                  title={hex}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyColor(hex); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SoftEdgesSubPanel({ src, activeId, onSelect, onHover, onHoverClear }) {
  const none = SOFT_EDGES_PRESETS[0];
  const variations = SOFT_EDGES_PRESETS.slice(1).map((p) => ({
    ...p,
    _imgStyle: {
      WebkitMaskImage: `radial-gradient(ellipse at center, black ${p.stop}%, transparent 100%)`,
      maskImage: `radial-gradient(ellipse at center, black ${p.stop}%, transparent 100%)`,
    },
  }));
  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel">
      <div>
        <div className="pft-fx-preset-section-title">No Soft Edges</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1,1fr)" }}>
          <button
            className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
            title="No Soft Edges"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(none); }}
            onMouseEnter={() => onHover?.(none)} onMouseLeave={() => onHoverClear?.()}
          >
            <div className="pft-fx-thumb">{src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}</div>
          </button>
        </div>
      </div>
      <div>
        <div className="pft-fx-preset-section-title">Soft Edge Variations</div>
        <div className="pft-fx-preset-grid">
          {variations.map((p) => (
            <button
              key={p.id}
              className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
              title={p.label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
              onMouseEnter={() => onHover?.(p)} onMouseLeave={() => onHoverClear?.()}
            >
              <div className="pft-fx-thumb">
                {src
                  ? <img src={src} alt="" style={p._imgStyle} />
                  : <div className="pft-corr-placeholder" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BevelSubPanel({ src, activeId, onSelect, onHover, onHoverClear }) {
  const none = BEVEL_PRESETS[0];
  const bevels = BEVEL_PRESETS.slice(1);
  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel">
      <div>
        <div className="pft-fx-preset-section-title">No Bevel</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1,1fr)" }}>
          <button
            className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
            title="No Bevel"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(none); }}
            onMouseEnter={() => onHover?.(none)} onMouseLeave={() => onHoverClear?.()}
          >
            <div className="pft-fx-thumb">{src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}</div>
          </button>
        </div>
      </div>
      <div>
        <div className="pft-fx-preset-section-title">Bevel</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {bevels.map((p) => (
            <button
              key={p.id}
              className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
              title={p.label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
              onMouseEnter={() => onHover?.(p)} onMouseLeave={() => onHoverClear?.()}
            >
              <div className="pft-fx-thumb" style={{ boxShadow: p.bevel }}>
                {src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROT3D_SECTIONS = [
  { key: "parallel",    title: "Parallel",    cols: 4 },
  { key: "perspective", title: "Perspective", cols: 4 },
  { key: "oblique",     title: "Oblique",     cols: 4 },
];

function Rotation3DSubPanel({ src, activeId, onSelect, onHover, onHoverClear }) {
  const none = ROTATION3D_PRESETS[0];
  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel" style={{ minWidth: 240 }}>
      <div>
        <div className="pft-fx-preset-section-title">No Rotation</div>
        <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: "repeat(1,1fr)" }}>
          <button
            className={`pft-fx-sub-item${activeId === "none" ? " pft-fx-sub-item--active" : ""}`}
            title="No Rotation"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(none); }}
            onMouseEnter={() => onHover?.(none)} onMouseLeave={() => onHoverClear?.()}
          >
            <div className="pft-fx-thumb">{src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}</div>
          </button>
        </div>
      </div>
      {ROT3D_SECTIONS.map((sec) => {
        const items = ROTATION3D_PRESETS.filter((p) => p.section === sec.key);
        return (
          <div key={sec.key}>
            <div className="pft-fx-preset-section-title">{sec.title}</div>
            <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: `repeat(${sec.cols},1fr)` }}>
              {items.map((p) => {
                const t = p.transform?.replace("perspective(none) ", "") ?? "";
                return (
                  <button
                    key={p.id}
                    className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
                    title={p.label}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
                    onMouseEnter={() => onHover?.(p)} onMouseLeave={() => onHoverClear?.()}
                  >
                    <div className="pft-fx-thumb" style={{ transform: t, transformOrigin: "center center", overflow: "visible" }}>
                      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="pft-corr-placeholder" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShadowSubPanel({ src, activeId, onSelect, onHover, onHoverClear }) {
  return (
    <div className="pft-fx-preset-panel pft-fx-shadow-panel">
      {SHADOW_SECTIONS.map((sec) => {
        const items = SHADOW_PRESETS.filter((p) => p.section === sec.key);
        if (!items.length) return null;
        return (
          <div key={sec.key}>
            <div className="pft-fx-preset-section-title">{sec.title}</div>
            <div className="pft-fx-preset-grid" style={{ gridTemplateColumns: sec.key === "none" ? "repeat(1,1fr)" : "repeat(3,1fr)" }}>
              {items.map((p) => (
                <button
                  key={p.id}
                  className={`pft-fx-sub-item${activeId === p.id ? " pft-fx-sub-item--active" : ""}`}
                  title={p.label}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(p); }}
                  onMouseEnter={() => onHover?.(p)}
                  onMouseLeave={() => onHoverClear?.()}
                >
                  <div className="pft-fx-thumb" style={p.shadow ? { boxShadow: p.shadow } : {}}>
                    {src ? <img src={src} alt="" /> : <div className="pft-corr-placeholder" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EffectSubItem({ preset, active, onSelect, src }) {
  const style = {};
  if (preset.shadow)    style.boxShadow = preset.shadow;
  if (preset.bevel)     style.boxShadow = preset.bevel;
  if (preset.transform) style.transform = preset.transform;
  if (preset.stop != null) {
    style.WebkitMaskImage = `radial-gradient(ellipse at center, black ${preset.stop}%, transparent 100%)`;
    style.maskImage = style.WebkitMaskImage;
  }

  return (
    <button
      className={`pft-fx-sub-item${active ? " pft-fx-sub-item--active" : ""}`}
      title={preset.label}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(preset); }}
    >
      <div className="pft-fx-thumb" style={style}>
        {src
          ? <img src={src} alt="" />
          : <div className="pft-corr-placeholder" />}
      </div>
      <span>{preset.label}</span>
    </button>
  );
}

function PictureEffectsPopover({ src, effects, onUpdate, anchorRect, onPreviewEffects }) {
  const [sub, setSub] = useState(null);

  const preview = (partialEffects) => onPreviewEffects?.(partialEffects);
  const clearPreview = () => onPreviewEffects?.(null);
  useEffect(() => () => onPreviewEffects?.(null), [onPreviewEffects]);

  const applyGlow = (preset) => {
    clearPreview();
    if (!preset || preset.id === "none") {
      onUpdate({ effects: { ...effects, glowId: "none", _glowShadow: undefined, _glowColor: undefined } });
    } else {
      onUpdate({ effects: { ...effects, glowId: preset.id, _glowShadow: preset.shadow, _glowColor: preset.color } });
    }
  };

  const previewGlow = (preset) => {
    if (!preset || preset.id === "none") preview({ glowId: "none", _glowShadow: undefined });
    else preview({ glowId: preset.id, _glowShadow: preset.shadow });
  };

  const apply = (key, preset) => {
    clearPreview();
    if (key === "presetId") {
      const PRESET_KEYS = ["shadowId", "bevelId", "rotation3dId"];
      const cleared = PRESET_KEYS.reduce((acc, k) => ({ ...acc, [k]: undefined }), {});
      onUpdate({ effects: { ...effects, ...cleared, ...preset.effects, presetId: preset.id } });
    } else {
      onUpdate({ effects: { ...effects, [key]: preset.id } });
    }
  };

  const previewKey = (key, preset) => {
    if (key === "presetId") {
      preview({
        shadowId: undefined,
        bevelId: undefined,
        rotation3dId: undefined,
        ...preset.effects,
      });
    } else {
      preview({ [key]: preset.id });
    }
  };

  const hasEffect = FX_MENU.some((m) => effects[m.key] && effects[m.key] !== "none");

  return (
    <Popover anchorRect={anchorRect}>
      {FX_MENU.map((m) => (
        <div
          key={m.key}
          className="pft-fx-row"
          onMouseEnter={() => setSub(m.key)}
          onMouseLeave={() => { setSub(null); clearPreview(); }}
        >
          <span className="pft-fx-icon">{m.icon}</span>
          <span className="pft-fx-label">{m.label}</span>
          <MdChevronRight className="pft-fx-arrow" />
          {sub === m.key && (
            m.special === "preset"
              ? <PresetSubPanel src={src} effects={effects} onSelect={(p) => apply("presetId", p)} onHover={(p) => previewKey("presetId", p)} onHoverClear={clearPreview} />
              : m.special === "shadow"
              ? <ShadowSubPanel src={src} activeId={effects.shadowId ?? "none"} onSelect={(p) => apply("shadowId", p)} onHover={(p) => previewKey("shadowId", p)} onHoverClear={clearPreview} />
              : m.special === "reflection"
              ? <ReflectionSubPanel src={src} activeId={effects.reflectionId ?? "none"} onSelect={(p) => apply("reflectionId", p)} onHover={(p) => previewKey("reflectionId", p)} onHoverClear={clearPreview} />
              : m.special === "glow"
              ? <GlowSubPanel src={src} activeId={effects.glowId ?? "none"} onApply={applyGlow} onHover={previewGlow} onHoverClear={clearPreview} />
              : m.special === "softEdges"
              ? <SoftEdgesSubPanel src={src} activeId={effects.softEdgesId ?? "none"} onSelect={(p) => apply("softEdgesId", p)} onHover={(p) => previewKey("softEdgesId", p)} onHoverClear={clearPreview} />
              : m.special === "bevel"
              ? <BevelSubPanel src={src} activeId={effects.bevelId ?? "none"} onSelect={(p) => apply("bevelId", p)} onHover={(p) => previewKey("bevelId", p)} onHoverClear={clearPreview} />
              : m.special === "rotation3d"
              ? <Rotation3DSubPanel src={src} activeId={effects.rotation3dId ?? "none"} onSelect={(p) => apply("rotation3dId", p)} onHover={(p) => previewKey("rotation3dId", p)} onHoverClear={clearPreview} />
              : <div className="pft-fx-sub">
                  {m.presets.map((p) => (
                    <EffectSubItem
                      key={p.id}
                      preset={p}
                      src={src}
                      active={effects[m.key] === p.id}
                      onSelect={(preset) => apply(m.key, preset)}
                    />
                  ))}
                </div>
          )}
        </div>
      ))}
      {hasEffect && (
        <>
          <div className="pft-border-divider" />
          <button className="pft-border-action"
            onMouseDown={(e) => {
              e.preventDefault();
              const cleaned = { ...effects };
              FX_MENU.forEach((m) => delete cleaned[m.key]);
              delete cleaned._glowShadow;
              delete cleaned._glowColor;
              onUpdate({ effects: cleaned });
            }}>
            ↺ Remove All Effects
          </button>
        </>
      )}
    </Popover>
  );
}

const TRANSPARENCY_PRESETS = [0, 15, 30, 50, 65, 80, 95];

function TransparencyPopover({ src, opacity, onUpdate, anchorRect, onBeginHistory, onCommitHistory }) {
  return (
    <Popover anchorRect={anchorRect} wide>
      <div className="pft-transp-row">
        {TRANSPARENCY_PRESETS.map((t) => {
          const opacityVal = (100 - t) / 100;
          const active = Math.abs(opacity - (100 - t)) < 3;
          return (
            <button
              key={t}
              className={`pft-transp-cell${active ? " pft-transp-cell--active" : ""}`}
              title={`Transparency: ${t}%`}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onUpdate({ opacity: opacityVal }); }}
            >
              <div className="pft-transp-thumb">
                {src
                  ? <img src={src} alt="" style={{ opacity: opacityVal }} />
                  : <div className="pft-corr-placeholder" style={{ opacity: opacityVal }} />}
              </div>
              <span className="pft-transp-label">{t}%</span>
            </button>
          );
        })}
      </div>
      <div className="pft-color-footer">
        <SliderRow label="Transparency" min={0} max={100}
          value={100 - opacity}
          onChange={(v) => onUpdate({ opacity: (100 - v) / 100 })}
          onBeginHistory={onBeginHistory} onCommitHistory={onCommitHistory} />
      </div>
    </Popover>
  );
}

function ArtisticPopover({ src, effects, onUpdate, anchorRect }) {
  const currentId = effects.artisticId ?? "none";

  const apply = useCallback((preset) => {
    onUpdate({ effects: { ...effects, artisticId: preset.id } });
  }, [effects, onUpdate]);

  return (
    <Popover anchorRect={anchorRect} wide>
      <div className="pft-art-grid">
        {ARTISTIC_EFFECTS.map((p) => {
          const style = p.filter ? { filter: p.filter } : undefined;
          return (
            <button
              key={p.id}
              className={`pft-art-cell${currentId === p.id ? " pft-art-cell--active" : ""}`}
              title={p.label}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); apply(p); }}
            >
              <div className="pft-art-thumb">
                {src
                  ? <img src={src} alt="" style={style} />
                  : <div className="pft-corr-placeholder" style={style} />}
              </div>
              <span className="pft-art-label">{p.label}</span>
            </button>
          );
        })}
      </div>
      <div className="pft-color-footer">
        <button className="pft-color-link"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); apply(ARTISTIC_EFFECTS[0]); }}>
          ↺ Reset Effect
        </button>
      </div>
    </Popover>
  );
}

export default function PictureFormatTab({ media, onUpdate, onCrop, onBringForward, onSendBackward, onChangePicture, onPreviewEffects, onPreviewStyle, onBeginHistory, onCommitHistory, isSlideMasterOpen = false, showAltText = false, onToggleAltText }) {
  const resolvedSrc = useMediaSrc(media?.["file-link"]);
  const [openPopover, setOpenPopover] = useState(null);
  const [popoverAnchorRect, setPopoverAnchorRect] = useState(null);
  const [showAltPanelMaster, setShowAltPanelMaster] = useState(false);
  const showAltPanel = isSlideMasterOpen ? showAltPanelMaster : showAltText;
  const toggleAltPanel = () => {
    if (isSlideMasterOpen) setShowAltPanelMaster((v) => !v);
    else onToggleAltText?.();
  };
  const closeAltPanel = () => {
    if (isSlideMasterOpen) setShowAltPanelMaster(false);
    else onToggleAltText?.(false);
  };
  const isImage = media?.["media-type"] !== "video";

  useEffect(() => {
    if (!isImage && showAltPanel) closeAltPanel();
  }, [isImage]);
  const changeInputRef = useRef(null);
  const [stylePickerPos, setStylePickerPos] = useState(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const GALLERY_PER_PAGE = 6;
  const [lockedRatio, setLockedRatio] = useState(true);
  const [sizeDraft, setSizeDraft] = useState(() => ({
    mediaId: media?.id,
    width: String(Math.round(media?.width ?? 0)),
    height: String(Math.round(media?.height ?? 0)),
  }));
  const localW = sizeDraft.mediaId === media?.id
    ? sizeDraft.width
    : String(Math.round(media?.width ?? 0));
  const localH = sizeDraft.mediaId === media?.id
    ? sizeDraft.height
    : String(Math.round(media?.height ?? 0));

  const brightnessRef = useRef(null);
  const colorRef = useRef(null);
  const artisticRef = useRef(null);
  const opacityRef = useRef(null);
  const borderRef = useRef(null);
  const fxRef = useRef(null);

  if (!media) return null;

  const effects = media.effects ?? {};
  const brightness = Math.round((effects.brightness ?? 0) * 100);
  const contrast   = Math.round((effects.contrast   ?? 0) * 100);
  const opacity    = Math.round((media.opacity ?? 1) * 100);
  const currentTint     = effects.tintId     ?? "none";
  const currentArtistic = effects.artisticId ?? "none";
  const currentStyleId  = effects["style-id"] ?? "none";

  const toggle = (name, event) => {
    setPopoverAnchorRect(event?.currentTarget?.getBoundingClientRect() ?? null);
    setOpenPopover((p) => (p === name ? null : name));
  };

  const applySize = (w, h) => {
    const nw = parseFloat(w);
    const nh = parseFloat(h);
    if (Number.isFinite(nw) && nw > 0 && Number.isFinite(nh) && nh > 0) {
      onUpdate?.({ width: nw, height: nh });
    }
  };

  const onWChange = (e) => {
    const val = e.target.value;
    let nextHeight = localH;
    if (lockedRatio && (media.width ?? 0) > 0) {
      nextHeight = String(Math.round(parseFloat(val) * (media.height / media.width)) || "");
    }
    setSizeDraft({ mediaId: media?.id, width: val, height: nextHeight });
  };

  const onHChange = (e) => {
    const val = e.target.value;
    let nextWidth = localW;
    if (lockedRatio && (media.height ?? 0) > 0) {
      nextWidth = String(Math.round(parseFloat(val) * (media.width / media.height)) || "");
    }
    setSizeDraft({ mediaId: media?.id, width: nextWidth, height: val });
  };

  const onSizeKey = (e) => { if (e.key === "Enter") applySize(localW, localH); };

  return (
    <>
      {/* ── Adjust ──────────────────────────────────────── */}
      <div className="ribbon-group">
        <div className="pft-row">
          <div style={{ position: "relative" }}>
            <button ref={brightnessRef} className={`toolbar-item${brightness !== 0 || contrast !== 0 ? " pft-active" : ""}`} onClick={(e) => toggle("brightness", e)} title="Brightness / Contrast">
              <MdTune /><span>Corrections</span>
            </button>
            {openPopover === "brightness" && (
              <CorrectionsPopover
                src={resolvedSrc}
                effects={effects}
                onUpdate={onUpdate}
                anchorRect={popoverAnchorRect}
                onBeginHistory={onBeginHistory}
                onCommitHistory={onCommitHistory}
              />
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button ref={colorRef} className={`toolbar-item${currentTint !== "none" ? " pft-active" : ""}`} onClick={(e) => toggle("color", e)} title="Color">
              <MdColorLens /><span>Color</span>
            </button>
            {openPopover === "color" && (
              <ColorPopover
                src={resolvedSrc}
                effects={effects}
                onUpdate={onUpdate}
                anchorRect={popoverAnchorRect}
              />
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button ref={artisticRef} className={`toolbar-item${currentArtistic !== "none" ? " pft-active" : ""}`} onClick={(e) => toggle("artistic", e)} title="Artistic Effects">
              <MdAutoAwesome /><span>Artistic</span>
            </button>
            {openPopover === "artistic" && (
              <ArtisticPopover
                src={resolvedSrc}
                effects={effects}
                onUpdate={onUpdate}
                anchorRect={popoverAnchorRect}
              />
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button ref={opacityRef} className={`toolbar-item${opacity < 100 ? " pft-active" : ""}`} onClick={(e) => toggle("opacity", e)} title="Transparency">
              <MdOpacity /><span>Transparency</span>
            </button>
            {openPopover === "opacity" && (
              <TransparencyPopover
                src={resolvedSrc}
                opacity={opacity}
                onUpdate={onUpdate}
                anchorRect={popoverAnchorRect}
                onBeginHistory={onBeginHistory}
                onCommitHistory={onCommitHistory}
              />
            )}
          </div>
        </div>

        <div className="pft-row pft-row--reset">
          <button className="toolbar-item" onClick={() => {
            const [ct = 0, cr = 0, cb = 0, cl = 0] = media.crop ?? [];
            const wFrac = 1 - cl / 100 - cr / 100;
            const hFrac = 1 - ct / 100 - cb / 100;
            const updates = { effects: {}, opacity: 1, crop: undefined, "source-width": undefined, "source-height": undefined };
            if (wFrac > 0.001 && hFrac > 0.001 && (ct || cr || cb || cl)) {
              const origW = Math.round((media.width ?? 0) / wFrac);
              const origH = Math.round((media.height ?? 0) / hFrac);
              updates.position = {
                x: Math.round((media.position?.x ?? 0) - (cl / 100) * origW),
                y: Math.round((media.position?.y ?? 0) - (ct / 100) * origH),
              };
              updates.width = origW;
              updates.height = origH;
            }
            onUpdate(updates);
          }} title="Reset Picture">
            <MdRestartAlt /><span>Reset</span>
          </button>
          <button className="toolbar-item" onClick={() => changeInputRef.current?.click()} title="Change Picture">
            <MdImage /><span>Change</span>
          </button>
          <input
            ref={changeInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChangePicture?.(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="ribbon-group-title">Adjust</div>
      </div>

      {/* ── Picture Styles ───────────────────────────────── */}
      <div className="ribbon-group ribbon-group--nogap">
        <div className="pft-ribbon-gallery">
          <div className="pft-ribbon-gallery-track" onMouseLeave={() => onPreviewStyle?.(null)}>
            {Array.from({ length: GALLERY_PER_PAGE }, (_, i) => {
              const s = IMAGE_STYLES[galleryPage * GALLERY_PER_PAGE + i];
              if (!s) return <div key={i} className="pft-ribbon-thumb pft-ribbon-thumb--empty" />;
              return (
                <button
                  key={s.id}
                  className={`pft-ribbon-thumb${currentStyleId === s.id ? " pft-ribbon-thumb--active" : ""}`}
                  title={s.label}
                  onMouseEnter={() => onPreviewStyle?.(s.id)}
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onPreviewStyle?.(null); onUpdate({ effects: { ...effects, "style-id": s.id } }); }}
                >
                  <img src={SVG_PREVIEW} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", ...s.css }} />
                </button>
              );
            })}
          </div>
          <div className="pft-ribbon-gallery-nav">
            <button
              className="pft-ribbon-nav-btn"
              disabled={galleryPage === 0}
              onMouseDown={(e) => { e.preventDefault(); setGalleryPage((p) => Math.max(0, p - 1)); }}
              title="Previous"
            ><MdKeyboardArrowUp /></button>
            <button
              className="pft-ribbon-nav-btn"
              disabled={(galleryPage + 1) * GALLERY_PER_PAGE >= IMAGE_STYLES.length}
              onMouseDown={(e) => { e.preventDefault(); setGalleryPage((p) => p + 1); }}
              title="Next"
            ><MdKeyboardArrowDown /></button>
            <button
              className="pft-ribbon-nav-btn pft-ribbon-nav-btn--expand"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setStylePickerPos({ x: r.left, y: r.bottom + 4 }); setOpenPopover((p) => p === "style" ? null : "style"); }}
              title="More Styles"
            ><MdApps /></button>
          </div>
        </div>
        {openPopover === "style" && stylePickerPos && (
          <ImageStylePicker
            position={stylePickerPos}
            currentStyleId={currentStyleId}
            onPreview={(id) => onPreviewStyle?.(id)}
            onSelect={(id) => { onPreviewStyle?.(null); onUpdate({ effects: { ...effects, "style-id": id } }); setOpenPopover(null); }}
            onClose={() => { onPreviewStyle?.(null); setOpenPopover(null); }}
          />
        )}
        <div style={{ position: "relative" }}>
          <button
            ref={borderRef}
            className={`toolbar-item${effects.border?.color ? " pft-active" : ""}`}
            onClick={(e) => toggle("border", e)}
            title="Picture Border"
          >
            <MdOutlineBorderColor /><span>Picture Border</span>
          </button>
          {openPopover === "border" && (
            <PictureBorderPopover
              effects={effects}
              onUpdate={onUpdate}
              anchorRect={popoverAnchorRect}
            />
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button
            ref={fxRef}
            className={`toolbar-item${FX_MENU.some((m) => effects[m.key] && effects[m.key] !== "none") ? " pft-active" : ""}`}
            onClick={(e) => toggle("fx", e)}
            title="Picture Effects"
          >
            <MdAutoAwesome /><span>Picture Effects</span>
          </button>
          {openPopover === "fx" && (
            <PictureEffectsPopover
              src={resolvedSrc}
              effects={effects}
              onUpdate={onUpdate}
              onClose={() => setOpenPopover(null)}
              anchorRect={popoverAnchorRect}
              onPreviewEffects={onPreviewEffects}
            />
          )}
        </div>
        <div className="ribbon-group-title">Picture Styles</div>
      </div>

      {/* ── Accessibility ────────────────────────────────── */}
      <div className="ribbon-group">
        <button
          className={`toolbar-item${showAltPanel ? " pft-active" : ""}`}
          onClick={toggleAltPanel}
          title={isImage ? "Alt Text" : "Alt Text is not supported for video"}
          disabled={!isImage}
        >
          <MdAccessibility /><span>Alt Text</span>
        </button>
        <div className="ribbon-group-title">Accessibility</div>
      </div>

      {isSlideMasterOpen && showAltPanel && (
        <AltTextPanel
          media={media}
          onUpdate={onUpdate}
          onClose={closeAltPanel}
          overlay
        />
      )}

      {/* ── Arrange ─────────────────────────────────────── */}
      <div className="ribbon-group">
        <button className="toolbar-item" onClick={onBringForward} title="Bring Forward">
          <MdFlipToFront /><span>Bring Forward</span>
        </button>
        <button className="toolbar-item" onClick={onSendBackward} title="Send Backward">
          <MdFlipToBack /><span>Send Backward</span>
        </button>
        <div className="ribbon-group-title">Arrange</div>
      </div>

      {/* ── Size ────────────────────────────────────────── */}
      <div className="ribbon-group">
        <button className="toolbar-item" onClick={() => {
          setOpenPopover(null);
          onPreviewEffects?.(null);
          onPreviewStyle?.(null);
          onCrop?.();
        }} title="Crop">
          <MdCrop /><span>Crop</span>
        </button>
        <div className="pft-size-block">
          <label className="pft-size-label">
            <span>Height</span>
            <input
              className="pft-size-input" value={localH}
              onChange={onHChange}
              onBlur={() => applySize(localW, localH)}
              onKeyDown={onSizeKey}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </label>
          <div className="pft-lock-row">
            <button
              className={`pft-lock-btn${lockedRatio ? " pft-lock-btn--active" : ""}`}
              title={lockedRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setLockedRatio((v) => !v); }}
            >
              {lockedRatio ? <MdLock /> : <MdLockOpen />}
            </button>
          </div>
          <label className="pft-size-label">
            <span>Width</span>
            <input
              className="pft-size-input" value={localW}
              onChange={onWChange}
              onBlur={() => applySize(localW, localH)}
              onKeyDown={onSizeKey}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </label>
        </div>
        <div className="ribbon-group-title">Size</div>
      </div>
    </>
  );
}

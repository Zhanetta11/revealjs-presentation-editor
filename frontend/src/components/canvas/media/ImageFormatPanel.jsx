import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MdTune,
  MdColorLens,
  MdOpacity,
  MdRestartAlt,
  MdFlipToFront,
  MdFlipToBack,
  MdCrop,
  MdLock,
  MdLockOpen,
  MdAccessibility,
  MdAutoAwesome,
} from "react-icons/md";
import { PiFrameCornersBold } from "react-icons/pi";
import ImageStylePicker from "./ImageStylePicker";
import "./ImageFormatPanel.css";

const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

function Divider() {
  return <div className="ifp-divider" />;
}

function Group({ label, children }) {
  return (
    <div className="ifp-group">
      <div className="ifp-group-btns">{children}</div>
      <div className="ifp-group-label">{label}</div>
    </div>
  );
}

function Btn({ icon, label, active, disabled, title, onClick }) {
  return (
    <button
      className={`ifp-btn${active ? " ifp-btn--active" : ""}`}
      disabled={disabled}
      title={title ?? label}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onClick?.(); }}
    >
      <span className="ifp-btn-icon">{icon}</span>
      {label && <span className="ifp-btn-label">{label}</span>}
    </button>
  );
}

function BrightnessPopover({ brightness = 0, contrast = 0, onChange, onClose, onBeginHistory, onCommitHistory }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="ifp-popover" onMouseDown={stop}>
      <div className="ifp-popover-title">Коррекция</div>
      <label className="ifp-slider-label">
        Яркость
        <input type="range" min="-100" max="100" value={Math.round(brightness * 100)}
          onMouseDown={onBeginHistory}
          onMouseUp={onCommitHistory}
          onChange={(e) => onChange({ brightness: e.target.value / 100, contrast })} />
        <span className="ifp-slider-val">{Math.round(brightness * 100)}</span>
      </label>
      <label className="ifp-slider-label">
        Контраст
        <input type="range" min="-100" max="100" value={Math.round(contrast * 100)}
          onMouseDown={onBeginHistory}
          onMouseUp={onCommitHistory}
          onChange={(e) => onChange({ brightness, contrast: e.target.value / 100 })} />
        <span className="ifp-slider-val">{Math.round(contrast * 100)}</span>
      </label>
    </div>
  );
}

function OpacityPopover({ opacity = 1, onChange, onClose, onBeginHistory, onCommitHistory }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="ifp-popover" onMouseDown={stop}>
      <div className="ifp-popover-title">Прозрачность</div>
      <label className="ifp-slider-label">
        Непрозрачность
        <input type="range" min="0" max="100" value={Math.round(opacity * 100)}
          onMouseDown={onBeginHistory}
          onMouseUp={onCommitHistory}
          onChange={(e) => onChange(e.target.value / 100)} />
        <span className="ifp-slider-val">{Math.round(opacity * 100)}%</span>
      </label>
    </div>
  );
}

const COLOR_TINTS = [
  { id: "none",      label: "Исходный",  filter: "none" },
  { id: "grayscale", label: "Ч/Б",       filter: "grayscale(100%)" },
  { id: "sepia",     label: "Сепия",     filter: "sepia(80%)" },
  { id: "washout",   label: "Размытый",  filter: "brightness(1.4) saturate(0.3)" },
  { id: "cool",      label: "Холодный",  filter: "hue-rotate(200deg) saturate(1.3)" },
  { id: "warm",      label: "Тёплый",    filter: "sepia(40%) saturate(1.5) hue-rotate(-10deg)" },
  { id: "vivid",     label: "Яркий",     filter: "saturate(2)" },
  { id: "invert",    label: "Инверсия",  filter: "invert(100%)" },
];

function ColorTintPopover({ currentTint, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="ifp-popover ifp-tint-popover" onMouseDown={stop}>
      <div className="ifp-popover-title">Цвет</div>
      <div className="ifp-tint-grid">
        {COLOR_TINTS.map((t) => (
          <button
            key={t.id}
            className={`ifp-tint-cell${currentTint === t.id ? " ifp-tint-cell--active" : ""}`}
            title={t.label}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onChange(t.id, t.filter); onClose(); }}
          >
            <div className="ifp-tint-preview" style={{ filter: t.filter }} />
            <span className="ifp-tint-name">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const ARTISTIC_EFFECTS = [
  { id: "none",        label: "Нет",          filter: "none" },
  { id: "blur",        label: "Размытие",     filter: "blur(4px)" },
  { id: "sharpen",     label: "Резкость",     filter: "contrast(1.4) brightness(1.05)" },
  { id: "glow",        label: "Свечение",     filter: "brightness(1.3) saturate(1.5) blur(0.5px)" },
  { id: "pencil",      label: "Карандаш",     filter: "grayscale(100%) contrast(2) brightness(0.8)" },
  { id: "watercolor",  label: "Акварель",     filter: "saturate(1.8) brightness(1.1) blur(0.8px)" },
  { id: "mosaic",      label: "Мозаика",      filter: "contrast(1.5) saturate(1.3)" },
  { id: "film-grain",  label: "Зернистость",  filter: "contrast(1.2) saturate(0.8) brightness(0.95)" },
];

function ArtisticPopover({ currentEffect, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="ifp-popover ifp-tint-popover" onMouseDown={stop}>
      <div className="ifp-popover-title">Художественные эффекты</div>
      <div className="ifp-tint-grid">
        {ARTISTIC_EFFECTS.map((ef) => (
          <button
            key={ef.id}
            className={`ifp-tint-cell${currentEffect === ef.id ? " ifp-tint-cell--active" : ""}`}
            title={ef.label}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onChange(ef.id, ef.filter); onClose(); }}
          >
            <div className="ifp-tint-preview" style={{ filter: ef.filter }} />
            <span className="ifp-tint-name">{ef.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ImageFormatPanel({ media, position, onUpdate, onCrop, onBringForward, onSendBackward, onBeginHistory, onCommitHistory }) {
  const [openPopover, setOpenPopover] = useState(null);
  const [stylePickerPos, setStylePickerPos] = useState(null);
  const [lockedRatio, setLockedRatio] = useState(true);
  const [sizeDraft, setSizeDraft] = useState(() => ({
    mediaId: media.id,
    width: String(Math.round(media.width ?? 0)),
    height: String(Math.round(media.height ?? 0)),
  }));
  const localW = sizeDraft.mediaId === media.id
    ? sizeDraft.width
    : String(Math.round(media.width ?? 0));
  const localH = sizeDraft.mediaId === media.id
    ? sizeDraft.height
    : String(Math.round(media.height ?? 0));

  const effects = media.effects ?? {};
  const brightness = effects.brightness ?? 0;
  const contrast   = effects.contrast   ?? 0;
  const opacity    = media.opacity ?? 1;
  const currentTint    = effects.tintId    ?? "none";
  const currentArtistic = effects.artisticId ?? "none";
  const currentStyleId = effects["style-id"] ?? "none";

  const toggle = (name) => setOpenPopover((p) => (p === name ? null : name));

  const openStylePicker = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setStylePickerPos({ x: rect.left, y: rect.bottom + 4 });
    setOpenPopover("style");
  };

  const commitSize = (w, h) => {
    const nw = parseFloat(w);
    const nh = parseFloat(h);
    if (Number.isFinite(nw) && nw > 0 && Number.isFinite(nh) && nh > 0) {
      onUpdate({ width: nw, height: nh });
    }
  };

  const onWChange = (e) => {
    const val = e.target.value;
    let nextHeight = localH;
    if (lockedRatio && media.width > 0) {
      const ratio = (media.height ?? 0) / media.width;
      nextHeight = String(Math.round(parseFloat(val) * ratio) || "");
    }
    setSizeDraft({ mediaId: media.id, width: val, height: nextHeight });
  };

  const onHChange = (e) => {
    const val = e.target.value;
    let nextWidth = localW;
    if (lockedRatio && media.height > 0) {
      const ratio = (media.width ?? 0) / media.height;
      nextWidth = String(Math.round(parseFloat(val) * ratio) || "");
    }
    setSizeDraft({ mediaId: media.id, width: nextWidth, height: val });
  };

  const onSizeBlur = () => commitSize(localW, localH);
  const onSizeKey = (e) => { if (e.key === "Enter") { e.currentTarget.blur(); commitSize(localW, localH); } };

  const hasBrightnessEffect = brightness !== 0 || contrast !== 0;
  const hasColorTint = currentTint !== "none";
  const hasArtistic = currentArtistic !== "none";
  const hasOpacity = opacity < 1;

  return createPortal(
    <div
      className="image-format-panel"
      style={{ top: position.top, left: position.left }}
      onMouseDown={stop}
    >
      {/* ── Adjust ──────────────────────────────────── */}
      <Group label="Коррекция">
        <div style={{ position: "relative" }}>
          <Btn icon={<MdTune />} label="Яркость" active={hasBrightnessEffect}
            title="Яркость / Контраст"
            onClick={() => toggle("brightness")} />
          {openPopover === "brightness" && (
            <div className="ifp-popover-anchor">
              <BrightnessPopover
                brightness={brightness} contrast={contrast}
                onChange={({ brightness: b, contrast: c }) =>
                  onUpdate({ effects: { ...effects, brightness: b, contrast: c } })}
                onClose={() => setOpenPopover(null)}
                onBeginHistory={onBeginHistory}
                onCommitHistory={onCommitHistory}
              />
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Btn icon={<MdColorLens />} label="Цвет" active={hasColorTint}
            title="Перекраска"
            onClick={() => toggle("color")} />
          {openPopover === "color" && (
            <div className="ifp-popover-anchor">
              <ColorTintPopover
                currentTint={currentTint}
                onChange={(id, filter) => {
                  onBeginHistory?.();
                  onUpdate({ effects: { ...effects, tintId: id, tintFilter: filter } });
                  onCommitHistory?.();
                }}
                onClose={() => setOpenPopover(null)}
              />
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Btn icon={<MdAutoAwesome />} label="Эффект" active={hasArtistic}
            title="Художественные эффекты"
            onClick={() => toggle("artistic")} />
          {openPopover === "artistic" && (
            <div className="ifp-popover-anchor">
              <ArtisticPopover
                currentEffect={currentArtistic}
                onChange={(id, filter) => {
                  onBeginHistory?.();
                  onUpdate({ effects: { ...effects, artisticId: id, artisticFilter: filter } });
                  onCommitHistory?.();
                }}
                onClose={() => setOpenPopover(null)}
              />
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Btn icon={<MdOpacity />} label="Прозрачность" active={hasOpacity}
            title="Прозрачность"
            onClick={() => toggle("opacity")} />
          {openPopover === "opacity" && (
            <div className="ifp-popover-anchor">
              <OpacityPopover
                opacity={opacity}
                onChange={(val) => onUpdate({ opacity: val })}
                onClose={() => setOpenPopover(null)}
                onBeginHistory={onBeginHistory}
                onCommitHistory={onCommitHistory}
              />
            </div>
          )}
        </div>

        <Btn icon={<MdRestartAlt />} label="Сброс"
          title="Сбросить изображение"
          onClick={() => onUpdate({
            effects: {},
            opacity: 1,
            crop: [],
          })} />
      </Group>

      <Divider />

      {/* ── Style ───────────────────────────────────── */}
      <Group label="Стиль">
        <Btn icon={<PiFrameCornersBold />} label="Стиль"
          active={currentStyleId !== "none"}
          title="Стили изображения"
          onClick={openStylePicker} />
        {openPopover === "style" && stylePickerPos && (
          <ImageStylePicker
            media={media}
            position={stylePickerPos}
            currentStyleId={currentStyleId}
            onSelect={(id) => onUpdate({ effects: { ...effects, "style-id": id } })}
            onClose={() => setOpenPopover(null)}
          />
        )}
      </Group>

      <Divider />

      {/* ── Arrange ─────────────────────────────────── */}
      <Group label="Порядок">
        <Btn icon={<MdFlipToFront />} label="Вперёд"
          title="На передний план"
          onClick={onBringForward} />
        <Btn icon={<MdFlipToBack />} label="Назад"
          title="На задний план"
          onClick={onSendBackward} />
      </Group>

      <Divider />

      {/* ── Size ────────────────────────────────────── */}
      <Group label="Размер">
        <div className="ifp-size-group">
          <label className="ifp-size-label">
            <span>Ш</span>
            <input
              className="ifp-size-input"
              value={localW}
              onChange={onWChange}
              onBlur={onSizeBlur}
              onKeyDown={onSizeKey}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </label>
          <button
            className={`ifp-lock-btn${lockedRatio ? " ifp-lock-btn--active" : ""}`}
            title={lockedRatio ? "Разблокировать пропорции" : "Зафиксировать пропорции"}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setLockedRatio((v) => !v); }}
          >
            {lockedRatio ? <MdLock /> : <MdLockOpen />}
          </button>
          <label className="ifp-size-label">
            <span>В</span>
            <input
              className="ifp-size-input"
              value={localH}
              onChange={onHChange}
              onBlur={onSizeBlur}
              onKeyDown={onSizeKey}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </label>
        </div>
      </Group>

      <Divider />

      {/* ── Tools ───────────────────────────────────── */}
      <Group label="Инструменты">
        <Btn icon={<MdCrop />} label="Кроп" title="Обрезка" onClick={onCrop} />
        <Btn icon={<MdAccessibility />} label="Alt текст"
          title="Замещающий текст (Alt)"
          onClick={() => {
            const alt = window.prompt("Замещающий текст (Alt):", media.alt ?? "");
            if (alt !== null) onUpdate({ alt });
          }} />
      </Group>
    </div>,
    document.body,
  );
}

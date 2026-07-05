import { useState, useRef, useEffect } from "react";
import { MdPreview, MdSpeed, MdArrowUpward, MdArrowDownward, MdExpandMore } from "react-icons/md";
import "./AnimationsTab.css";
import { getMaxAnimationSequence, getAnimationDurationMs, findAnimationForElement, getNextAnimationSequence } from "../../../core/operations/animationOperations";
import { ANIMATION_EFFECTS } from "../../../core/model/animationConfig";

export default function AnimationsTab({
  selectedElement,
  animations,
  onAddAnimationForElement,
  onUpdateAnimation,
  onReorderAnimation,
  onDeleteAnimation,
  onAnimationPreview,
}) {
  const animationList = animations ?? [];

  const animation = selectedElement
    ? findAnimationForElement(animationList, selectedElement.id)
    : null;

  const currentEffect = animation?.effect ?? "none";

  const maxSequence = getMaxAnimationSequence(animationList);

  const handleEffectClick = (effectValue) => {
    if (!selectedElement) return;

    if (effectValue === "none") {
      if (animation) onDeleteAnimation?.(animation.id);
      return;
    }

    const speed = animation?.speed ?? 1;

    if (animation) {
      onUpdateAnimation?.(animation.id, { effect: effectValue });
    } else {
      onAddAnimationForElement?.(selectedElement.id, effectValue, getNextAnimationSequence(animationList));
    }

    playPreview(selectedElement.id, effectValue, speed);
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [showEffectOptions, setShowEffectOptions] = useState(false);

  const playPreview = (elementId, effect, speed) => {
    setIsPlaying(true);
    const byParagraph = animation?.["effect-options"]?.sequence === "by-paragraph";
    const paragraphCount = byParagraph ? (selectedElement?.paragraphCount ?? 1) : 1;
    onAnimationPreview?.(elementId, effect, speed, { byParagraph, paragraphCount });

    const duration = getAnimationDurationMs(speed);
    setTimeout(() => setIsPlaying(false), duration * paragraphCount + 100);
  };

  const handlePlay = () => {
    if (!animation || !selectedElement) return;
    playPreview(selectedElement.id, animation.effect, animation.speed);
  };

  const swapSequence = (direction) => {
    if (!animation) return;
    onReorderAnimation?.(animationList, animation.id, direction);
  };

  const canMoveEarlier = animation && (animation.sequence ?? 1) > 1;
  const canMoveLater = animation && (animation.sequence ?? 1) < maxSequence;
  const SEQUENCE_LABELS = {
    "as-one-object": "As One Object",
    "by-paragraph": "By Paragraph",
  };

  const currentSequence = animation?.["effect-options"]?.sequence ?? "as-one-object";

  const effectOptionsRef = useRef(null);

  useEffect(() => {
    if (!showEffectOptions) return;
    const handler = (e) => {
      if (effectOptionsRef.current && !effectOptionsRef.current.contains(e.target)) {
        setShowEffectOptions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEffectOptions]);

  return (
    <>
      <div className="ribbon-group transitions-preview-group">
        <button
          className={`toolbar-item large ${isPlaying ? "is-playing" : ""}`}
          onClick={handlePlay}
          disabled={!animation}
        >
          <MdPreview />
          <span>Preview</span>
        </button>
        <div className="ribbon-group-title">Preview</div>
      </div>

      <div
        className={`ribbon-group ribbon-group--animations ${!selectedElement ? "is-disabled" : ""
          }`}
      >
        {ANIMATION_EFFECTS.map((effect) => {
          const Icon = effect.icon;

          return (
            <button
              key={effect.value}
              className={`effect-card ${currentEffect === effect.value ? "active" : ""
                }`}
              onClick={() => handleEffectClick(effect.value)}
              disabled={!selectedElement}
              title={effect.label}
            >
              <Icon className="effect-card-icon" />
              <span className="effect-card-label">{effect.label}</span>
            </button>
          );
        })}

        <div className="ribbon-group-title">
          {selectedElement ? "Animation" : "Select an element on the slide"}
        </div>
      </div>

      {animation && (
        <div className="ribbon-group ribbon-group--effect-options">
          <div className="effect-options-dropdown" ref={effectOptionsRef}>
            <button
              type="button"
              className="effect-options-trigger"
              onClick={() => setShowEffectOptions((v) => !v)}
            >
              <span>{SEQUENCE_LABELS[currentSequence]}</span>
              <MdExpandMore className="effect-options-chevron" />
            </button>

            {showEffectOptions && (
              <div className="effect-options-menu">
                <div className="effect-options-section-title">Sequence</div>

                {[
                  { value: "as-one-object", label: "As One Object" },
                  { value: "by-paragraph", label: "By Paragraph" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`effect-options-item ${(animation["effect-options"]?.sequence ?? "as-one-object") === option.value
                      ? "active" : ""
                      }`}
                    onClick={() => {
                      onUpdateAnimation?.(animation.id, {
                        "effect-options": {
                          ...animation["effect-options"],
                          sequence: option.value,
                        },
                      });
                      setShowEffectOptions(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ribbon-group-title">Effect Options</div>
        </div>
      )}

      {animation && (
        <>
          <div className="ribbon-group ribbon-group--reorder">
            <div className="reorder-buttons">
              <button
                type="button"
                className="reorder-button"
                onClick={() => swapSequence(-1)}
                disabled={!canMoveEarlier}
              >
                <MdArrowUpward className="reorder-icon" />
                <span>Move Earlier</span>
              </button>

              <button
                type="button"
                className="reorder-button"
                onClick={() => swapSequence(1)}
                disabled={!canMoveLater}
              >
                <MdArrowDownward className="reorder-icon" />
                <span>Move Later</span>
              </button>
            </div>

            <div className="ribbon-group-title">Reorder Animation</div>
          </div>

          <div className="ribbon-group ribbon-group--timing">
            <div className="speed-options">
              {[
                { value: 0.5, label: "Fast" },
                { value: 1, label: "Medium" },
                { value: 2, label: "Slow" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`speed-option ${(animation.speed ?? 1) === option.value ? "active" : ""
                    }`}
                  onClick={() =>
                    onUpdateAnimation?.(animation.id, { speed: option.value })
                  }
                >
                  <MdSpeed className="speed-option-icon" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <div className="ribbon-group-title">Speed</div>
          </div>
        </>
      )}
    </>
  );
}
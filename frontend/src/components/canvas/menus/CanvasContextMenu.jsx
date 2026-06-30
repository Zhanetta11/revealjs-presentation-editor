import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdContentCopy,
  MdContentCut,
  MdContentPaste,
  MdImage,
  MdRedo,
  MdSearch,
  MdTextFields,
  MdUndo,
} from "react-icons/md";
import FontDialog from "../dialogs/FontDialog";
import HyperlinkDialog from "../dialogs/HyperlinkDialog";
import ParagraphDialog from "../dialogs/ParagraphDialog";
import CanvasSelectionMenu from "./context-menu/CanvasSelectionMenu";
import {
  ContextMenuItem,
  PasteOptionButton,
} from "./context-menu/ContextMenuItem";
import TextFormattingMenu from "./context-menu/TextFormattingMenu";
import "./CanvasContextMenu.css";

export default function CanvasContextMenu({
  x,
  y,
  hasSelection,
  contextType = "canvas",
  elementId,
  formatting = {},
  presentation,
  canPaste,
  canUndo,
  canRedo,
  onClose,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onPasteText,
  onPastePicture,
  onDelete,
  onSelectAll,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onRotateRight,
  onNewComment,
  onHyperlink,
  onRemoveHyperlink,
  existingHyperlink = null,
  hyperlinkText = "",
  textSelection = null,
  onExitEditText,
  onFormatText,
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [search, setSearch] = useState("");
  const [submenu, setSubmenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [pasteError, setPasteError] = useState("");
  const isText = contextType === "text";
  const matches = (label) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const margin = 8;
    const rect = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(
        margin,
        Math.min(x, window.innerWidth - rect.width - margin),
      ),
      top: Math.max(
        margin,
        Math.min(y, window.innerHeight - rect.height - margin),
      ),
    });
  }, [x, y]);

  useLayoutEffect(() => {
    const close = (event) => {
      if (!dialog && !menuRef.current?.contains(event.target)) onClose?.();
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    const closeOnBlur = () => { if (!dialog) onClose?.(); };

    document.addEventListener("mousedown", close);
    window.addEventListener("blur", closeOnBlur);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);

    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("blur", closeOnBlur);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [dialog, onClose]);

  const run = async (action) => {
    setPasteError("");
    try {
      const result = await action?.();
      if (result === false) {
        setPasteError("Clipboard content is not available for this paste option.");
        return;
      }
      onClose?.();
    } catch {
      setPasteError("Clipboard content could not be pasted.");
    }
  };
  const applyTextFormatting = (updates) => {
    onFormatText?.(elementId, updates);
  };

  if (dialog === "font") {
    return (
      <FontDialog
        formatting={formatting}
        presentation={presentation}
        onApply={applyTextFormatting}
        onClose={onClose}
      />
    );
  }

  if (dialog === "paragraph") {
    return (
      <ParagraphDialog
        formatting={formatting}
        onApply={applyTextFormatting}
        onClose={onClose}
      />
    );
  }

  if (dialog === "hyperlink") {
    const selectionForElement = textSelection
      ? { ...textSelection, elementId: textSelection.elementId ?? elementId }
      : null;
    return (
      <HyperlinkDialog
        selectedText={hyperlinkText}
        existingLink={existingHyperlink}
        presentation={presentation}
        onApply={(payload) => {
          const ok = onHyperlink?.(elementId, payload, selectionForElement);
          if (ok !== false) onClose?.();
          return ok;
        }}
        onRemove={() => {
          const ok = onRemoveHyperlink?.(elementId, selectionForElement);
          if (ok !== false) onClose?.();
        }}
        onClose={onClose}
      />
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="canvas-context-menu"
      style={position}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {isText && (
        <label className="canvas-context-menu-search">
          <MdSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the menus"
          />
        </label>
      )}

      {!isText && (
        <>
          <ContextMenuItem
            icon={<MdUndo />}
            label="Undo"
            shortcut="Ctrl+Z"
            disabled={!canUndo}
            onClick={() => run(onUndo)}
          />
          <ContextMenuItem
            icon={<MdRedo />}
            label="Redo"
            shortcut="Ctrl+Y"
            disabled={!canRedo}
            onClick={() => run(onRedo)}
          />
          <div className="canvas-context-menu-separator" />
        </>
      )}

      {matches("Cut") && (
        <ContextMenuItem
          icon={<MdContentCut />}
          label="Cut"
          shortcut="Ctrl+X"
          disabled={!hasSelection}
          onClick={() => run(onCut)}
        />
      )}
      {matches("Copy") && (
        <ContextMenuItem
          icon={<MdContentCopy />}
          label="Copy"
          shortcut="Ctrl+C"
          disabled={!hasSelection}
          onClick={() => run(onCopy)}
        />
      )}
      {matches("Paste") && (
        <>
          {isText && (
            <div className="canvas-context-menu-heading">Paste Options:</div>
          )}
          {isText ? (
            <>
              <div className="canvas-context-paste-options" role="group">
                <PasteOptionButton
                icon={<MdContentPaste />}
                badge="a"
                title="Use Destination Theme"
                disabled={!onPasteText}
                onClick={() =>
                  run(() => onPasteText?.(elementId, "destination"))
                }
              />
              <PasteOptionButton
                icon={<MdContentPaste />}
                badge="F"
                title="Keep Source Formatting"
                disabled={!onPasteText}
                onClick={() =>
                  run(() =>
                    onPasteText?.(elementId, "source") ?? onPaste?.(),
                  )
                }
              />
              <PasteOptionButton
                icon={<MdImage />}
                badge="▣"
                title="Picture"
                disabled={!onPastePicture}
                onClick={() => run(() => onPastePicture?.(elementId))}
              />
              <PasteOptionButton
                icon={<MdTextFields />}
                badge="A"
                title="Keep Text Only"
                disabled={!onPasteText}
                onClick={() => run(() => onPasteText?.(elementId, "text"))}
                />
              </div>
              {pasteError && (
                <div className="canvas-context-paste-error" role="status">
                  {pasteError}
                </div>
              )}
            </>
          ) : (
            <ContextMenuItem
              icon={<MdContentPaste />}
              label="Paste"
              shortcut="Ctrl+V"
              disabled={!canPaste}
              onClick={() => run(onPaste)}
            />
          )}
        </>
      )}

      {isText && (
        <TextFormattingMenu
          elementId={elementId}
          formatting={formatting}
          matches={matches}
          submenu={submenu}
          setSubmenu={setSubmenu}
          setDialog={setDialog}
          run={run}
          onExitEditText={onExitEditText}
          onDelete={onDelete}
          onNewComment={onNewComment}
          applyFormatting={applyTextFormatting}
          existingLink={existingHyperlink}
          onRemoveLink={() => {
            const selectionForElement = textSelection
              ? { ...textSelection, elementId: textSelection.elementId ?? elementId }
              : null;
            onRemoveHyperlink?.(elementId, selectionForElement);
          }}
        />
      )}

      {!isText && (
        <CanvasSelectionMenu
          hasSelection={hasSelection}
          run={run}
          onBringToFront={onBringToFront}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onSendToBack={onSendToBack}
          onRotateRight={onRotateRight}
          onNewComment={onNewComment}
          onDelete={onDelete}
          onSelectAll={onSelectAll}
        />
      )}
    </div>,
    document.body,
  );
}

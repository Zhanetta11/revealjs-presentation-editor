import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import FormatToolbar from "../tools/FormatToolbar";
import PlaceholderActionButtons from "./text/PlaceholderActionButtons";
import TextEditableSurface from "./text/TextEditableSurface";
import TextElementHandles, { TextSelectionBorders } from "./text/TextElementHandles";
import useTextSelection from "./text/hooks/useTextSelection";
import useTextToolbar from "./text/hooks/useTextToolbar";
import useTextLayout from "./text/hooks/useTextLayout";
import useTextOverflow from "./text/hooks/useTextOverflow";
import "./TextElement.css";
import { getPlaceholderFormatting, getPlaceholderPadding, getPlaceholderBackground } from "../../../core/render/slidesetRenderUtils";
import {
  resolveWeight,
  paragraphsToHTML,
  buildPendingFormattingStyles,
  getSelectionFormatting,
  getFormattingAtCursor,
  resolveTextStyle,
  resolveEffectiveFormatting,
} from "../../../core/text/textFormatting";
import {
  getListMarker,
  getListIndent,
  LIST_MARKER_WIDTH_EM,
} from "../../../core/utils/listUtils";
import {
  getCaretOffset,
  setCaretOffset,
  restoreSelectionToDOM,
  getSelectionOffsets,
  getCollapsedCursorOffset,
  domToParagraphs,
} from "../../../core/text/domSelectionManager";
import {
  CONTENT_PLACEHOLDER_PROMPTS,
  createEmptyParagraphs,
  createPromptParagraphs,
} from "../../../core/operations/textOperations";
import { extractPlainTextFromParagraphs } from "../../../core/text/textFormatting";

const TEXT_BOX_PLACEHOLDER = "Click to edit text";

export default function TextElement({
  textElement,
  isSelected,
  isPrimarySelected = isSelected,
  onSelect,
  objectSelectionMode = false,
  onChangeTextElement,
  onChangeParagraphs,
  onSaveSelection,
  onFormatTextElement,
  onStartDrag,
  onStartResize,
  onStartRotate,
  slideHeight,
  onBeginHistory,
  onCommitHistory,
  onNewComment,
  previewClassName,
  animationOrder,
  presentation,
  slide,
  onStartEditing,
  onStopEditing,
  pendingFormatting = {},
  onClearPendingFormatting,
  formatPainterClipboard = null,
  onFormatPainterCopy,
  onFormatPainterPaste,
  onContextMenu,
  clearSelectionSignal = 0,
  onAutoFit,
  onPlaceholderImageClick,
  onPlaceholderVideoClick,
}) {
  const editableRef = useRef(null);
  const elementRef = useRef(null);
  const lastTypedHTMLRef = useRef(null);
  const isDeletingRef = useRef(false);
  const isTypingRef = useRef(false);
  const toolbarFormInputActiveRef = useRef(false);
  const {
    savedSelection: savedSelState,
    savedSelectionRef,
    rememberSelection,
    clearSavedSelection,
    saveCurrentSelection,
    captureContextSelection,
    getContextMenuSelection,
  } = useTextSelection({
    editableRef,
    textElementId: textElement.id,
    clearSelectionSignal,
    onSaveSelection,
  });
  const {
    position: toolbarPos,
    isOpen: isToolbarOpen,
    setIsOpen: setIsToolbarOpen,
    open: openToolbar,
    updatePosition: updateToolbarPosition,
    syncWithSelection: syncSelectionToolbar,
  } = useTextToolbar({
    editableRef,
    elementRef,
    textElementId: textElement.id,
    isPrimarySelected,
    clearSelectionSignal,
    onSelect,
    rememberSelection,
  });

  const formatting = textElement.paragraphs?.[0]?.formatting ?? {};
  const masterFormatting = presentation?.slideset?.master?.formatting ?? {};
  const placeholderFormatting = getPlaceholderFormatting(
    presentation,
    slide,
    textElement,
  );
  const placeholderPadding = getPlaceholderPadding(presentation, slide, textElement);
  const placeholderBackground = getPlaceholderBackground(presentation, slide, textElement);

  const verticalAlign = formatting["vertical-align"]
    ?? placeholderFormatting["vertical-align"]
    ?? masterFormatting["vertical-align"]
    ?? "top";
  const justifyContent =
    verticalAlign === "middle" ? "center" :
    verticalAlign === "bottom" ? "flex-end" : "flex-start";

  const effectiveParaFormatting = resolveEffectiveFormatting(
    masterFormatting,
    placeholderFormatting,
    formatting,
  );

  const savedSel = savedSelState;
  const isRealSelection =
    savedSel &&
    !(
      savedSel.paragraphIdx ===
        (savedSel.endParagraphIdx ?? savedSel.paragraphIdx) &&
      savedSel.rangeStart === savedSel.rangeEnd
    );
  const toolbarFormatting = savedSel
    ? isRealSelection
      ? (() => {
          const raw = getSelectionFormatting(textElement, savedSel) ?? {};
          return {
            ...effectiveParaFormatting,
            ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null)),
          };
        })()
      : {
          ...effectiveParaFormatting,
          ...getFormattingAtCursor(textElement, savedSel),
          ...pendingFormatting,
        }
    : { ...effectiveParaFormatting, ...pendingFormatting };

  const paragraphListInfos = (textElement.paragraphs ?? []).map((p) => {
    const pFmt = p.formatting ?? {};
    const firstRunFmt =
      (p.runs ?? []).find((run) => (run.text ?? "").length > 0)?.formatting ??
      p.runs?.[0]?.formatting ??
      {};
    const resolvedListType =
      pFmt["list-type"]
      ?? placeholderFormatting["list-type"]
      ?? masterFormatting["list-type"]
      ?? null;
    const pListType = resolvedListType && resolvedListType !== "none" ? resolvedListType : null;
    return {
      listType: pListType,
      listLevel:
        pFmt["indent-level"]
        ?? placeholderFormatting["indent-level"]
        ?? masterFormatting["indent-level"]
        ?? 0,
      listMarker:
        pFmt["list-marker"]
        ?? placeholderFormatting["list-marker"]
        ?? masterFormatting["list-marker"]
        ?? "•",
      listNumberedStyle:
        pFmt["list-numbered-style"]
        ?? placeholderFormatting["list-numbered-style"]
        ?? masterFormatting["list-numbered-style"]
        ?? "decimal",
      markerStyle: {
        fontSize: resolveTextStyle(
          firstRunFmt.size,
          pFmt.size ?? placeholderFormatting.size,
          masterFormatting.size,
          "24px",
        ),
        lineHeight: resolveTextStyle(
          pFmt["line-spacing"],
          placeholderFormatting["line-spacing"],
          masterFormatting["line-spacing"],
          1.2,
        ),
        fontFamily: resolveTextStyle(
          firstRunFmt.font,
          pFmt.font ?? placeholderFormatting.font,
          masterFormatting.font,
          "inherit",
        ),
        fontWeight: resolveWeight(
          firstRunFmt.weight ?? pFmt.weight,
          placeholderFormatting.weight,
          masterFormatting.weight,
        ),
        color: resolveTextStyle(
          firstRunFmt.color,
          pFmt.color ?? placeholderFormatting.color,
          masterFormatting.color,
          "var(--text-dark, black)",
        ),
      },
    };
  });
  const anyListPara = paragraphListInfos.find((p) => p.listType) ?? null;
  const listType = anyListPara?.listType ?? null;
  const plainText = extractPlainTextFromParagraphs(textElement.paragraphs);
  const isTextBoxPrompt =
    textElement["placeholder-id"] == null && plainText === TEXT_BOX_PLACEHOLDER;
  const isTextBoxEmpty = textElement["placeholder-id"] == null && plainText === "";
  const isContentPlaceholder =
    textElement["placeholder-id"]?.includes?.("body") ||
    textElement["placeholder-id"]?.includes?.("content");
  const isContentPlaceholderPrompt =
    isContentPlaceholder && CONTENT_PLACEHOLDER_PROMPTS.has(plainText);
  const shouldShowPlaceholderButtons =
    isContentPlaceholderPrompt &&
    (onPlaceholderImageClick || onPlaceholderVideoClick);

  const innerHTML = paragraphsToHTML(textElement.paragraphs, masterFormatting, placeholderFormatting);
  const { paragraphTops, editableOffsetTop } = useTextLayout({
    editableRef,
    innerHTML,
    textWidth: textElement.width,
    paragraphs: textElement.paragraphs,
    paragraphListInfos,
  });
  useTextOverflow({
    editableRef,
    innerHTML,
    textElement,
    slideHeight,
    onAutoFit,
  });

  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    if (innerHTML === lastTypedHTMLRef.current) return;

    const wasFocused = document.activeElement === el;
    const savedCaret = wasFocused ? getCaretOffset(el) : 0;
    const savedSel = wasFocused ? savedSelectionRef.current : null;

    el.innerHTML = innerHTML;
    lastTypedHTMLRef.current = innerHTML;


    if (wasFocused) {
      if (savedSel) {
        restoreSelectionToDOM(el, textElement.paragraphs, savedSel);
      } else {
        setCaretOffset(el, savedCaret);
      }
    }
  }, [innerHTML, savedSelectionRef, textElement.paragraphs]);

  const handleFormat = (id, updates) => {
    if (isDeletingRef.current || isTypingRef.current) {
      isDeletingRef.current = false;
      isTypingRef.current = false;
      onCommitHistory?.();
    }
    const el = editableRef.current;
    const liveOffsets =
      el && document.activeElement === el ? getSelectionOffsets(el) : null;
    const offsets = liveOffsets ?? savedSelectionRef.current;
    if (offsets) {
      savedSelectionRef.current = offsets;
      onSaveSelection?.(id, offsets);
    }
    onFormatTextElement(id, updates);
  };

  return (
    <div
      ref={elementRef}
      data-element-id={textElement.id}
      className={["draggable", "text-draggable", isSelected ? "selected" : "", previewClassName]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: `${textElement.position?.x ?? 0}px`,
        top: `${textElement.position?.y ?? 0}px`,
        width: `${textElement.width ?? 300}px`,
        minHeight: `${textElement.height ?? 80}px`,
        background: textElement.background ?? placeholderBackground ?? "transparent",
        zIndex: textElement["z-index"] ?? 1,
        transform: `rotate(${textElement.rotation ?? 0}deg)`,
        transformOrigin: "center center",
        display: "flex",
        flexDirection: "column",
        justifyContent,
        ...(placeholderPadding ? { padding: placeholderPadding } : {}),
      }}
      onMouseDown={(event) => {
        if (event.button === 2) captureContextSelection();
        if (
          event.button === 0 &&
          (!isSelected ||
            objectSelectionMode ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey)
        ) {
          event.preventDefault();
        }
        onSelect(textElement.id, event);
      }}
    >
      {animationOrder != null && (
        <span className="animation-order-badge">{animationOrder}</span>
      )}

      {isPrimarySelected &&
        <TextSelectionBorders
          elementId={textElement.id}
          onStartDrag={onStartDrag}
        />}

      {isPrimarySelected &&
        isToolbarOpen &&
        createPortal(
          <FormatToolbar
            elementId={textElement.id}
            formatting={toolbarFormatting}
            onFormatTextElement={handleFormat}
            onNewComment={onNewComment}
            presentation={presentation}
            hasSelection={savedSelState !== null}
            formatPainterClipboard={formatPainterClipboard}
            onFormatPainterCopy={onFormatPainterCopy}
            onFormatPainterPaste={onFormatPainterPaste}
            onFormInputMouseDown={() => { toolbarFormInputActiveRef.current = true; }}
            style={{
              position: "fixed",
              top: toolbarPos.top,
              left: toolbarPos.left,
              zIndex: 9999,
            }}
          />,
          document.body,
        )}

      {anyListPara && (
        <div
          className="list-markers-overlay"
          style={{
            left: 0,
            top: editableOffsetTop,
            width: "100%",
            fontSize: resolveTextStyle(
              formatting.size,
              placeholderFormatting.size,
              masterFormatting.size,
              "24px",
            ),
            lineHeight: resolveTextStyle(
              formatting["line-spacing"],
              placeholderFormatting["line-spacing"],
              masterFormatting["line-spacing"],
              1.2,
            ),
            color: resolveTextStyle(
              formatting.color,
              placeholderFormatting.color,
              masterFormatting.color,
              "var(--text-dark, black)",
            ),
            fontFamily: resolveTextStyle(
              formatting.font,
              placeholderFormatting.font,
              masterFormatting.font,
              "inherit",
            ),
            fontWeight: resolveWeight(
              formatting.weight,
              placeholderFormatting.weight,
              masterFormatting.weight,
            ),
          }}
        >
          {(() => {
            let numberedCounter = 0;
            return paragraphListInfos.map((info, i) => {
              if (info.listType === "numbered") numberedCounter++;
              else if (!info.listType) numberedCounter = 0;
              return (
                <span
                  key={i}
                  className="list-marker-line"
                  style={{
                    top: `${paragraphTops[i] ?? 0}px`,
                    width: `calc(${getListIndent(info.listLevel, info.listType)} + ${LIST_MARKER_WIDTH_EM}em)`,
                    ...info.markerStyle,
                  }}
                >
                  {info.listType
                    ? getListMarker(
                        info.listType === "numbered" ? numberedCounter - 1 : i,
                        info.listType,
                        info.listMarker,
                        info.listNumberedStyle,
                      )
                    : null}
                </span>
              );
            });
          })()}
        </div>
      )}

      <TextEditableSurface
        ref={editableRef}
        isEditable={isPrimarySelected && !objectSelectionMode}
        isTextBoxEmpty={isTextBoxEmpty}
        isTextBoxPrompt={isTextBoxPrompt}
        onFocus={() => {
          isDeletingRef.current = false;
          isTypingRef.current = false;
          onStartEditing?.(textElement.id);
          if (isTextBoxPrompt) {
            const emptyParagraphs = createEmptyParagraphs(textElement.paragraphs);
            const emptyHTML = paragraphsToHTML(
              emptyParagraphs,
              masterFormatting,
              placeholderFormatting,
            );
            const el = editableRef.current;
            if (el) el.innerHTML = emptyHTML;
            lastTypedHTMLRef.current = emptyHTML;
            onChangeParagraphs?.(textElement.id, emptyParagraphs, true);
          }
          if (isContentPlaceholderPrompt && plainText !== "") {
            const emptyParagraphs = createEmptyParagraphs(textElement.paragraphs);
            const emptyHTML = paragraphsToHTML(
              emptyParagraphs,
              masterFormatting,
              placeholderFormatting,
            );
            const el = editableRef.current;
            if (el) el.innerHTML = emptyHTML;
            lastTypedHTMLRef.current = emptyHTML;
            onChangeParagraphs?.(textElement.id, emptyParagraphs, true);
          }
          clearSavedSelection(false);
        }}
        onMouseUp={(e) => {
          if (e.button !== 2) saveCurrentSelection();
          syncSelectionToolbar();
          if (e.ctrlKey || e.metaKey) {
            const linkEl = e.target.closest?.("[data-link]");
            const href = linkEl?.dataset?.link;
            if (href) window.open(href, "_blank", "noopener,noreferrer");
          }
        }}
        onTouchEnd={() => {
          window.setTimeout(syncSelectionToolbar, 0);
        }}
        onContextMenu={(event) => {
          const selection = getContextMenuSelection();
          if (onContextMenu) {
            event.preventDefault();
            event.stopPropagation();
            setIsToolbarOpen(false);
            onContextMenu(event, textElement.id, "text", selection);
          } else {
            openToolbar({ x: event.clientX, y: event.clientY });
          }
        }}
        onKeyUp={() => {
          saveCurrentSelection();
          syncSelectionToolbar();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsToolbarOpen(false);
            window.getSelection()?.removeAllRanges();
            return;
          }
          if (
            e.key.length === 1 ||
            e.key === "Backspace" ||
            e.key === "Delete" ||
            e.key === "Enter"
          ) {
            setIsToolbarOpen(false);
          }
          if (e.key !== "Tab") return;
          const el = editableRef.current;
          if (!el) return;
          const offset = getCollapsedCursorOffset(el);
          if (!offset) return;
          const para = textElement.paragraphs?.[offset.paragraphIdx];
          const paraFmt = para?.formatting ?? {};
          const effectiveListType =
            paraFmt["list-type"]
            ?? placeholderFormatting["list-type"]
            ?? masterFormatting["list-type"];
          if (!effectiveListType || effectiveListType === "none") return;
          e.preventDefault();
          const currentLevel =
            paraFmt["indent-level"]
            ?? placeholderFormatting["indent-level"]
            ?? masterFormatting["indent-level"]
            ?? 0;
          const MAX_LIST_INDENT_LEVEL = 4;
          const newLevel = e.shiftKey
            ? Math.max(0, currentLevel - 1)
            : Math.min(MAX_LIST_INDENT_LEVEL, currentLevel + 1);
          if (newLevel === currentLevel) return;
          onSaveSelection?.(textElement.id, offset);
          onFormatTextElement?.(textElement.id, { "indent-level": newLevel });
        }}
        onBeforeInput={(e) => {
          if (!e.data || Object.keys(pendingFormatting).length === 0) return;
          e.preventDefault();
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) return;
          const range = sel.getRangeAt(0);
          range.deleteContents();

          const el = editableRef.current;
          let insertRange = range.cloneRange();
          const container = range.startContainer;
          const parentSpan =
            container.nodeType === Node.TEXT_NODE
              ? container.parentElement?.closest?.("span")
              : null;
          if (parentSpan && el?.contains(parentSpan) && parentSpan !== el) {
            const atEnd =
              range.startOffset === (container.textContent?.length ?? 0);
            const atStart = range.startOffset === 0;
            if (atEnd) {
              insertRange = document.createRange();
              insertRange.setStartAfter(parentSpan);
              insertRange.collapse(true);
            } else if (atStart) {
              insertRange = document.createRange();
              insertRange.setStartBefore(parentSpan);
              insertRange.collapse(true);
            }
          }

          const span = document.createElement("span");
          const styles = buildPendingFormattingStyles(pendingFormatting);
          if (styles) span.setAttribute("style", styles);
          span.textContent = e.data;
          insertRange.insertNode(span);
          const newRange = document.createRange();
          newRange.setStart(span.firstChild ?? span, span.textContent.length);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          if (onChangeParagraphs) {
            const newParagraphs = domToParagraphs(el, textElement.paragraphs);
            lastTypedHTMLRef.current = paragraphsToHTML(newParagraphs, masterFormatting, placeholderFormatting);
            onChangeParagraphs(textElement.id, newParagraphs);
          } else {
            onChangeTextElement(textElement.id, el.innerText);
          }
          saveCurrentSelection();
          onClearPendingFormatting?.();
        }}
        onInput={(event) => {
          setIsToolbarOpen(false);
          const el = event.currentTarget;
          if (el.innerHTML === "<br>" || el.innerHTML === "<br/>") {
            el.innerHTML = "";
          }

          const inputType = event.nativeEvent?.inputType ?? "";
          const isDeleteInput = inputType.startsWith("delete");
          if (isDeleteInput) {
            if (!isDeletingRef.current) {
              isDeletingRef.current = true;
              onBeginHistory?.();
            }
          } else {
            if (isDeletingRef.current) {
              isDeletingRef.current = false;
              onCommitHistory?.();
            }
            isTypingRef.current = true;
          }
          const grouped = isDeletingRef.current || isTypingRef.current;
          if (onChangeParagraphs) {
            const paragraphs = domToParagraphs(el, textElement.paragraphs);
            lastTypedHTMLRef.current = paragraphsToHTML(paragraphs, masterFormatting, placeholderFormatting);
            onChangeParagraphs(textElement.id, paragraphs, grouped);
          } else {
            onChangeTextElement(textElement.id, el.innerText, grouped);
          }
          updateToolbarPosition();
        }}
        onBlur={(e) => {
          const relatedTarget = e.relatedTarget;
          const goingToTextContextUi =
            relatedTarget &&
            (relatedTarget.closest?.(".canvas-context-menu") ||
              relatedTarget.closest?.(".text-context-dialog"));
          const goingToToolbar =
            toolbarFormInputActiveRef.current ||
            (relatedTarget &&
            (relatedTarget.closest?.(".format-toolbar") ||
              relatedTarget.closest?.(".toolbar") ||
              relatedTarget.closest?.(".toolbar-ribbon") ||
              relatedTarget.closest?.(".bg-palette-popup") ||
              relatedTarget.closest?.(".cp-popup"))) ||
            goingToTextContextUi;
          toolbarFormInputActiveRef.current = false;
          const domSel = window.getSelection();
          const hasRealSelection =
            domSel && !domSel.isCollapsed && domSel.rangeCount > 0;
          if (goingToToolbar) {
            if (isDeletingRef.current || isTypingRef.current) {
              isDeletingRef.current = false;
              isTypingRef.current = false;
              onCommitHistory?.();
            }
            if (!hasRealSelection && !goingToTextContextUi) {
              const el = editableRef.current;
              const collapsed = el ? getCollapsedCursorOffset(el) : null;
              savedSelectionRef.current = collapsed;
              onSaveSelection?.(textElement.id, null);
              const tag = relatedTarget?.tagName;
              const isFormInput =
                tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA";
              const isColorPicker = !!relatedTarget?.closest?.(".cp-popup");
              if (collapsed && !isFormInput && !isColorPicker) {
                const savedParas = textElement.paragraphs;
                setTimeout(() => {
                  const editable = editableRef.current;
                  if (!editable) return;
                  editable.focus();
                  restoreSelectionToDOM(editable, savedParas, collapsed);
                }, 0);
              }
            }
          } else {
            const el = editableRef.current;
            const currentText = el?.innerText?.replace(/\u00a0/g, " ").trim() ?? "";
            if (isContentPlaceholder && currentText === "") {
              const promptParagraphs = createPromptParagraphs(
                textElement.paragraphs,
                "Click to add text",
              );
              const promptHTML = paragraphsToHTML(
                promptParagraphs,
                masterFormatting,
                placeholderFormatting,
              );
              if (el) el.innerHTML = promptHTML;
              lastTypedHTMLRef.current = promptHTML;
              onChangeParagraphs?.(textElement.id, promptParagraphs, true);
            }
            clearSavedSelection();
            setIsToolbarOpen(false);
            isDeletingRef.current = false;
            isTypingRef.current = false;
            onCommitHistory?.();
            onStopEditing?.(textElement.id);
          }
        }}
        editableStyle={{
          fontSize: resolveTextStyle(
            formatting.size,
            placeholderFormatting.size,
            masterFormatting.size,
            "24px",
          ),
          fontWeight: resolveTextStyle(
            formatting.weight,
            placeholderFormatting.weight,
            masterFormatting.weight,
            "normal",
          ),
          fontStyle: resolveTextStyle(
            formatting.italics,
            placeholderFormatting.italics,
            masterFormatting.italics,
            false,
          )
            ? "italic"
            : "normal",
          textDecoration: resolveTextStyle(
            formatting["text-decoration"],
            placeholderFormatting["text-decoration"],
            masterFormatting["text-decoration"],
            "none",
          ),
          textAlign: resolveTextStyle(
            formatting.align,
            placeholderFormatting.align,
            masterFormatting.align,
            "left",
          ),
          textAlignLast:
            resolveTextStyle(
              formatting.align,
              placeholderFormatting.align,
              masterFormatting.align,
              "left",
            ) === "justify"
              ? "left"
              : undefined,
          lineHeight: resolveTextStyle(
            formatting["line-spacing"],
            placeholderFormatting["line-spacing"],
            masterFormatting["line-spacing"],
            1.2,
          ),
          color: resolveTextStyle(
            formatting.color,
            placeholderFormatting.color,
            masterFormatting.color,
            "var(--text-dark, black)",
          ),
          fontFamily: resolveTextStyle(
            formatting.font,
            placeholderFormatting.font,
            masterFormatting.font,
            "inherit",
          ),
          position: "relative",
          wordBreak: "break-all",
          overflowWrap: "anywhere",
        }}
        listType={listType}
        listMarker={
          anyListPara?.listType === "bullets"
            ? anyListPara.listMarker
            : undefined
        }
        listNumberedStyle={
          anyListPara?.listType === "numbered"
            ? anyListPara.listNumberedStyle
            : undefined
        }
      />

      {shouldShowPlaceholderButtons && (
        <PlaceholderActionButtons
          onImageClick={onPlaceholderImageClick}
          onVideoClick={onPlaceholderVideoClick}
        />
      )}

      {isPrimarySelected && (
        <TextElementHandles
          elementId={textElement.id}
          onStartResize={onStartResize}
          onStartRotate={onStartRotate}
        />
      )}
    </div>
  );
}

import "./HomeTab.css";
import { getAvailableFonts } from "../../../core/model/fontConfig";
import ClipboardGroup from "./ClipboardGroup";
import SlidesGroup from "./SlidesGroup";
import FontGroup from "./FontGroup";
import ParagraphGroup from "./ParagraphGroup";
import EditingGroup from "./EditingGroup";

export default function HomeTab({
  onAddSlide,
  onApplyLayout,
  onResetLayout,
  onDeleteSlide,
  onDuplicateSlide,
  canDelete,
  onToggleSlideHidden,
  isSlideHidden,
  isSlideMasterOpen = false,
  currentFormatting = {},
  onFormatChange,
  onChangeCase,
  onFontUpload,
  onFontRemove,
  isTextSelected = false,
  presentation,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  hasSelection = false,
  canPaste = false,
  canUndo = false,
  canRedo = false,
  onFind,
  onReplace,
  onSelectAll,
  onSelectObjects,
  onOpenSelectionPane,
  objectSelectionMode,
}) {
  const fonts = getAvailableFonts(presentation);

  return (
    <>
      <ClipboardGroup
        onCut={onCut}
        onCopy={onCopy}
        onPaste={onPaste}
        onUndo={onUndo}
        onRedo={onRedo}
        hasSelection={hasSelection}
        canPaste={canPaste}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <SlidesGroup
        onAddSlide={onAddSlide}
        onApplyLayout={onApplyLayout}
        onResetLayout={onResetLayout}
        onDeleteSlide={onDeleteSlide}
        onDuplicateSlide={onDuplicateSlide}
        canDelete={canDelete}
        onToggleSlideHidden={onToggleSlideHidden}
        isSlideHidden={isSlideHidden}
        isSlideMasterOpen={isSlideMasterOpen}
        presentation={presentation}
      />

      <FontGroup
        currentFormatting={currentFormatting}
        isTextSelected={isTextSelected}
        fonts={fonts}
        presentation={presentation}
        onFormatChange={onFormatChange}
        onChangeCase={onChangeCase}
        onFontUpload={onFontUpload}
        onFontRemove={onFontRemove}
      />

      <ParagraphGroup
        currentFormatting={currentFormatting}
        isTextSelected={isTextSelected}
        onFormatChange={onFormatChange}
      />

      <EditingGroup
        onFind={onFind}
        onReplace={onReplace}
        onSelectAll={onSelectAll}
        onSelectObjects={onSelectObjects}
        onOpenSelectionPane={onOpenSelectionPane}
        objectSelectionMode={objectSelectionMode}
      />
    </>
  );
}

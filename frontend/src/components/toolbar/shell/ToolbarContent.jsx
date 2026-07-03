import AnimationsTab from "../animations/AnimationsTab";
import DesignTab from "../design/DesignTab";
import FileTab from "../file/FileTab";
import HomeTab from "../home/HomeTab";
import InsertTab from "../insert/InsertTab";
import PictureFormatTab from "../picture-format/PictureFormatTab";
import SlideShowTab from "../slideshow/SlideShowTab";
import TransitionsTab from "../transitions/TransitionsTab";
import ViewTab from "../view/ViewTab";
import { SlideMasterRibbon } from "../../views/SlideMasterView";

export default function ToolbarContent({
  currentTab,
  onAddSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onMoveSlideUp,
  onMoveSlideDown,
  onSavePresentation,
  onOpenPreviewFromBeginning,
  onOpenPreviewFromCurrent,
  canDelete,
  canMoveUp,
  canMoveDown,
  onExportPresentation,
  onResetPresentation,
  onImageUpload,
  onVideoUpload,
  onToggleSlideHidden,
  isSlideHidden,
  onApplyLayout,
  onResetLayout,
  onTransitionChange,
  currentTransition,
  currentDuration,
  onDurationChange,
  onApplyTransitionToAll,
  onTransitionPreview,
  selectedElement,
  animations,
  onAddAnimationForElement,
  onUpdateAnimation,
  onReorderAnimation,
  onDeleteAnimation,
  onAnimationPreview,
  layouts,
  onApplyBackground,
  onBeginHistory,
  onCommitHistory,
  onAddTextElement,
  currentFormatting,
  onFormatChange,
  onChangeCase,
  onFontUpload,
  onFontRemove,
  isTextSelected,
  presentation,
  onNewPresentation,
  onOpenPresentation,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  canPaste,
  canUndo,
  canRedo,
  onFind,
  onReplace,
  onSelectAll,
  onSelectObjects,
  onOpenSelectionPane,
  objectSelectionMode,
  onApplyTheme,
  onApplyFont,
  onApplyLayoutFont,
  onUpdateDimensions,
  onUpdateThemeColor,
  currentView,
  onChangeView,
  showNotes,
  onToggleNotes,
  onOpenSlideMaster,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  selectedHyperlinkText,
  onHyperlink,
  onNewComment,
  selectedMediaElement,
  onUpdateSelectedMedia,
  onCropSelectedMedia,
  onBringForward,
  onSendBackward,
  onChangePicture,
  onPreviewMediaEffects,
  onPreviewMediaStyle,
  isSlideMasterOpen,
  onCloseSlideMaster,
  masterName,
  onRenameMaster,
  selectedMasterLayoutId,
  onInsertLayout,
  onRenameLayout,
  onDeleteLayout,
  onAddLayoutPlaceholder,
  onAddContentPlaceholder,
  onRemoveLayoutPlaceholder,
  onAddMasterElement,
  onDeleteMasterElement,
  onToggleTitle,
  onToggleFooters,
  showFormatBackground,
  onToggleFormatBackground,
  showAltText,
  onToggleAltText,
}) {
  return (
    <div
      className="toolbar-ribbon"
      onMouseDownCapture={(event) => {
        const tag = event.target.tagName;
        if (tag !== "SELECT" && tag !== "INPUT" && tag !== "TEXTAREA") {
          event.preventDefault();
        }
      }}
    >
      {currentTab === "File" && (
        <FileTab
          onOpenPresentation={onOpenPresentation}
          onSavePresentation={onSavePresentation}
          onExportPresentation={onExportPresentation}
          onResetPresentation={onResetPresentation}
          onNewPresentation={onNewPresentation}
        />
      )}

      {currentTab === "Slide Master" && (
        <SlideMasterRibbon
          onClose={onCloseSlideMaster}
          presentation={presentation}
          onApplyTheme={onApplyTheme}
          onApplyBackground={onApplyBackground}
          onApplyFont={onApplyFont}
          onApplyLayoutFont={onApplyLayoutFont}
          onUpdateDimensions={onUpdateDimensions}
          masterName={masterName}
          onRenameMaster={onRenameMaster}
          selectedMasterLayoutId={selectedMasterLayoutId}
          onInsertLayout={onInsertLayout}
          onRenameLayout={onRenameLayout}
          onDeleteLayout={onDeleteLayout}
          onAddLayoutPlaceholder={onAddLayoutPlaceholder}
          onRemoveLayoutPlaceholder={onRemoveLayoutPlaceholder}
          onAddMasterElement={onAddMasterElement}
          onDeleteMasterElement={onDeleteMasterElement}
          onToggleTitle={onToggleTitle}
          onToggleFooters={onToggleFooters}
          onAddTextElement={onAddTextElement}
          onAddContentPlaceholder={onAddContentPlaceholder}
          onImageUpload={onImageUpload}
          onVideoUpload={onVideoUpload}
        />
      )}

      {currentTab === "Home" && (
        <HomeTab
          onAddSlide={onAddSlide}
          onApplyLayout={onApplyLayout}
          onResetLayout={onResetLayout}
          onDeleteSlide={onDeleteSlide}
          onDuplicateSlide={onDuplicateSlide}
          onMoveSlideUp={onMoveSlideUp}
          onMoveSlideDown={onMoveSlideDown}
          canDelete={canDelete}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onToggleSlideHidden={onToggleSlideHidden}
          isSlideHidden={isSlideHidden}
          isSlideMasterOpen={isSlideMasterOpen}
          currentFormatting={currentFormatting}
          onFormatChange={onFormatChange}
          onChangeCase={onChangeCase}
          onFontUpload={onFontUpload}
          onFontRemove={onFontRemove}
          isTextSelected={isTextSelected}
          presentation={presentation}
          onCut={onCut}
          onCopy={onCopy}
          onPaste={onPaste}
          onUndo={onUndo}
          onRedo={onRedo}
          hasSelection={!!selectedElement}
          canPaste={canPaste}
          canUndo={canUndo}
          canRedo={canRedo}
          onFind={onFind}
          onReplace={onReplace}
          onSelectAll={onSelectAll}
          onSelectObjects={onSelectObjects}
          onOpenSelectionPane={onOpenSelectionPane}
          objectSelectionMode={objectSelectionMode}
        />
      )}

      {currentTab === "Insert" && (
        <InsertTab
          onImageUpload={onImageUpload}
          onVideoUpload={onVideoUpload}
          onAddSlide={onAddSlide}
          onAddTextElement={onAddTextElement}
          layouts={layouts}
          presentation={presentation}
          onApplyBackground={onApplyBackground}
          isSlideMasterOpen={isSlideMasterOpen}
          selectedElement={selectedElement}
          selectedHyperlinkText={selectedHyperlinkText}
          onHyperlink={onHyperlink}
          onNewComment={onNewComment}
          showFormatBackground={showFormatBackground}
          onToggleFormatBackground={onToggleFormatBackground}
        />
      )}

      {currentTab === "Design" && (
        <DesignTab
          presentation={presentation}
          onApplyTheme={onApplyTheme}
          onApplyFont={onApplyFont}
          onUpdateDimensions={onUpdateDimensions}
          onUpdateThemeColor={onUpdateThemeColor}
        />
      )}

      {currentTab === "Transitions" && (
        <TransitionsTab
          currentTransition={currentTransition}
          onTransitionChange={onTransitionChange}
          currentDuration={currentDuration}
          onDurationChange={onDurationChange}
          onApplyToAll={onApplyTransitionToAll}
          onTransitionPreview={onTransitionPreview}
        />
      )}

      {currentTab === "Animations" && (
        <AnimationsTab
          selectedElement={selectedElement}
          animations={animations}
          onAddAnimationForElement={onAddAnimationForElement}
          onUpdateAnimation={onUpdateAnimation}
          onReorderAnimation={onReorderAnimation}
          onDeleteAnimation={onDeleteAnimation}
          onAnimationPreview={onAnimationPreview}
        />
      )}

      {currentTab === "Slide Show" && (
        <SlideShowTab
          onOpenPreviewFromBeginning={onOpenPreviewFromBeginning}
          onOpenPreviewFromCurrent={onOpenPreviewFromCurrent}
        />
      )}

      {currentTab === "Picture Format" && (
        <PictureFormatTab
          media={selectedMediaElement}
          onUpdate={onUpdateSelectedMedia}
          onCrop={onCropSelectedMedia}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onChangePicture={onChangePicture}
          onPreviewEffects={onPreviewMediaEffects}
          onPreviewStyle={onPreviewMediaStyle}
          onBeginHistory={onBeginHistory}
          onCommitHistory={onCommitHistory}
          isSlideMasterOpen={isSlideMasterOpen}
          showAltText={showAltText}
          onToggleAltText={onToggleAltText}
        />
      )}

      {currentTab === "View" && (
        <ViewTab
          currentView={currentView}
          onChangeView={(view) => {
            if (isSlideMasterOpen) onCloseSlideMaster?.();
            onChangeView(view);
          }}
          showNotes={showNotes}
          onToggleNotes={onToggleNotes}
          onOpenSlideMaster={onOpenSlideMaster}
          isSlideMasterOpen={isSlideMasterOpen}
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomChange={onZoomChange}
        />
      )}
    </div>
  );
}

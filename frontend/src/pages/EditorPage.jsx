import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SlideList from "../components/views/SlideList";
import Toolbar from "../components/editor/Toolbar";
import EditorCanvas from "../components/editor/EditorCanvas";
import "./EditorPage.css";
import PreviewModal from "../components/dialogs/PreviewModal";
import CommentsPanel from "../components/panels/CommentsPanel";
import SlideSorterView from "../components/views/SlideSorterView";
import OutlineView from "../components/views/OutlineView";
import FileMenu from "../components/editor/FileMenu";
import NotesPageView from "../components/views/NotesPageView";
import SlideMasterView from "../components/views/SlideMasterView";
import StatusBar from "../components/editor/StatusBar";
import FindReplaceDialog from "../components/dialogs/FindReplaceDialog";
import SelectionPane from "../components/panels/SelectionPane";
import FormatBackgroundPanel from "../components/toolbar/shared/FormatBackgroundPanel";
import AltTextPanel from "../components/toolbar/picture-format/AltTextPanel";
import { useEditorController } from "../hooks/editor/useEditorController";

export default function EditorPage() {
  const navigate = useNavigate();
  const ctrl = useEditorController();

  const [themePreview, setThemePreview] = useState(null);
  const displayPresentation = useMemo(() => {
    const presentation = ctrl.presentation;
    if (!themePreview || !presentation?.slideset?.master) return presentation;
    return {
      ...presentation,
      slideset: {
        ...presentation.slideset,
        master: {
          ...presentation.slideset.master,
          "color-theme": themePreview.colorTheme,
          ...(themePreview.decorations
            ? { decorations: themePreview.decorations }
            : {}),
        },
      },
    };
  }, [ctrl.presentation, themePreview]);

  const updateSelectedMedia = (updates) =>
    ctrl.selectedMediaElement && (ctrl.isSlideMasterOpen
      ? ctrl.masterViewAutoFitMedia(ctrl.selectedMediaElement.id, updates)
      : ctrl.updateMedia(ctrl.selectedMediaElement.id, updates));

  if (ctrl.isLoading) {
    return <div className="editor-loading">Loading...</div>;
  }

  if (ctrl.activeTab === "File") {
    return (
      <FileMenu
        presentationTitle={ctrl.presentationTitle}
        onClose={() => ctrl.setActiveTab("Home")}
        onClosePresentation={ctrl.handleClosePresentation}
        onGoHome={() => navigate("/")}
        onNew={ctrl.handleNew}
        onOpen={ctrl.handleElectronOpen}
        onOpenProjectFolder={ctrl.handleOpenProjectFolder}
        onOpenProject={ctrl.handleOpenRecentProject}
        onSave={ctrl.handleSave}
        onSaveAs={ctrl.handleSaveAs}
        onExport={ctrl.exportPresentation}
        onExportZip={ctrl.handleExportZip}
        onLoadFile={ctrl.handleLoadFile}
        onDelete={ctrl.handleDeleteAndGoHome}
      />
    );
  }

  return (
    <div className="editor-page">
      <div className="toolbar-overlay">
        <Toolbar
          activeTab={ctrl.activeTab}
          onTabChange={ctrl.setActiveTab}
          onBeginHistory={ctrl.beginHistory}
          onCommitHistory={ctrl.commitHistory}
          onAddSlide={ctrl.addSlide}
          onDeleteSlide={ctrl.deleteSlide}
          onDuplicateSlide={ctrl.duplicateSlide}
          onMoveSlideUp={ctrl.moveSlideUp}
          onMoveSlideDown={ctrl.moveSlideDown}
          onSavePresentation={ctrl.handleSave}
          autosaveEnabled={ctrl.state.autosaveEnabled}
          onToggleAutosave={ctrl.toggleAutosave}
          onExportPresentation={ctrl.exportPresentation}
          onOpenPreviewFromBeginning={ctrl.handleOpenPreviewFromBeginning}
          onOpenPreviewFromCurrent={ctrl.handleOpenPreviewFromCurrent}
          canDelete={ctrl.slides.length > 1}
          canMoveUp={ctrl.selectedSlideIndex > 0}
          canMoveDown={ctrl.selectedSlideIndex < ctrl.slides.length - 1}
          onResetPresentation={ctrl.resetPresentation}
          onImageUpload={ctrl.activeImageUpload}
          onVideoUpload={ctrl.activeVideoUpload}
          onAddTextElement={ctrl.activeAddTextElement}
          onToggleSlideHidden={ctrl.handleToggleSlideHidden}
          isSlideHidden={ctrl.selectedSlide?.hidden}
          onTransitionChange={ctrl.updateSlideTransition}
          currentTransition={ctrl.currentTransition}
          currentDuration={ctrl.currentDuration}
          onDurationChange={ctrl.updateTransitionDuration}
          onApplyTransitionToAll={ctrl.handleApplyTransitionToAll}
          selectedElement={ctrl.selectedElement}
          animations={ctrl.selectedSlide?.contents?.animations ?? []}
          onAddAnimationForElement={ctrl.addAnimationForElement}
          onUpdateAnimation={ctrl.updateAnimation}
          onReorderAnimation={ctrl.reorderAnimations}
          onDeleteAnimation={ctrl.deleteAnimation}
          onAnimationPreview={ctrl.triggerAnimationPreview}
          onTransitionPreview={ctrl.triggerTransitionPreview}
          onPreviewEffect={ctrl.setPreviewEffect}
          onApplyLayout={ctrl.applyLayout}
          onResetLayout={ctrl.resetLayout}
          currentFormatting={ctrl.currentFormatting}
          onFormatChange={ctrl.handleFormatChange}
          onChangeCase={ctrl.handleChangeCase}
          onFontUpload={ctrl.addFont}
          onFontRemove={ctrl.removeFont}
          isTextSelected={
            !!(ctrl.isSlideMasterOpen
              ? ctrl.masterSelectedTextEl
              : ctrl.selectedTextEl)
          }
          presentation={ctrl.presentation}
          onCut={ctrl.handleCut}
          onCopy={ctrl.handleCopy}
          onPaste={ctrl.handlePaste}
          onUndo={ctrl.undo}
          onRedo={ctrl.redo}
          canCopyCut={ctrl.canCopyCut}
          canPaste={ctrl.canPaste}
          canUndo={ctrl.state.past.length > 0}
          canRedo={ctrl.state.future.length > 0}
          onFind={ctrl.openFind}
          onReplace={ctrl.openReplace}
          onSelectAll={ctrl.handleSelectAll}
          onSelectObjects={ctrl.handleSelectObjects}
          onOpenSelectionPane={() => ctrl.setShowSelectionPane(true)}
          objectSelectionMode={ctrl.objectSelectionMode}
          onApplyTheme={ctrl.updateMasterTheme}
          onPreviewTheme={setThemePreview}
          onApplyFont={ctrl.updateMasterFormatting}
          onApplyLayoutFont={ctrl.applyLayoutFont}
          onUpdateDimensions={ctrl.handleUpdateDimensions}
          onUpdateThemeColor={ctrl.handleUpdateThemeColor}
          onApplyBackground={ctrl.handleApplyBackground}
          onApplySlideBackground={ctrl.handleApplySlideBackground}
          onApplyBgFillImage={ctrl.handleApplyBgFillImage}
          onApplyBackgroundToAll={ctrl.handleApplyBackgroundToAll}
          selectedSlide={ctrl.selectedSlide}
          layouts={ctrl.layouts}
          currentView={ctrl.currentView}
          onChangeView={ctrl.setCurrentView}
          showNotes={ctrl.showNotes}
          onToggleNotes={ctrl.toggleNotes}
          zoom={ctrl.zoom}
          onZoomIn={ctrl.zoomIn}
          onZoomOut={ctrl.zoomOut}
          onZoomChange={ctrl.setZoom}
          selectedHyperlinkText={ctrl.selectedHyperlinkText}
          onHyperlink={ctrl.handleHyperlink}
          onNewComment={ctrl.handleNewComment}
          onOpenSlideMaster={() => ctrl.setIsSlideMasterOpen(true)}
          isSlideMasterOpen={ctrl.isSlideMasterOpen}
          onCloseSlideMaster={() => ctrl.setIsSlideMasterOpen(false)}
          masterName={ctrl.masterName}
          onRenameMaster={ctrl.setMasterName}
          selectedMasterLayoutId={ctrl.selectedMasterLayoutId}
          onInsertLayout={ctrl.addLayout}
          onRenameLayout={ctrl.renameLayout}
          onDeleteLayout={ctrl.deleteLayout}
          onAddLayoutPlaceholder={ctrl.addLayoutPlaceholder}
          onAddTextPlaceholder={ctrl.handleAddTextPlaceholder}
          onAddContentPlaceholder={ctrl.handleAddContentPlaceholder}
          onRemoveLayoutPlaceholder={ctrl.removeLayoutPlaceholder}
          onAddMasterElement={ctrl.addMasterElement}
          onDeleteMasterElement={ctrl.deleteMasterElement}
          onToggleTitle={ctrl.toggleTitle}
          onToggleFooters={ctrl.toggleFooters}
          selectedMediaElement={ctrl.selectedMediaElement}
          onUpdateSelectedMedia={updateSelectedMedia}
          onCropSelectedMedia={ctrl.triggerCrop}
          showFormatBackground={ctrl.showFormatBackground}
          onToggleFormatBackground={() => ctrl.setShowFormatBackground((v) => !v)}
          showAltText={ctrl.showAltText}
          onToggleAltText={(value) =>
            typeof value === "boolean"
              ? ctrl.setShowAltText(value)
              : ctrl.setShowAltText((v) => !v)
          }
          onBringForward={
            ctrl.isSlideMasterOpen
              ? ctrl.handleMasterBringForward
              : ctrl.handleBringForward
          }
          onSendBackward={
            ctrl.isSlideMasterOpen
              ? ctrl.handleMasterSendBackward
              : ctrl.handleSendBackward
          }
          onChangePicture={ctrl.handleChangePicture}
          onPreviewMediaEffects={ctrl.setPreviewMediaEffects}
          onPreviewMediaStyle={ctrl.setPreviewMediaStyleId}
        />
      </div>

      <div className="editor-body">
        {ctrl.isSlideMasterOpen ? (
          <SlideMasterView
            presentation={ctrl.presentation}
            activeMasterSlide={ctrl.activeMasterSlide}
            selectedMasterLayoutId={ctrl.selectedMasterLayoutId}
            onSelectedLayoutChange={ctrl.setSelectedMasterLayoutId}
            selectedMasterElementId={ctrl.selectedMasterElementId}
            selectedMasterElementIds={ctrl.selectedMasterElementIds}
            onSelectMasterElement={ctrl.handleMasterElementSelect}
            onSaveSelection={ctrl.handleMasterSaveSelection}
            onStartEditing={ctrl.handleStartEditing}
            onStopEditing={ctrl.handleStopEditing}
            onMasterViewChangeText={ctrl.masterViewChangeText}
            onMasterViewChangeParagraphs={ctrl.masterViewChangeParagraphs}
            onMasterViewFormatText={ctrl.masterViewFormatText}
            onMasterViewMoveText={ctrl.masterViewMoveText}
            onMasterViewResizeText={ctrl.masterViewResizeText}
            onMasterViewMoveMedia={ctrl.masterViewMoveMedia}
            onMasterViewResizeMedia={ctrl.masterViewResizeMedia}
            onMasterViewAutoFitText={ctrl.masterViewAutoFitText}
            onMasterViewAutoFitMedia={ctrl.masterViewAutoFitMedia}
            onMasterViewDeleteText={ctrl.masterViewDeleteText}
            onMasterViewDeleteMedia={ctrl.masterViewDeleteMedia}
            onMasterViewDeleteSelection={ctrl.masterViewDeleteSelection}
            cropSignal={ctrl.cropSignal}
            onBeginHistory={ctrl.beginHistory}
            onCommitHistory={ctrl.commitHistory}
            onCancelHistory={ctrl.cancelHistory}
            onUndo={ctrl.undo}
            onRedo={ctrl.redo}
            onBringToFront={ctrl.handleMasterBringToFront}
            onBringForward={ctrl.handleMasterBringForward}
            onSendBackward={ctrl.handleMasterSendBackward}
            onSendToBack={ctrl.handleMasterSendToBack}
            formatPainterClipboard={ctrl.state.formatPainterClipboard}
            onFormatPainterCopy={ctrl.formatPainterCopy}
            onFormatPainterPaste={ctrl.formatPainterPaste}
          />
        ) : ctrl.currentView === "slide-sorter" ? (
          <SlideSorterView
            slides={ctrl.slides}
            selectedSlideIndex={ctrl.selectedSlideIndex}
            onSelectSlide={ctrl.setSelectedSlideId}
            onReorderSlide={ctrl.reorderSlide}
            onDeleteSlide={ctrl.deleteSlide}
            presentation={ctrl.presentation}
          />
        ) : ctrl.currentView === "notes-page" ? (
          <NotesPageView
            slides={ctrl.slides}
            selectedSlideIndex={ctrl.selectedSlideIndex}
            presentation={ctrl.presentation}
            onSelectSlide={ctrl.setSelectedSlideId}
            onUpdateSlideNotes={ctrl.updateSlideNotes}
            onBeginHistory={ctrl.beginHistory}
            onCommitHistory={ctrl.commitHistory}
          />
        ) : (
          <>
            {ctrl.currentView === "outline" ? (
              <OutlineView
                slides={ctrl.slides}
                selectedSlideIndex={ctrl.selectedSlideIndex}
                onSelectSlide={ctrl.setSelectedSlideId}
              />
            ) : (
              <SlideList
                slides={ctrl.slides}
                selectedSlideId={ctrl.selectedSlideIndex}
                onSelectSlide={ctrl.setSelectedSlideId}
                onReorderSlide={ctrl.reorderSlide}
                onDeleteSlide={ctrl.deleteSlide}
                slideWidth={ctrl.slideWidth}
                slideHeight={ctrl.slideHeight}
                presentation={displayPresentation}
              />
            )}

            <div className="editor-main">
              {ctrl.selectedSlide && (
                <EditorCanvas
                  slide={ctrl.selectedSlide}
                  presentation={displayPresentation}
                  onChangeTextElement={ctrl.updateTextElementContent}
                  onChangeParagraphs={ctrl.handleChangeParagraphs}
                  onMoveTextElement={ctrl.handleMoveElement}
                  onResizeTextElement={ctrl.updateElementSize}
                  onFormatTextElement={ctrl.applyFormatting}
                  currentFormatting={ctrl.currentFormatting}
                  hyperlinkText={ctrl.selectedHyperlinkText}
                  onNavigateToSlide={ctrl.setSelectedSlideId}
                  onFormatTextRangeElement={ctrl.updateTextRangeFormatting}
                  clearSelectionSignal={ctrl.clearSelectionSignal}
                  onSaveSelection={ctrl.handleSaveSelection}
                  onMoveMediaElement={ctrl.handleMoveElement}
                  onResizeMediaElement={ctrl.updateElementSize}
                  onDeleteTextElement={ctrl.deleteTextElement}
                  onDeleteMedia={ctrl.deleteMedia}
                  slideNotes={ctrl.selectedSlide?.contents?.notes ?? ""}
                  onUpdateSlideNotes={ctrl.updateSlideNotes}
                  zoom={ctrl.zoom}
                  showNotes={ctrl.showNotes}
                  onCanvasZoom={ctrl.handleCanvasZoom}
                  selectedElementId={ctrl.selectedElementId}
                  selectedElementIds={ctrl.selectedElementIds}
                  onSelectElement={ctrl.handleElementSelect}
                  onDeleteSelection={ctrl.handleDeleteSelection}
                  onSelectAll={ctrl.handleSelectAll}
                  objectSelectionMode={ctrl.objectSelectionMode}
                  onBeginHistory={ctrl.beginHistory}
                  onCommitHistory={ctrl.commitHistory}
                  onCancelHistory={ctrl.cancelHistory}
                  updateElement={ctrl.updateElement}
                  updateElementSilent={ctrl.updateElementSilent}
                  updateMedia={ctrl.updateMedia}
                  previewEffect={ctrl.previewEffect}
                  animations={ctrl.selectedSlide?.contents?.animations ?? []}
                  showAnimationBadges={ctrl.activeTab === "Animations"}
                  onUndo={ctrl.undo}
                  onRedo={ctrl.redo}
                  onCopy={ctrl.handleCopy}
                  onPaste={ctrl.handlePaste}
                  onPasteText={ctrl.handlePasteText}
                  onPastePicture={ctrl.handlePastePicture}
                  onCut={ctrl.handleCut}
                  canCopyCut={ctrl.canCopyCut}
                  onPlaceholderImageUpload={ctrl.handlePlaceholderImageUpload}
                  onPlaceholderVideoUpload={ctrl.handlePlaceholderVideoUpload}
                  onHyperlink={ctrl.handleHyperlink}
                  onRemoveHyperlink={ctrl.handleRemoveHyperlink}
                  existingHyperlink={ctrl.selectedHyperlinkLink}
                  canHyperlink={ctrl.hasRealSelection}
                  canPaste={ctrl.canPaste}
                  canUndo={ctrl.state.past.length > 0}
                  canRedo={ctrl.state.future.length > 0}
                  onBringToFront={ctrl.handleBringToFront}
                  onBringForward={ctrl.handleBringForward}
                  onSendBackward={ctrl.handleSendBackward}
                  onSendToBack={ctrl.handleSendToBack}
                  onRotateRight={ctrl.handleRotateRight}
                  onNewComment={ctrl.handleNewComment}
                  onOpenPictureFormat={() => ctrl.setActiveTab("Picture Format")}
                  cropSignal={ctrl.cropSignal}
                  previewMediaEffects={ctrl.previewMediaEffects}
                  previewMediaStyleId={ctrl.previewMediaStyleId}
                  onStartEditing={ctrl.handleStartEditing}
                  onStopEditing={ctrl.handleStopEditing}
                  pendingFormatting={ctrl.activePendingFormatting}
                  onClearPendingFormatting={() => ctrl.setPendingFormatting({})}
                  formatPainterClipboard={ctrl.state.formatPainterClipboard}
                  onFormatPainterCopy={ctrl.formatPainterCopy}
                  onFormatPainterPaste={ctrl.formatPainterPaste}
                  onPromoteLayoutElement={ctrl.promoteLayoutElement}
                  onSuppressLayoutPlaceholder={ctrl.suppressLayoutPlaceholder}
                />
              )}
            </div>

            {ctrl.showComments && (
              <CommentsPanel
                key={ctrl.composeSession}
                comments={ctrl.selectedSlide?.contents?.comments ?? []}
                authorName="User"
                onAdd={ctrl.addComment}
                onDelete={ctrl.deleteComment}
                onClose={() => ctrl.setShowComments(false)}
                autoCompose={ctrl.composeSession > 0}
              />
            )}

            {ctrl.showSelectionPane && (
              <SelectionPane
                slide={ctrl.selectedSlide}
                selectedElementId={ctrl.selectedElementId}
                selectedElementIds={ctrl.selectedElementIds}
                onSelectElement={ctrl.handleElementSelect}
                onSetVisibility={ctrl.handleSetElementsVisibility}
                onMoveLayer={ctrl.handleMoveSelectionLayer}
                onClose={() => ctrl.setShowSelectionPane(false)}
              />
            )}
          </>
        )}

        {ctrl.showFormatBackground && !ctrl.isSlideMasterOpen && (
          <FormatBackgroundPanel
            slide={ctrl.selectedSlide}
            presentation={ctrl.presentation}
            onApplySlideBackground={ctrl.handleApplySlideBackground}
            onApplyBgFillImage={ctrl.handleApplyBgFillImage}
            onApplyBackgroundToAll={ctrl.handleApplyBackgroundToAll}
            onClose={() => ctrl.setShowFormatBackground(false)}
          />
        )}

        {ctrl.showAltText && !ctrl.isSlideMasterOpen && (
          <AltTextPanel
            media={ctrl.selectedMediaElement}
            onUpdate={updateSelectedMedia}
            onClose={() => ctrl.setShowAltText(false)}
          />
        )}
      </div>

      <FindReplaceDialog
        mode={ctrl.findReplaceMode}
        controller={ctrl.findReplace}
        onClose={ctrl.findReplace.close}
      />

      <div className="statusbar-overlay">
        <StatusBar
          selectedSlideIndex={ctrl.selectedSlideIndex}
          totalSlides={ctrl.slides.length}
          saveStatus={ctrl.saveStatus}
          linkedFolderPath={ctrl.linkedFolderPath}
          zoom={ctrl.zoom}
          onZoomChange={ctrl.setZoom}
          onZoomIn={ctrl.zoomIn}
          onZoomOut={ctrl.zoomOut}
          showNotes={ctrl.showNotes}
          onToggleNotes={ctrl.toggleNotes}
          showComments={ctrl.showComments}
          onToggleComments={() => ctrl.setShowComments((visible) => !visible)}
          commentCount={ctrl.selectedSlide?.contents?.comments?.length ?? 0}
        />
      </div>

      {ctrl.isPreviewOpen && (
        <PreviewModal
          slides={ctrl.slides}
          presentation={ctrl.presentation}
          onClose={ctrl.closePreview}
          initialSlide={ctrl.previewStartSlide}
        />
      )}
    </div>
  );
}

import MediaContextMenu from "../../menus/MediaContextMenu";
import ImageStylePicker from "../../media/ImageStylePicker";

export default function MediaElementMenus({
  media,
  contextMenu,
  stylePicker,
  onEnterCropMode,
  onNewComment,
  onCloseContextMenu,
  onOpenStylePicker,
  onPreviewStyle,
  onSelectStyle,
  onCloseStylePicker,
}) {
  return (
    <>
      {contextMenu && (
        <MediaContextMenu
          position={contextMenu}
          onCrop={onEnterCropMode}
          onStyle={onOpenStylePicker}
          onNewComment={onNewComment}
          onClose={onCloseContextMenu}
        />
      )}

      {stylePicker && (
        <ImageStylePicker
          media={media}
          position={stylePicker}
          currentStyleId={media.effects?.["style-id"]}
          onPreview={onPreviewStyle}
          onSelect={onSelectStyle}
          onClose={onCloseStylePicker}
        />
      )}
    </>
  );
}

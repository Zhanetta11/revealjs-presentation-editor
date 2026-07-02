import {
  MdAddComment,
  MdDeleteOutline,
  MdFlipToBack,
  MdFlipToFront,
  MdRotateRight,
  MdSelectAll,
  MdVerticalAlignBottom,
  MdVerticalAlignTop,
} from "react-icons/md";
import { ContextMenuItem } from "./ContextMenuItem";

export default function CanvasSelectionMenu({
  hasSelection,
  run,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onRotateRight,
  onNewComment,
  onDelete,
  onSelectAll,
}) {
  if (!hasSelection) {
    return (
      <>
        <div className="canvas-context-menu-separator" />
        <ContextMenuItem
          icon={<MdSelectAll />}
          label="Select All"
          shortcut="Ctrl+A"
          onClick={() => run(onSelectAll)}
        />
      </>
    );
  }

  return (
    <>
      <div className="canvas-context-menu-separator" />
      <ContextMenuItem
        icon={<MdVerticalAlignTop />}
        label="Bring to Front"
        onClick={() => run(onBringToFront)}
      />
      <ContextMenuItem
        icon={<MdFlipToFront />}
        label="Bring Forward"
        onClick={() => run(onBringForward)}
      />
      <ContextMenuItem
        icon={<MdFlipToBack />}
        label="Send Backward"
        onClick={() => run(onSendBackward)}
      />
      <ContextMenuItem
        icon={<MdVerticalAlignBottom />}
        label="Send to Back"
        onClick={() => run(onSendToBack)}
      />
      <ContextMenuItem
        icon={<MdRotateRight />}
        label="Rotate Right 90°"
        onClick={() => run(onRotateRight)}
      />
      <div className="canvas-context-menu-separator" />
      {Boolean(onNewComment) && (
        <ContextMenuItem
          icon={<MdAddComment />}
          label="New Comment"
          onClick={() => run(onNewComment)}
        />
      )}
      <ContextMenuItem
        icon={<MdDeleteOutline />}
        label="Delete"
        shortcut="Del"
        onClick={() => run(onDelete)}
      />
    </>
  );
}

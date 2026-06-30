import {
  MdAddComment,
  MdContentCopy,
  MdDeleteOutline,
  MdExitToApp,
  MdFontDownload,
  MdFormatAlignLeft,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdLink,
  MdLinkOff,
  MdOpenInNew,
} from "react-icons/md";
import { ContextMenuItem } from "./ContextMenuItem";

const BULLET_STYLES = [
  { value: null, label: "None" },
  { value: "\u2022", label: "• Filled circle" },
  { value: "\u25cb", label: "○ Open circle" },
  { value: "\u25aa", label: "▪ Square" },
  { value: "\u2756", label: "❖ Diamond" },
  { value: "\u2713", label: "✓ Checkmark" },
];

const NUMBER_STYLES = [
  { value: null, label: "None" },
  { value: "decimal", label: "1. 2. 3." },
  { value: "lower-alpha", label: "a. b. c." },
  { value: "upper-alpha", label: "A. B. C." },
  { value: "lower-roman", label: "i. ii. iii." },
  { value: "upper-roman", label: "I. II. III." },
];

function ListStyleMenu({
  icon,
  label,
  menuName,
  styles,
  submenu,
  setSubmenu,
  isActive,
  buildFormatting,
  applyFormatting,
  run,
}) {
  return (
    <div
      className="canvas-context-submenu-owner"
      onMouseLeave={() => setSubmenu(null)}
    >
      <ContextMenuItem
        icon={icon}
        label={label}
        submenu
        onMouseEnter={() => setSubmenu(menuName)}
        onClick={() =>
          setSubmenu((current) => (current === menuName ? null : menuName))
        }
      />
      {submenu === menuName && (
        <div className="canvas-context-submenu">
          {styles.map((style) => (
            <button
              type="button"
              key={style.label}
              className={isActive(style) ? "active" : ""}
              onClick={() =>
                run(() => applyFormatting(buildFormatting(style)))
              }
            >
              {style.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TextFormattingMenu({
  elementId,
  formatting,
  matches,
  submenu,
  setSubmenu,
  setDialog,
  run,
  onExitEditText,
  onDelete,
  onNewComment,
  applyFormatting,
  existingLink = null,
  onRemoveLink,
}) {
  const indentLevel = formatting["indent-level"] ?? 0;

  return (
    <>
      <div className="canvas-context-menu-separator" />
      {matches("Exit Edit Text") && (
        <ContextMenuItem
          icon={<MdExitToApp />}
          label="Exit Edit Text"
          onClick={() => run(() => onExitEditText?.(elementId))}
        />
      )}
      {onDelete && matches("Delete") && (
        <ContextMenuItem
          icon={<MdDeleteOutline />}
          label="Delete"
          onClick={() => run(onDelete)}
        />
      )}
      {matches("Font") && (
        <ContextMenuItem
          icon={<MdFontDownload />}
          label="Font..."
          onClick={() => setDialog("font")}
        />
      )}
      {matches("Paragraph") && (
        <ContextMenuItem
          icon={<MdFormatAlignLeft />}
          label="Paragraph..."
          onClick={() => setDialog("paragraph")}
        />
      )}
      {matches("Bullets") && (
        <ListStyleMenu
          icon={<MdFormatListBulleted />}
          label="Bullets"
          menuName="bullets"
          styles={BULLET_STYLES}
          submenu={submenu}
          setSubmenu={setSubmenu}
          isActive={(style) =>
            formatting["list-type"] === "bullets" &&
            formatting["list-marker"] === style.value
          }
          buildFormatting={(style) =>
            style.value === null
              ? {
                  "list-type": "none",
                  "list-marker": null,
                  "indent-level": 0,
                }
              : {
                  "list-type": "bullets",
                  "list-marker": style.value,
                  "indent-level": indentLevel,
                }
          }
          applyFormatting={applyFormatting}
          run={run}
        />
      )}
      {matches("Numbering") && (
        <ListStyleMenu
          icon={<MdFormatListNumbered />}
          label="Numbering"
          menuName="numbering"
          styles={NUMBER_STYLES}
          submenu={submenu}
          setSubmenu={setSubmenu}
          isActive={(style) =>
            formatting["list-type"] === "numbered" &&
            formatting["list-numbered-style"] === style.value
          }
          buildFormatting={(style) =>
            style.value === null
              ? {
                  "list-type": "none",
                  "list-numbered-style": null,
                  "indent-level": 0,
                }
              : {
                  "list-type": "numbered",
                  "list-numbered-style": style.value,
                  "indent-level": indentLevel,
                }
          }
          applyFormatting={applyFormatting}
          run={run}
        />
      )}
      {matches("Hyperlink") && (
        <>
          <div className="canvas-context-menu-separator" />
          {existingLink ? (
            <>
              <ContextMenuItem
                icon={<MdLink />}
                label="Edit Link"
                onClick={() => setDialog("hyperlink")}
              />
              <ContextMenuItem
                icon={<MdOpenInNew />}
                label="Open Link"
                onClick={() => run(() => window.open(existingLink.href, "_blank", "noopener"))}
              />
              <ContextMenuItem
                icon={<MdContentCopy />}
                label="Copy Link"
                onClick={() => run(() => navigator.clipboard.writeText(existingLink.href))}
              />
              <ContextMenuItem
                icon={<MdLinkOff />}
                label="Remove Link"
                onClick={() => run(onRemoveLink)}
              />
            </>
          ) : (
            <ContextMenuItem
              icon={<MdLink />}
              label="Hyperlink..."
              onClick={() => setDialog("hyperlink")}
            />
          )}
        </>
      )}
      {matches("New Comment") && (
        <>
          <div className="canvas-context-menu-separator" />
          <ContextMenuItem
            icon={<MdAddComment />}
            label="New Comment"
            onClick={() => run(onNewComment)}
          />
        </>
      )}
    </>
  );
}

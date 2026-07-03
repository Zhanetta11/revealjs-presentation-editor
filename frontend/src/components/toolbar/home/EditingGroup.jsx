import { useEffect, useRef, useState } from "react";
import {
  MdOutlineFindReplace,
  MdSelectAll,
  MdViewList,
} from "react-icons/md";
import { FiSearch, FiMousePointer } from "react-icons/fi";
import "./EditingGroup.css";

export default function EditingGroup({
  onFind,
  onReplace,
  onSelectAll,
  onSelectObjects,
  onOpenSelectionPane,
  objectSelectionMode = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const groupRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event) => {
      if (!groupRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenu]);

  const run = (callback) => {
    setOpenMenu(null);
    callback?.();
  };

  return (
    <div className="ribbon-group editing-group" ref={groupRef}>
      <button className="editing-command" onClick={onFind} title="Find">
        <FiSearch className="editing-find-icon" />
        <span>Find</span>
      </button>

      <div className="editing-dropdown">
        <button
          className={`editing-command ${openMenu === "replace" ? "active" : ""}`}
          onClick={() =>
            setOpenMenu((current) => (current === "replace" ? null : "replace"))
          }
        >
          <span className="editing-replace-glyph" aria-hidden="true">
            <span>a</span>
            <span>b</span>
          </span>
          <span>Replace</span>
          <span className="editing-chevron">▾</span>
        </button>
        {openMenu === "replace" && (
          <div className="editing-menu">
            <button onClick={() => run(onReplace)}>
              <MdOutlineFindReplace />
              <span>Replace...</span>
            </button>
          </div>
        )}
      </div>

      <div className="editing-dropdown">
        <button
          className={`editing-command ${
            openMenu === "select" || objectSelectionMode ? "active" : ""
          }`}
          onClick={() =>
            setOpenMenu((current) => (current === "select" ? null : "select"))
          }
        >
          <FiMousePointer className="editing-select-icon" />
          <span>Select</span>
          <span className="editing-chevron">▾</span>
        </button>
        {openMenu === "select" && (
          <div className="editing-menu editing-select-menu">
            <button onClick={() => run(onSelectAll)}>
              <MdSelectAll />
              <span>Select All</span>
            </button>
            <button
              className={objectSelectionMode ? "selected-command" : ""}
              onClick={() => run(onSelectObjects)}
            >
              <FiMousePointer />
              <span>Select Objects</span>
            </button>
            <button onClick={() => run(onOpenSelectionPane)}>
              <MdViewList />
              <span>Selection Pane...</span>
            </button>
          </div>
        )}
      </div>

      <div className="ribbon-group-title">Editing</div>
    </div>
  );
}

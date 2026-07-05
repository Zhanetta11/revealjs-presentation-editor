import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./FileMenu.css";
import { greeting, formatDate } from "../../core/utils/dateUtils";
import { isElectron, getElectronAPI } from "../../core/platform/electron";
import {
  usesProjectFolders,
  useProjectLibrary,
} from "../../hooks/useProjectLibrary";

const NAV_ITEMS = [
  { label: "Home",        section: "top" },
  { label: "New",         section: "top" },
  { label: "Open",        section: "top" },
  { label: "Save",        section: "top" },
  { label: "Save As",     section: "top" },
  { label: "Export HTML", section: "top" },
  { label: "Export ZIP",  section: "top" },
  { label: "Delete",      section: "danger" },
  { label: "Close",       section: "bottom" },
];

export default function FileMenu({
  presentationTitle,
  onClose,
  onClosePresentation,
  onNew,
  onOpen,
  onOpenProjectFolder,
  onOpenProject,
  onSave,
  onSaveAs,
  onExport,
  onExportZip,
  onLoadFile,
  onDelete,
}) {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Home");
  const { presentations, recentProjects, draftPresentations } = useProjectLibrary();
  const fileInputRef = useRef(null);

  const handleOpenProject = async (key) => {
    try {
      const opened = await onOpenProject?.(key);
      if (opened) onClose?.();
    } catch (e) {
      console.error("[FileMenu] Failed to open recent project:", e);
      const message = e?.message ?? "Could not open this presentation.";
      if (isElectron()) getElectronAPI().showError("Open Failed", message);
      else window.alert(message);
    }
  };

  const handleOpenProjectFolder = async () => {
    const opened = await (onOpenProjectFolder ?? onOpen)?.();
    if (opened) onClose?.();
  };

  const handleImportJson = () => {
    fileInputRef.current?.click();
  };

  const handleOpen = () => {
    if (usesProjectFolders()) {
      handleOpenProjectFolder();
      return;
    }
    handleImportJson();
  };

  const handleNav = (item) => {
    if (item === "Close") { onClosePresentation?.(); return; }
    if (item === "Save") { onSave(); onClose(); return; }
    if (item === "Export HTML") { onExport(); onClose(); return; }
    if (item === "Export ZIP") { onExportZip?.(); onClose(); return; }
    if (item === "Open") { handleOpen(); return; }
    setActiveItem(item);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onLoadFile?.(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleNew = () => onNew?.();

  return (
    <div className="file-menu">
      <aside className="file-menu-sidebar">
        <button className="file-menu-back" onClick={onClose}>
          ← Back
        </button>
        <nav className="file-menu-nav">
          {NAV_ITEMS.map(({ label, section }) => (
            <button
              key={label}
              className={[
                "file-menu-nav-item",
                activeItem === label ? "active" : "",
                section === "danger" ? "danger" : "",
                section === "bottom" ? "bottom" : "",
              ].join(" ")}
              onClick={() => {
                if (label === "Delete") { onDelete?.(); return; }
                handleNav(label);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="file-menu-content">
        {activeItem === "Home" && (
          <div className="file-menu-home">
            <h1 className="file-menu-greeting">{greeting()}</h1>

            <section>
              <h2>New</h2>
              <div className="file-menu-templates">
                <button className="file-menu-template" onClick={handleNew}>
                  <div className="file-menu-template-thumb blank">+</div>
                  <span>Blank Presentation</span>
                </button>
              </div>
            </section>

            {usesProjectFolders() && draftPresentations.length > 0 && (
              <section>
                <h2>Unsaved Drafts</h2>
                <ul className="file-menu-recent-list">
                  {draftPresentations.map((p) => (
                    <li
                      key={p.id}
                      className="file-menu-recent-item"
                      onClick={() => { navigate(`/editor/${p.id}`); onClose?.(); }}
                    >
                      <span className="file-menu-recent-icon">📄</span>
                      <div>
                        <div className="file-menu-recent-name">{p.title}</div>
                        <div className="file-menu-recent-meta">
                          {formatDate(p.updatedAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2>Recent</h2>
              {(usesProjectFolders() ? recentProjects : presentations).length === 0 ? (
                <p className="file-menu-empty">No recent presentations</p>
              ) : usesProjectFolders() ? (
                <ul className="file-menu-recent-list">
                  {recentProjects.map((p) => (
                    <li
                      key={p.key}
                      className="file-menu-recent-item"
                      onClick={() => handleOpenProject(p.key)}
                    >
                      <span className="file-menu-recent-icon">📄</span>
                      <div>
                        <div className="file-menu-recent-name">{p.title}</div>
                        <div className="file-menu-recent-meta">
                          {formatDate(p.updatedAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="file-menu-recent-list">
                  {presentations.map((p) => (
                    <li
                      key={p.id}
                      className="file-menu-recent-item"
                      onClick={() => { navigate(`/editor/${p.id}`); onClose?.(); }}
                    >
                      <span className="file-menu-recent-icon">📄</span>
                      <div>
                        <div className="file-menu-recent-name">{p.title}</div>
                        <div className="file-menu-recent-meta">
                          {formatDate(p.updatedAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {activeItem === "New" && (
          <div className="file-menu-section">
            <h1>New</h1>
            <div className="file-menu-templates">
              <button className="file-menu-template" onClick={handleNew}>
                <div className="file-menu-template-thumb blank">+</div>
                <span>Blank Presentation</span>
              </button>
            </div>
          </div>
        )}

        {activeItem === "Save As" && (
          <div className="file-menu-section">
            <h1>Save As</h1>
            <p className="file-menu-desc">
              {usesProjectFolders()
                ? <>Save <strong>{presentationTitle}</strong> to a new project folder.</>
                : <>Download <strong>{presentationTitle}</strong> as a JSON file.</>}
            </p>
            <button
              className="file-menu-action-btn"
              onClick={() => { onSaveAs(); onClose(); }}
            >
              {usesProjectFolders() ? "Choose Project Folder" : "Download .json"}
            </button>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}


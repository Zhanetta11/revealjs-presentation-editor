import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRecentPresentations } from "../../hooks/useRecentPresentations";
import "./FileMenu.css";
import { greeting, formatDate } from "../../core/utils/dateUtils";
import { isElectron, getElectronAPI } from "../../core/platform/electron";

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
  onNew,
  onSave,
  onSaveAs,
  onExport,
  onExportZip,
  onLoadFile,
  onDelete,
}) {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Home");
  const { recent } = useRecentPresentations();
  const fileInputRef = useRef(null);

  const handleNav = (item) => {
    if (item === "Close") { onClose(); return; }
    if (item === "Save") { onSave(); onClose(); return; }
    if (item === "Export HTML") { onExport(); onClose(); return; }
    if (item === "Export ZIP") { onExportZip?.(); onClose(); return; }
    if (item === "Open") { handleOpen(); return; }
    setActiveItem(item);
  };

  const handleOpen = async () => {
    if (isElectron()) {
      const api = getElectronAPI();
      const [filePath] = await api.openFile();
      if (!filePath) return;
      const content = await api.readFile(filePath);
      onLoadFile?.(content);
      return;
    }
    fileInputRef.current?.click();
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

            <section>
              <h2>Recent</h2>
              {recent.length === 0 ? (
                <p className="file-menu-empty">No recent presentations</p>
              ) : (
                <ul className="file-menu-recent-list">
                  {recent.map((p) => (
                    <li
                      key={p.id}
                      className="file-menu-recent-item"
                      onClick={() => navigate(`/editor/${p.id}`)}
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
              Download <strong>{presentationTitle}</strong> as a JSON file.
            </p>
            <button
              className="file-menu-action-btn"
              onClick={() => { onSaveAs(); onClose(); }}
            >
              Download .json
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


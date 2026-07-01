import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIndex,
  createPresentation,
  deletePresentation,
} from "../core/persistence/persistenceFacade";
import "./HomePage.css";
import { greeting as getGreeting, formatDate } from "../core/utils/dateUtils";
import { isElectron, getElectronAPI } from "../core/platform/electron";

export default function HomePage() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState([]);

  useEffect(() => {
    getIndex().then(setPresentations);
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    return api.onBeforeQuit(() => api.notifyQuitReady());
  }, []);

  const handleNew = async () => {
    const id = await createPresentation("Untitled Presentation");
    navigate(`/editor/${id}`);
  };

  const handleOpen = (id) => {
    navigate(`/editor/${id}`);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this presentation?")) return;
    await deletePresentation(id);
    setPresentations((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="home-page">
      {/* Sidebar */}
      <aside className="home-sidebar">
        <div className="home-logo">🟠 Slides</div>
        <nav className="home-nav">
          <button className="home-nav-item active">Home</button>
          <button className="home-nav-item" onClick={handleNew}>
            New
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="home-main">
        <h1 className="home-greeting">{getGreeting()}</h1>

        {/* New section */}
        <section className="home-section">
          <h2>New</h2>
          <div className="home-templates">
            <button className="home-template" onClick={handleNew}>
              <div className="home-template-thumb blank">
                <span>+</span>
              </div>
              <span className="home-template-label">Blank Presentation</span>
            </button>
          </div>
        </section>

        {/* Recent section */}
        <section className="home-section">
          <h2>Recent</h2>
          {presentations.length === 0 ? (
            <p className="home-empty">
              No presentations yet. Create one above!
            </p>
          ) : (
            <ul className="home-recent-list">
              {presentations.map((p) => (
                <li
                  key={p.id}
                  className="home-recent-item"
                  onClick={() => handleOpen(p.id)}
                >
                  <div className="home-recent-thumb">
                    <span>📄</span>
                  </div>
                  <div className="home-recent-info">
                    <span className="home-recent-title">{p.title}</span>
                    <span className="home-recent-date">
                      {formatDate(p.updatedAt)}
                    </span>
                  </div>
                  <button
                    className="home-recent-delete"
                    onClick={(e) => handleDelete(e, p.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}


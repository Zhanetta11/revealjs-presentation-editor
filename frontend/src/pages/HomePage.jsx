import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIndex,
  createPresentation,
  deletePresentation,
} from "../core/persistence/persistenceFacade";
import { importPresentationFromJson } from "../core/persistence/importPresentation";
import "./HomePage.css";
import { greeting as getGreeting, formatDate } from "../core/utils/dateUtils";
import { isElectron, getElectronAPI } from "../core/platform/electron";

function useRecentProjects() {
  const [projects, setProjects] = useState([]);

  const refresh = async () => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    const paths = await api.getRecentProjects();
    const entries = await Promise.all(
      paths.map(async (path) => {
        try {
          const { text, updatedAt } = await api.readProjectManifest(path);
          const parsed = JSON.parse(text);
          const title = parsed?.slideset?.title ?? parsed?.slideset?.filename ?? "Untitled Presentation";
          return { path, title, updatedAt };
        } catch {
          return null;
        }
      }),
    );
    setProjects(entries.filter(Boolean));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { projects, refresh };
}

export default function HomePage() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState([]);
  const { projects: recentProjects, refresh: refreshRecentProjects } = useRecentProjects();

  useEffect(() => {
    if (isElectron()) return;
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

  const handleOpenProject = async (projectPath) => {
    const api = getElectronAPI();
    try {
      const jsonText = await api.openRecentProject(projectPath);
      const id = await importPresentationFromJson(jsonText);
      await api.linkPresentation(id, projectPath);
      navigate(`/editor/${id}`);
    } catch (e) {
      console.error("[HomePage] Failed to open recent project:", e);
      api.showError("Open Failed", e?.message ?? "Could not open this presentation.");
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this presentation?")) return;
    await deletePresentation(id);
    setPresentations((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRemoveRecentProject = async (e, projectPath) => {
    e.stopPropagation();
    await getElectronAPI().removeRecentProject(projectPath);
    refreshRecentProjects();
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
          {isElectron() ? (
            recentProjects.length === 0 ? (
              <p className="home-empty">
                No presentations yet. Create one above!
              </p>
            ) : (
              <ul className="home-recent-list">
                {recentProjects.map((p) => (
                  <li
                    key={p.path}
                    className="home-recent-item"
                    onClick={() => handleOpenProject(p.path)}
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
                      onClick={(e) => handleRemoveRecentProject(e, p.path)}
                      title="Remove from list"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : presentations.length === 0 ? (
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


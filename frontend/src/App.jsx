import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import HomePage from "./pages/HomePage";
import EditorPage from "./pages/EditorPage";
import { isElectron } from "./core/platform/electron";

function EditorPageKeyed() {
  const { presentationId } = useParams();
  return <EditorPage key={presentationId} />;
}

export default function App() {
  const Router = isElectron() ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/:presentationId" element={<EditorPageKeyed />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
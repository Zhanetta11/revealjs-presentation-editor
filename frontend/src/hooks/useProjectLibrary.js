import { useCallback, useEffect, useState } from "react";
import { getIndex } from "../core/persistence/persistenceFacade";
import { importPresentationFromJson } from "../core/persistence/importPresentation";
import { isElectron, getElectronAPI } from "../core/platform/electron";
import { supportsFileSystemAccess } from "../core/platform/fileSystemAccess";
import {
  getBrowserRecentProjects,
  getBrowserLinkedPresentationIds,
  openBrowserRecentProject,
  linkBrowserRecentProject,
  removeBrowserRecentProject,
  readMediaFileFromRecent,
} from "../core/persistence/browserProjectFolder";
import { rehydrateProjectManifestJson } from "../core/persistence/projectMediaRehydrate";

export const usesProjectFolders = () => isElectron() || supportsFileSystemAccess();

export function useProjectLibrary() {
  const [presentations, setPresentations] = useState([]);
  const [linkedIds, setLinkedIds] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  const refresh = useCallback(async () => {
    getIndex().then(setPresentations);
    if (isElectron()) {
      const api = getElectronAPI();
      api.getLinkedPresentationIds().then(setLinkedIds);
      const paths = await api.getRecentProjects();
      const entries = await Promise.all(
        paths.map(async (path) => {
          try {
            const { text, updatedAt } = await api.readProjectManifest(path);
            const parsed = JSON.parse(text);
            const title = parsed?.slideset?.title ?? parsed?.slideset?.filename ?? "Untitled Presentation";
            return { key: path, title, updatedAt };
          } catch {
            return null;
          }
        }),
      );
      setRecentProjects(entries.filter(Boolean));
    } else if (supportsFileSystemAccess()) {
      getBrowserLinkedPresentationIds().then(setLinkedIds);
      const entries = await getBrowserRecentProjects();
      setRecentProjects(entries.map((e) => ({ key: e.id, title: e.title, updatedAt: e.updatedAt })));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const draftPresentations = usesProjectFolders()
    ? presentations.filter((p) => !linkedIds.includes(p.id))
    : [];

  return { presentations, recentProjects, draftPresentations, refresh };
}

export async function openRecentProject(key) {
  const jsonText = isElectron()
    ? await getElectronAPI().openRecentProject(key)
    : await openBrowserRecentProject(key);
  const readFile = isElectron()
    ? (relativePath) => getElectronAPI().readProjectMediaFile(key, relativePath)
    : (relativePath) => readMediaFileFromRecent(key, relativePath);
  const rehydratedJsonText = await rehydrateProjectManifestJson(jsonText, readFile);
  const id = await importPresentationFromJson(rehydratedJsonText);
  if (isElectron()) {
    await getElectronAPI().linkPresentation(id, key);
  } else {
    await linkBrowserRecentProject(id, key);
  }
  return id;
}

export async function removeRecentProject(key) {
  if (isElectron()) await getElectronAPI().removeRecentProject(key);
  else await removeBrowserRecentProject(key);
}

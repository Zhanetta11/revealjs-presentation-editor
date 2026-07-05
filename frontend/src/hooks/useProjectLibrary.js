import { useCallback, useEffect, useState } from "react";
import {
  getIndex,
  getProjectPresentationSources,
  loadElectronProjectSnapshot,
  openElectronProjectFolder,
} from "../core/persistence/persistenceFacade";
import { importPresentationFromJson } from "../core/persistence/serialization/importPresentation";
import { isElectron, getElectronAPI } from "../core/platform/electron";
import { supportsFileSystemAccess } from "../core/platform/fileSystemAccess";
import {
  getBrowserRecentProjects,
  getBrowserLinkedPresentationIds,
  openBrowserRecentProject,
  linkBrowserRecentProject,
  isBrowserRecentProjectLinkedToPresentation,
  removeBrowserRecentProject,
  readMediaFileFromRecent,
} from "../core/persistence/project/browserProjectFolder";
import { rehydrateProjectManifestJson } from "../core/persistence/project/projectMediaRehydrate";

export const usesProjectFolders = () => isElectron() || supportsFileSystemAccess();

export function useProjectLibrary() {
  const [presentations, setPresentations] = useState([]);
  const [projectBackedIds, setProjectBackedIds] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  const refresh = useCallback(async () => {
    getIndex().then(setPresentations);
    if (isElectron()) {
      const api = getElectronAPI();
      getProjectPresentationSources()
        .then((sources) => setProjectBackedIds(sources.map((source) => source.presentationId)));
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
      getBrowserLinkedPresentationIds().then(setProjectBackedIds);
      const entries = await getBrowserRecentProjects();
      setRecentProjects(entries.map((e) => ({ key: e.id, title: e.title, updatedAt: e.updatedAt })));
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const draftPresentations = usesProjectFolders()
    ? presentations.filter((p) => !projectBackedIds.includes(p.id))
    : [];

  return { presentations, recentProjects, draftPresentations, refresh };
}

export async function openRecentProject(key, { asDraftCopy = false } = {}) {
  if (isElectron()) {
    if (asDraftCopy) {
      const { jsonText } = await loadElectronProjectSnapshot(key);
      return importPresentationFromJson(jsonText);
    }
    const { presentationId } = await openElectronProjectFolder(key);
    return presentationId;
  }
  const jsonText = await openBrowserRecentProject(key, {
    writable: !asDraftCopy,
  });
  const readFile = (relativePath) => readMediaFileFromRecent(key, relativePath);
  const rehydratedJsonText = await rehydrateProjectManifestJson(jsonText, readFile);
  const id = await importPresentationFromJson(rehydratedJsonText);
  if (!asDraftCopy) await linkBrowserRecentProject(id, key);
  return id;
}

const normalizeProjectFolder = (value) =>
  typeof value === "string"
    ? value.replace(/\\/g, "/").replace(/\/+$/, "")
    : "";

export async function isRecentProjectCurrentSource(
  key,
  presentationId,
  presentationSource,
) {
  if (
    presentationSource?.kind !== "project" ||
    !presentationSource.projectFolder
  ) {
    return false;
  }
  if (isElectron()) {
    return (
      normalizeProjectFolder(key) ===
      normalizeProjectFolder(presentationSource.projectFolder)
    );
  }
  return isBrowserRecentProjectLinkedToPresentation(presentationId, key);
}

export async function removeRecentProject(key) {
  if (isElectron()) await getElectronAPI().removeRecentProject(key);
  else await removeBrowserRecentProject(key);
}

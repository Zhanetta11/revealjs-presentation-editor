import { getElectronAPI, isElectron } from "../../platform/electron";
import { buildProjectManifest } from "./projectFolder";
import { rehydrateProjectManifestJson } from "./projectMediaRehydrate";

const requireElectronAPI = () => {
  if (!isElectron()) {
    throw new Error("Electron project folders are unavailable in browser mode.");
  }
  return getElectronAPI();
};

const projectCacheNamespace = async (projectFolder) => {
  const bytes = new TextEncoder().encode(projectFolder);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export async function chooseElectronProjectFolder(presentationTitle) {
  return requireElectronAPI().chooseProjectFolder(presentationTitle);
}

export async function chooseElectronProjectToOpen() {
  return requireElectronAPI().chooseProjectToOpen();
}

export async function openElectronProjectFolder(projectFolder) {
  if (!projectFolder) throw new Error("Missing project folder.");
  return requireElectronAPI().openProjectFolder(projectFolder);
}

export async function commitElectronProjectSource(presentationId, projectFolder) {
  if (!presentationId) throw new Error("Missing presentation id.");
  if (!projectFolder) throw new Error("Missing project folder.");
  return requireElectronAPI().commitProjectSource(presentationId, projectFolder);
}

export async function writeElectronProjectSnapshot({
  presentationId,
  presentation,
  projectFolder,
}) {
  if (!presentationId) throw new Error("Missing presentation id.");
  if (!projectFolder) throw new Error("Missing project folder.");

  const { jsonText, mediaFiles } = await buildProjectManifest(presentation, {
    requireResolvedMedia: true,
  });
  const files = [
    ...await Promise.all(
      mediaFiles.map(async ({ relativePath, blob }) => ({
        relativePath,
        kind: "binary",
        bytes: new Uint8Array(await blob.arrayBuffer()),
      })),
    ),
    {
      relativePath: "presentation.json",
      kind: "text",
      text: jsonText,
    },
  ];

  return requireElectronAPI().writeProjectSnapshot({
    presentationId,
    projectFolder,
    files,
  });
}

export async function loadElectronProjectSnapshot(projectFolder) {
  if (!projectFolder) throw new Error("Missing project folder.");
  const api = requireElectronAPI();
  const { text } = await api.loadProjectSnapshot(projectFolder);
  const cacheNamespace = await projectCacheNamespace(projectFolder);
  const jsonText = await rehydrateProjectManifestJson(
    text,
    (relativePath) => api.readProjectSnapshotFile(projectFolder, relativePath),
    {
      cacheKeyForPath: (relativePath) =>
        `media/project-${cacheNamespace}-${relativePath.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    },
  );
  return { jsonText, projectFolder };
}

export async function writeAndCommitElectronProjectSnapshot({
  presentationId,
  presentation,
  projectFolder,
}) {
  await writeElectronProjectSnapshot({
    presentationId,
    presentation,
    projectFolder,
  });
  return commitElectronProjectSource(presentationId, projectFolder);
}

import { isElectron, getElectronAPI } from "../platform/electron";
import { supportsFileSystemAccess } from "../platform/fileSystemAccess";
import { getBrowserLinkedFolderName } from "./browserProjectFolder";

export const PresentationSourceKind = Object.freeze({
  DRAFT: "draft",
  PROJECT: "project",
});

export const PresentationSourceStatus = Object.freeze({
  DRAFT: "draft",
  COMMITTING: "committing",
  PROJECT: "project",
});

export const createDraftSource = (presentationId) => ({
  kind: PresentationSourceKind.DRAFT,
  presentationId,
  projectFolder: null,
  status: PresentationSourceStatus.DRAFT,
});

export const createProjectSource = (presentationId, projectFolder) => ({
  kind: PresentationSourceKind.PROJECT,
  presentationId,
  projectFolder,
  status: PresentationSourceStatus.PROJECT,
});

export const createCommittingSource = (presentationId, projectFolder = null) => ({
  kind: projectFolder ? PresentationSourceKind.PROJECT : PresentationSourceKind.DRAFT,
  presentationId,
  projectFolder,
  status: PresentationSourceStatus.COMMITTING,
});

export const normalizePresentationSource = (source, presentationId) => {
  const id = source?.presentationId || presentationId;
  if (
    source?.kind === PresentationSourceKind.PROJECT
    && source?.status === PresentationSourceStatus.PROJECT
    && typeof source?.projectFolder === "string"
    && source.projectFolder.length > 0
  ) {
    return createProjectSource(id, source.projectFolder);
  }
  if (source?.status === PresentationSourceStatus.COMMITTING) {
    return createCommittingSource(
      id,
      typeof source?.projectFolder === "string" ? source.projectFolder : null,
    );
  }
  return createDraftSource(id);
};

export async function getPresentationSource(presentationId) {
  if (!presentationId) return createDraftSource(presentationId);
  if (isElectron()) {
    const source = await getElectronAPI().getPresentationSource(presentationId);
    return normalizePresentationSource(source, presentationId);
  }
  if (supportsFileSystemAccess()) {
    const projectFolder = await getBrowserLinkedFolderName(presentationId);
    return projectFolder
      ? createProjectSource(presentationId, projectFolder)
      : createDraftSource(presentationId);
  }
  return createDraftSource(presentationId);
}

export async function getProjectPresentationSources() {
  if (!isElectron()) return [];
  const sources = await getElectronAPI().getPresentationSources();
  return (Array.isArray(sources) ? sources : [])
    .map((source) => normalizePresentationSource(source, source?.presentationId))
    .filter((source) => source.kind === PresentationSourceKind.PROJECT);
}

export async function releasePresentationSource(presentationId) {
  if (!presentationId || !isElectron()) return;
  await getElectronAPI().releasePresentationSource(presentationId);
}

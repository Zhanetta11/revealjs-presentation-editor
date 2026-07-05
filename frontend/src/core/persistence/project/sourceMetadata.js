import { isElectron, getElectronAPI } from "../../platform/electron";
import { supportsFileSystemAccess } from "../../platform/fileSystemAccess";
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

export const PresentationSourcePlatform = Object.freeze({
  BROWSER: "browser",
  ELECTRON: "electron",
});

const currentSourcePlatform = () =>
  isElectron()
    ? PresentationSourcePlatform.ELECTRON
    : PresentationSourcePlatform.BROWSER;

const normalizeSourcePlatform = (platform) =>
  platform === PresentationSourcePlatform.ELECTRON
    ? PresentationSourcePlatform.ELECTRON
    : platform === PresentationSourcePlatform.BROWSER
      ? PresentationSourcePlatform.BROWSER
      : currentSourcePlatform();

export const createDraftSource = (
  presentationId,
  platform = currentSourcePlatform(),
) => ({
  kind: PresentationSourceKind.DRAFT,
  presentationId,
  projectFolder: null,
  status: PresentationSourceStatus.DRAFT,
  platform: normalizeSourcePlatform(platform),
});

export const createProjectSource = (
  presentationId,
  projectFolder,
  platform = currentSourcePlatform(),
) => ({
  kind: PresentationSourceKind.PROJECT,
  presentationId,
  projectFolder,
  status: PresentationSourceStatus.PROJECT,
  platform: normalizeSourcePlatform(platform),
});

export const createCommittingSource = (
  presentationId,
  projectFolder = null,
  platform = currentSourcePlatform(),
) => ({
  kind: projectFolder ? PresentationSourceKind.PROJECT : PresentationSourceKind.DRAFT,
  presentationId,
  projectFolder,
  status: PresentationSourceStatus.COMMITTING,
  platform: normalizeSourcePlatform(platform),
});

export const normalizePresentationSource = (source, presentationId) => {
  const id = source?.presentationId || presentationId;
  const platform = normalizeSourcePlatform(source?.platform);
  if (
    source?.kind === PresentationSourceKind.PROJECT
    && source?.status === PresentationSourceStatus.PROJECT
    && typeof source?.projectFolder === "string"
    && source.projectFolder.length > 0
  ) {
    return createProjectSource(id, source.projectFolder, platform);
  }
  if (source?.status === PresentationSourceStatus.COMMITTING) {
    return createCommittingSource(
      id,
      typeof source?.projectFolder === "string" ? source.projectFolder : null,
      platform,
    );
  }
  return createDraftSource(id, platform);
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

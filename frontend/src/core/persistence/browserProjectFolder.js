import { linkedFolderStore, recentProjectsStore } from "./browserProjectDb";
import { buildProjectManifest } from "./projectFolder";
import { rehydrateProjectManifestJson } from "./projectMediaRehydrate";

const sanitizeFolderName = (name) => {
  const cleaned = String(name || "Untitled Presentation")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || "Untitled Presentation";
};

async function verifyPermission(handle, mode = "readwrite") {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

async function isNonEmpty(dirHandle) {
  for await (const _ of dirHandle.values()) {
    return true;
  }
  return false;
}

async function findAvailableSubfolder(parentHandle, baseName) {
  let candidate = baseName;
  let suffix = 1;
  for (;;) {
    let existing = null;
    try {
      existing = await parentHandle.getDirectoryHandle(candidate);
    } catch {}
    if (!existing || !(await isNonEmpty(existing))) return candidate;
    candidate = `${baseName} (${suffix})`;
    suffix += 1;
  }
}

async function chooseNewProjectFolder(presentationTitle) {
  let parentHandle;
  try {
    parentHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (e) {
    if (e?.name === "AbortError") return null;
    throw e;
  }

  const baseName = sanitizeFolderName(presentationTitle);
  const folderName = await findAvailableSubfolder(parentHandle, baseName);
  const folderHandle = await parentHandle.getDirectoryHandle(folderName, { create: true });

  const media = await folderHandle.getDirectoryHandle("media", { create: true });
  await media.getDirectoryHandle("image", { create: true });
  await media.getDirectoryHandle("video", { create: true });
  await folderHandle.getDirectoryHandle("fonts", { create: true });

  return { folderHandle, folderName };
}

async function writeFileToFolder(folderHandle, relativePath, content) {
  const segments = relativePath.split("/");
  let dir = folderHandle;
  for (let i = 0; i < segments.length - 1; i += 1) {
    dir = await dir.getDirectoryHandle(segments[i], { create: true });
  }
  const fileHandle = await dir.getFileHandle(segments[segments.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readFileFromFolder(folderHandle, relativePath) {
  const segments = relativePath.split("/");
  let dir = folderHandle;
  for (let i = 0; i < segments.length - 1; i += 1) {
    dir = await dir.getDirectoryHandle(segments[i]);
  }
  const fileHandle = await dir.getFileHandle(segments[segments.length - 1]);
  const file = await fileHandle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function writeSnapshotFiles(folderHandle, files) {
  const manifest = files.find((file) => file.relativePath === "presentation.json");
  if (!manifest) throw new Error("Project snapshot is missing presentation.json.");

  for (const file of files) {
    if (file === manifest) continue;
    const content = file.kind === "binary" ? file.bytes : file.text;
    await writeFileToFolder(folderHandle, file.relativePath, content);
  }

  const manifestContent =
    manifest.kind === "binary" ? manifest.bytes : manifest.text;
  await writeFileToFolder(
    folderHandle,
    manifest.relativePath,
    manifestContent,
  );
}

async function buildBrowserProjectFiles(presentation) {
  const { jsonText, mediaFiles } = await buildProjectManifest(presentation, {
    requireResolvedMedia: true,
  });
  const assetFiles = await Promise.all(
    mediaFiles.map(async ({ relativePath, blob }) => ({
      relativePath,
      kind: "binary",
      bytes: new Uint8Array(await blob.arrayBuffer()),
    })),
  );
  return [
    ...assetFiles,
    {
      relativePath: "presentation.json",
      kind: "text",
      text: jsonText,
    },
  ];
}

async function getWritableLinkedFolder(presentationId) {
  const folderHandle = await linkedFolderStore.get(presentationId);
  if (!folderHandle) {
    throw new Error("The presentation is not linked to a browser project folder.");
  }
  const permission = await folderHandle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    throw new Error("Write permission for the browser project folder is unavailable.");
  }
  return folderHandle;
}

export async function saveProjectToBrowserFolder({ presentationId, presentationTitle, files, forceNewFolder }) {
  if (!presentationId) throw new Error("Missing presentation id.");

  let folderHandle = forceNewFolder ? null : await linkedFolderStore.get(presentationId);
  if (folderHandle && !(await verifyPermission(folderHandle))) {
    folderHandle = null;
  }

  let folderName;
  if (!folderHandle) {
    const chosen = await chooseNewProjectFolder(presentationTitle);
    if (!chosen) return null;
    folderHandle = chosen.folderHandle;
    folderName = chosen.folderName;
  } else {
    folderName = folderHandle.name;
  }

  await writeSnapshotFiles(folderHandle, files);

  await linkedFolderStore.set(presentationId, folderHandle);
  await recentProjectsStore.upsert({ handle: folderHandle, title: presentationTitle || folderName });

  return folderName;
}

export async function saveBrowserProjectSnapshot({
  presentationId,
  presentation,
  forceNewFolder = false,
}) {
  const presentationTitle =
    presentation?.slideset?.title
    ?? presentation?.slideset?.filename
    ?? "Untitled Presentation";
  const files = await buildBrowserProjectFiles(presentation);
  const projectFolder = await saveProjectToBrowserFolder({
    presentationId,
    presentationTitle,
    files,
    forceNewFolder,
  });
  return projectFolder
    ? { projectFolder, verified: true }
    : null;
}

export async function writeBrowserProjectSnapshot({
  presentationId,
  presentation,
}) {
  if (!presentationId) throw new Error("Missing presentation id.");
  const folderHandle = await getWritableLinkedFolder(presentationId);
  const files = await buildBrowserProjectFiles(presentation);
  await writeSnapshotFiles(folderHandle, files);

  const title =
    presentation?.slideset?.title
    ?? presentation?.slideset?.filename
    ?? folderHandle.name;
  await recentProjectsStore.upsert({ handle: folderHandle, title });
  return { projectFolder: folderHandle.name, verified: true };
}

export async function loadBrowserLinkedProjectSnapshot(presentationId) {
  if (!presentationId) throw new Error("Missing presentation id.");
  const folderHandle = await linkedFolderStore.get(presentationId);
  if (!folderHandle) {
    throw new Error("The presentation is not linked to a browser project folder.");
  }
  const permission = await folderHandle.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    throw new Error("Read permission for the browser project folder is unavailable.");
  }

  const fileHandle = await folderHandle.getFileHandle("presentation.json");
  const file = await fileHandle.getFile();
  const jsonText = await rehydrateProjectManifestJson(
    await file.text(),
    (relativePath) => readFileFromFolder(folderHandle, relativePath),
    {
      cacheKeyForPath: (relativePath) =>
        `media/browser-project-${presentationId}-${relativePath.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    },
  );
  return { jsonText, projectFolder: folderHandle.name };
}

export async function getBrowserLinkedFolderName(presentationId) {
  const handle = await linkedFolderStore.get(presentationId);
  if (!handle) return null;
  const granted = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
  return granted ? handle.name : null;
}

export async function getBrowserLinkedPresentationIds() {
  return linkedFolderStore.getAllIds();
}

export async function getBrowserRecentProjects() {
  const list = await recentProjectsStore.list();
  return list.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export async function openBrowserRecentProject(recentId) {
  const entry = await recentProjectsStore.get(recentId);
  if (!entry) throw new Error("This project is not in the recent list.");
  const allowed = await verifyPermission(entry.handle, "read");
  if (!allowed) throw new Error("Permission to access this folder was denied.");
  const fileHandle = await entry.handle.getFileHandle("presentation.json");
  const file = await fileHandle.getFile();
  return file.text();
}

export async function readMediaFileFromRecent(recentId, relativePath) {
  const entry = await recentProjectsStore.get(recentId);
  if (!entry) throw new Error("This project is not in the recent list.");
  return readFileFromFolder(entry.handle, relativePath);
}

export async function linkBrowserRecentProject(presentationId, recentId) {
  const entry = await recentProjectsStore.get(recentId);
  if (!entry) throw new Error("This project is not in the recent list.");
  await linkedFolderStore.set(presentationId, entry.handle);
}

export async function removeBrowserRecentProject(recentId) {
  await recentProjectsStore.remove(recentId);
}

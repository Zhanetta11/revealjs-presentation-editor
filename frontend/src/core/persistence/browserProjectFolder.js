import { linkedFolderStore, recentProjectsStore } from "./browserProjectDb";

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
    } catch {
      // Directory does not exist yet - candidate name is available.
    }
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

  for (const file of files) {
    const content = file.kind === "binary" ? file.bytes : file.text;
    await writeFileToFolder(folderHandle, file.relativePath, content);
  }

  await linkedFolderStore.set(presentationId, folderHandle);
  await recentProjectsStore.upsert({ handle: folderHandle, title: presentationTitle || folderName });

  return folderName;
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

export async function linkBrowserRecentProject(presentationId, recentId) {
  const entry = await recentProjectsStore.get(recentId);
  if (!entry) throw new Error("This project is not in the recent list.");
  await linkedFolderStore.set(presentationId, entry.handle);
}

export async function removeBrowserRecentProject(recentId) {
  await recentProjectsStore.remove(recentId);
}

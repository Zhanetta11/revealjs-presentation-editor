import { storageAdapter } from "./storageAdapter";
import { serializePresentation } from "./serializationOperations";

const INDEX_KEY = "presentations_index";

let indexQueue = Promise.resolve();
const withIndexLock = (fn) => {
  const run = () => globalThis.navigator?.locks
    ? navigator.locks.request("presentation-index", fn)
    : fn();
  const task = indexQueue.then(run);
  indexQueue = task.catch((e) => {
    console.error("[presentationsLibrary] index write failed:", e);
  });
  return task;
};

export function presentationKey(id) {
  return `presentation-${id}`;
}

export async function getIndex() {
  const stored = await storageAdapter.get(INDEX_KEY);
  if (stored && stored.length > 0) return stored;

  const ids = await storageAdapter.getAllPresentationIds();
  if (ids.length === 0) return [];

  const entries = await Promise.all(
    ids.map(async (id) => {
      const raw = await storageAdapter.get(presentationKey(id));
      let data;
      try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { data = null; }
      const title =
        data?.slideset?.title ??
        data?.slideset?.filename ??
        "Untitled Presentation";
      return { id, title, updatedAt: Date.now() };
    }),
  );

  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  await storageAdapter.set(INDEX_KEY, entries);
  return entries;
}

export async function createPresentation(title = "Untitled Presentation") {
  const id = crypto.randomUUID();
  await updateIndexEntry(id, title);
  return id;
}

export function updateIndexEntry(id, title) {
  return withIndexLock(async () => {
    const index = await getIndex();
    const pos = index.findIndex((p) => p.id === id);
    const entry = {
      id,
      title: title || "Untitled Presentation",
      updatedAt: Date.now(),
    };
    if (pos >= 0) {
      index[pos] = entry;
    } else {
      index.unshift(entry);
    }
    index.sort((a, b) => b.updatedAt - a.updatedAt);
    await storageAdapter.set(INDEX_KEY, index);
  });
}

export function deletePresentation(id) {
  return withIndexLock(async () => {
    const index = await getIndex();
    const raw = await storageAdapter.get(presentationKey(id));
    let presentation = null;
    try {
      presentation = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {}
    const mediaKeys = new Set();
    const findMediaKeys = (value, target = mediaKeys) => {
      if (Array.isArray(value)) return value.forEach((child) => findMediaKeys(child, target));
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (
          (key === "file-link" || key === "font-file")
          && typeof child === "string"
          && child.startsWith("indexeddb://")
        ) {
          target.add(child.slice("indexeddb://".length));
        } else {
          findMediaKeys(child, target);
        }
      }
    };
    findMediaKeys(presentation);
    const otherPresentationKeys = (await storageAdapter.getAllKeys()).filter(
      (key) => String(key).startsWith("presentation-") && key !== presentationKey(id),
    );
    for (const key of otherPresentationKeys) {
      try {
        const otherRaw = await storageAdapter.get(key);
        const other = typeof otherRaw === "string" ? JSON.parse(otherRaw) : otherRaw;
        const sharedKeys = new Set();
        findMediaKeys(other, sharedKeys);
        sharedKeys.forEach((sharedKey) => mediaKeys.delete(sharedKey));
      } catch {
        mediaKeys.clear();
        break;
      }
    }
    await storageAdapter.set(
      INDEX_KEY,
      index.filter((p) => p.id !== id),
    );
    await storageAdapter.remove(presentationKey(id));
    await Promise.all([...mediaKeys].map((key) => storageAdapter.remove(key)));
  });
}

export async function loadPresentation(id) {
  return storageAdapter.get(presentationKey(id));
}

export async function savePresentation(id, data) {
  const title = data?.slideset?.title ?? data?.slideset?.filename ?? "Untitled Presentation";
  await storageAdapter.set(presentationKey(id), serializePresentation(data));
  await updateIndexEntry(id, title);
}

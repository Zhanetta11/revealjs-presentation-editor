const DB_NAME = "editor-projects-db";
const DB_VERSION = 1;
const LINKED_STORE = "linkedFolders";
const RECENT_STORE = "recentProjects";
const MAX_RECENT = 10;

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(LINKED_STORE)) db.createObjectStore(LINKED_STORE);
        if (!db.objectStoreNames.contains(RECENT_STORE)) db.createObjectStore(RECENT_STORE);
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = (e) => {
        dbPromise = null;
        reject(e.target.error);
      };
    });
  }
  return dbPromise;
}

async function put(storeName, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function get(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = (e) => resolve(e.target.result ?? null);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function remove(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllEntries(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const entries = [];
    const request = store.openCursor();
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      entries.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

export const linkedFolderStore = {
  get: (presentationId) => get(LINKED_STORE, presentationId),
  set: (presentationId, handle) => put(LINKED_STORE, presentationId, handle),
  remove: (presentationId) => remove(LINKED_STORE, presentationId),
  async getAllIds() {
    const entries = await getAllEntries(LINKED_STORE);
    return entries.map((e) => e.key);
  },
};

async function findMatchingRecentId(handle) {
  const entries = await getAllEntries(RECENT_STORE);
  for (const { key, value } of entries) {
    try {
      if (await value.handle.isSameEntry(handle)) return key;
    } catch {
      // Stale/invalid handle - ignore.
    }
  }
  return null;
}

export const recentProjectsStore = {
  async list() {
    const entries = await getAllEntries(RECENT_STORE);
    return entries
      .map(({ key, value }) => ({ id: key, handle: value.handle, title: value.title, updatedAt: value.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id) {
    return get(RECENT_STORE, id);
  },

  async upsert({ handle, title }) {
    const existingId = await findMatchingRecentId(handle);
    const id = existingId ?? crypto.randomUUID();
    await put(RECENT_STORE, id, { handle, title, updatedAt: Date.now() });

    const list = await recentProjectsStore.list();
    const excess = list.slice(MAX_RECENT);
    await Promise.all(excess.map((entry) => remove(RECENT_STORE, entry.id)));

    return id;
  },

  remove: (id) => remove(RECENT_STORE, id),
};

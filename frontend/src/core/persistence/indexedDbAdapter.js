import { toStorageError } from "./storageErrors";

const DB_NAME = "editor-db";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (e.oldVersion < 1) {
          db.createObjectStore(STORE_NAME);
        }
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

export const indexedDbAdapter = {
  async set(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(toStorageError(e.target.error ?? tx.error));
      tx.onabort = () => reject(toStorageError(tx.error));
    });
  },

  async get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = (e) => resolve(e.target.result ?? null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async remove(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error);
    });
  },

  async getAllKeys() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllPresentationIds() {
    const keys = await this.getAllKeys();
    return keys
      .filter((k) => k.startsWith("presentation-"))
      .map((k) => k.slice("presentation-".length));
  },
};

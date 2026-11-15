import { STORAGE_KEYS, type StorageAdapter } from "@/lib/storage-contract";

// Keep the existing record keys so account sync and backups use the same data.
const overflow = new Map<string, string | null>();
const pending = new Map<string, string | null>();
let database: IDBDatabase | undefined;
let opening: Promise<void> | undefined;
let writing: Promise<void> | undefined;

export function initializeBrowserRecords() {
  if (!opening) opening = new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.open("daily-space-records", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("overflow");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Local record database is blocked."));
    request.onsuccess = () => {
      const db = request.result;
      const cursor = db.transaction("overflow").objectStore("overflow").openCursor();
      cursor.onerror = () => { db.close(); reject(cursor.error); };
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (entry) {
          overflow.set(String(entry.key), String(entry.value));
          entry.continue();
        } else {
          database = db;
          resolve();
        }
      };
    };
  });
  return opening;
}

export async function flushBrowserRecords(): Promise<void> {
  while (pending.size) {
    if (!writing) {
      const db = database;
      if (!db) throw new Error("Local record database is unavailable.");
      const batch = new Map(pending);
      writing = new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("overflow", "readwrite");
        const store = transaction.objectStore("overflow");
        try {
          for (const [key, value] of batch) {
            if (value === null) store.delete(key);
            else store.put(value, key);
          }
        } catch (error) {
          transaction.abort();
          reject(error);
          return;
        }
        transaction.oncomplete = () => {
          for (const [key, value] of batch) {
            if (pending.get(key) === value) pending.delete(key);
            if (value === null && overflow.get(key) === null) overflow.delete(key);
          }
          resolve();
        };
        transaction.onabort = () => reject(transaction.error ?? new Error("Local record write failed."));
      }).finally(() => { writing = undefined; });
    }
    await writing;
  }
}

function canOverflow(key: string) {
  return key === STORAGE_KEYS.journals ||
    key === STORAGE_KEYS.completionHistory ||
    key.startsWith("__daily_space_internal__:v1:") ||
    key.startsWith(STORAGE_KEYS.planPrefix) ||
    key.startsWith(STORAGE_KEYS.weeklyPrioritiesPrefix);
}

function queue(key: string, value: string | null) {
  overflow.set(key, value);
  pending.set(key, value);
  // Explicit saves await the transaction as well. Keep failed changes in
  // memory for retry rather than discarding the user's draft.
  void Promise.resolve().then(flushBrowserRecords).catch(() => {});
}

export function browserRecordKeys() {
  const native = window.localStorage;
  const keys = new Set<string>();
  for (let index = 0; index < native.length; index++) {
    const key = native.key(index);
    if (key !== null) keys.add(key);
  }
  for (const [key, value] of overflow) {
    if (value === null) keys.delete(key);
    else keys.add(key);
  }
  return [...keys];
}

export const browserRecords: StorageAdapter = {
  keys: browserRecordKeys,
  get length() { return browserRecordKeys().length; },
  key(index) { return browserRecordKeys()[index] ?? null; },
  getItem(key) {
    if (overflow.has(key)) return overflow.get(key) ?? null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (!overflow.has(key)) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (error) {
        if (!database || !canOverflow(key) || !(error instanceof DOMException) || error.name !== "QuotaExceededError") throw error;
      }
    }
    queue(key, value);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    if (overflow.has(key)) queue(key, null);
  },
};

import { isLocalStorageQuotaError, isManagedStorageKey, type StorageAdapter } from "@/lib/storage-contract";

// Keep the existing record keys so account sync and backups use the same data.
const overflow = new Map<string, string | null>();
const pending = new Map<string, string | null>();
let database: IDBDatabase | undefined;
let opening: Promise<void> | undefined;
let writing: Promise<void> | undefined;
let hydrated = false;

function closeDatabase(db: IDBDatabase) {
  if (database === db) {
    database = undefined;
    opening = undefined;
  }
  db.close();
}

export function initializeBrowserRecords() {
  if (!opening) opening = new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.open("daily-space-records", 1);
    const timer = window.setTimeout(() => fail(new Error("Local record database did not respond.")), 4_000);
    let failed = false;
    const fail = (error: unknown) => {
      failed = true;
      window.clearTimeout(timer);
      reject(error);
    };
    request.onupgradeneeded = () => request.result.createObjectStore("overflow");
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error("Local record database is blocked."));
    request.onsuccess = () => {
      const db = request.result;
      if (failed) { db.close(); return; }
      db.onclose = () => closeDatabase(db);
      db.onversionchange = () => closeDatabase(db);
      const cursor = db.transaction("overflow").objectStore("overflow").openCursor();
      cursor.onerror = () => { db.close(); fail(cursor.error); };
      cursor.onsuccess = () => {
        if (failed) { db.close(); return; }
        const entry = cursor.result;
        if (entry) {
          const key = String(entry.key);
          if (!overflow.has(key)) overflow.set(key, String(entry.value));
          entry.continue();
        } else {
          window.clearTimeout(timer);
          database = db;
          hydrated = true;
          resolve();
        }
      };
    };
  }).catch((error) => { opening = undefined; throw error; });
  return opening;
}

export async function flushBrowserRecords(): Promise<void> {
  while (pending.size) {
    if (!writing) {
      if (!database) await initializeBrowserRecords();
      if (writing) continue;
      const db = database;
      if (!db) throw new Error("Local record database is unavailable.");
      const batch = new Map(pending);
      writing = new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("overflow", "readwrite");
        const timer = window.setTimeout(() => {
          try { transaction.abort(); } catch { /* The browser already closed it. */ }
          closeDatabase(db);
          reject(new Error("Local record write did not respond."));
        }, 4_000);
        const store = transaction.objectStore("overflow");
        try {
          for (const [key, value] of batch) {
            if (value === null) store.delete(key);
            else store.put(value, key);
          }
        } catch (error) {
          window.clearTimeout(timer);
          transaction.abort();
          reject(error);
          return;
        }
        transaction.oncomplete = () => {
          window.clearTimeout(timer);
          for (const [key, value] of batch) {
            if (pending.get(key) === value) pending.delete(key);
            if (value === null && overflow.get(key) === null) overflow.delete(key);
          }
          resolve();
        };
        transaction.onabort = () => {
          window.clearTimeout(timer);
          reject(transaction.error ?? new DOMException("Local record write failed.", "AbortError"));
        };
      }).catch((error) => {
        if (error instanceof DOMException && ["InvalidStateError", "AbortError", "UnknownError"].includes(error.name)) {
          closeDatabase(db);
        }
        throw error;
      }).finally(() => { writing = undefined; });
    }
    await writing;
  }
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
    if (this.getItem(key) === value) return;
    if (!overflow.has(key)) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (error) {
        if (!hydrated || !(isManagedStorageKey(key) || key.startsWith("__daily_space_internal__:v1:"))
          || !isLocalStorageQuotaError(error)) throw error;
      }
    }
    queue(key, value);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    if (overflow.has(key)) queue(key, null);
  },
};

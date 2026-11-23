import {
  collectStoredRecords,
  isLocalStorageQuotaError,
  replaceStoredRecords,
  sanitizeStoredRecords,
  type StorageAdapter,
  type StoredRecords,
} from "@/lib/storage-contract";

const INTERNAL_PREFIX = "__daily_space_internal__:v1:";
const ACTIVE_USER_KEY = `${INTERNAL_PREFIX}active-user`;
const LEGACY_MIGRATED_KEY = `${INTERNAL_PREFIX}legacy-migrated`;
const memoryCaches = new WeakMap<StorageAdapter, Map<string, string>>();

function accountKey(userId: string, suffix: "records" | "sync") {
  return `${INTERNAL_PREFIX}account:${encodeURIComponent(userId)}:${suffix}`;
}

/** Removes only rebuildable account caches; visible records are untouched. */
export function clearAccountCaches(storage: StorageAdapter, userId: string) {
  for (const suffix of ["records", "sync"] as const) {
    const key = accountKey(userId, suffix);
    storage.removeItem(key);
    memoryCaches.get(storage)?.delete(key);
  }
}

function setAccountItem(storage: StorageAdapter, key: string, value: string) {
  try {
    storage.setItem(key, value);
    memoryCaches.get(storage)?.delete(key);
  } catch (error) {
    if (!isLocalStorageQuotaError(error)) throw error;
    cacheInMemory(storage, key, value);
  }
}

function cacheInMemory(storage: StorageAdapter, key: string, value: string) {
  let cache = memoryCaches.get(storage);
  if (!cache) {
    cache = new Map();
    memoryCaches.set(storage, cache);
  }
  cache.set(key, value);
  storage.removeItem(key);
}

function getAccountItem(storage: StorageAdapter, key: string) {
  return memoryCaches.get(storage)?.get(key) ?? storage.getItem(key);
}

export function setItemWithAccountCacheRetry(
  storage: StorageAdapter,
  key: string,
  value: string,
) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    if (!isLocalStorageQuotaError(error)) throw error;
    const userId = getActiveStorageUser(storage);
    if (!userId) throw error;

    // The active account's duplicate can stay in memory for sync.
    // Keep the persisted sync metadata and all visible records in place.
    const cacheKey = accountKey(userId, "records");
    const cached = storage.getItem(cacheKey);
    if (cached === null) throw error;
    cacheInMemory(storage, cacheKey, cached);
    storage.setItem(key, value);
  }
}

function parseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getActiveStorageUser(storage: StorageAdapter) {
  return storage.getItem(ACTIVE_USER_KEY);
}

export function readAccountRecords(
  storage: StorageAdapter,
  userId: string,
): StoredRecords {
  return sanitizeStoredRecords(
    parseObject(getAccountItem(storage, accountKey(userId, "records"))),
  );
}

export function writeAccountRecords(
  storage: StorageAdapter,
  userId: string,
  records: StoredRecords,
) {
  setAccountItem(
    storage,
    accountKey(userId, "records"),
    JSON.stringify(sanitizeStoredRecords(records)),
  );
}

export function readAccountSyncState<T extends Record<string, unknown>>(
  storage: StorageAdapter,
  userId: string,
): Partial<T> {
  return parseObject(getAccountItem(storage, accountKey(userId, "sync"))) as Partial<T>;
}

export function writeAccountSyncState(
  storage: StorageAdapter,
  userId: string,
  state: Record<string, unknown>,
) {
  setAccountItem(storage, accountKey(userId, "sync"), JSON.stringify(state));
}

/**
 * Swaps the public, legacy-compatible keys to the requested account. The first
 * account after this migration claims existing unscoped browser data once.
 */
export function activateAccountStorage(
  storage: StorageAdapter,
  userId: string,
) {
  if (!userId) throw new Error("A user id is required to activate storage.");

  const previousUserId = getActiveStorageUser(storage);
  const visibleRecords = collectStoredRecords(storage);

  if (previousUserId === userId) {
    // Keep the previous account snapshot intact until RecordSynchronizer has
    // compared it with visible records and assigned clocks to offline/imported
    // edits. Writing here would make a just-imported value look unchanged and
    // allow the older cloud value to overwrite it during startup.
    return visibleRecords;
  }

  if (previousUserId) {
    writeAccountRecords(storage, previousUserId, visibleRecords);
  } else if (
    !storage.getItem(LEGACY_MIGRATED_KEY) &&
    Object.keys(visibleRecords).length > 0
  ) {
    writeAccountRecords(storage, userId, visibleRecords);
    storage.setItem(LEGACY_MIGRATED_KEY, userId);
  }

  const accountRecords = readAccountRecords(storage, userId);
  replaceStoredRecords(storage, accountRecords);
  storage.setItem(ACTIVE_USER_KEY, userId);
  return accountRecords;
}

export function persistActiveAccountStorage(storage: StorageAdapter) {
  const userId = getActiveStorageUser(storage);
  if (!userId) return null;
  const records = collectStoredRecords(storage);
  writeAccountRecords(storage, userId, records);
  return { userId, records };
}

export function deactivateAccountStorage(
  storage: StorageAdapter,
  expectedUserId?: string,
) {
  const userId = getActiveStorageUser(storage);
  if (userId && (!expectedUserId || expectedUserId === userId)) {
    writeAccountRecords(storage, userId, collectStoredRecords(storage));
  }
  replaceStoredRecords(storage, {});
  storage.removeItem(ACTIVE_USER_KEY);
}

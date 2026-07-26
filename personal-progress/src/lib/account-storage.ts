import {
  collectStoredRecords,
  replaceStoredRecords,
  sanitizeStoredRecords,
  type StorageAdapter,
  type StoredRecords,
} from "@/lib/storage-contract";

const INTERNAL_PREFIX = "__daily_space_internal__:v1:";
const ACTIVE_USER_KEY = `${INTERNAL_PREFIX}active-user`;
const LEGACY_MIGRATED_KEY = `${INTERNAL_PREFIX}legacy-migrated`;

function accountKey(userId: string, suffix: "records" | "sync") {
  return `${INTERNAL_PREFIX}account:${encodeURIComponent(userId)}:${suffix}`;
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
    parseObject(storage.getItem(accountKey(userId, "records"))),
  );
}

export function writeAccountRecords(
  storage: StorageAdapter,
  userId: string,
  records: StoredRecords,
) {
  storage.setItem(
    accountKey(userId, "records"),
    JSON.stringify(sanitizeStoredRecords(records)),
  );
}

export function readAccountSyncState<T extends Record<string, unknown>>(
  storage: StorageAdapter,
  userId: string,
): Partial<T> {
  return parseObject(storage.getItem(accountKey(userId, "sync"))) as Partial<T>;
}

export function writeAccountSyncState(
  storage: StorageAdapter,
  userId: string,
  state: Record<string, unknown>,
) {
  storage.setItem(accountKey(userId, "sync"), JSON.stringify(state));
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
    writeAccountRecords(storage, userId, visibleRecords);
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

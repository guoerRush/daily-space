import {
  collectStoredRecords,
  dispatchStorageChanges,
  replaceStoredRecords,
  sanitizeStoredRecords,
  type StorageAdapter,
  type StoredRecords,
} from "@/lib/storage-contract";
import {
  clearAccountCaches,
  getActiveStorageUser,
} from "@/lib/account-storage";

const BACKUP_FORMAT = "daily-space-backup";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_RECORDS = 10_000;

export type DataBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  records: StoredRecords;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemIdentity(value: unknown) {
  if (!isPlainObject(value)) return `value:${JSON.stringify(value)}`;
  for (const key of ["id", "date", "key", "name", "title"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") {
      return `${key}:${String(value[key])}`;
    }
  }
  return `object:${JSON.stringify(value)}`;
}

function mergeRecoveredValue(recovered: unknown, current: unknown): unknown {
  if (Array.isArray(recovered) && Array.isArray(current)) {
    const recoveredById = new Map(recovered.map((item) => [itemIdentity(item), item]));
    const merged = current.map((item) => {
      const identity = itemIdentity(item);
      const older = recoveredById.get(identity);
      recoveredById.delete(identity);
      return older === undefined ? item : mergeRecoveredValue(older, item);
    });
    return [...merged, ...recoveredById.values()];
  }
  if (isPlainObject(recovered) && isPlainObject(current)) {
    const result: Record<string, unknown> = { ...recovered };
    for (const [key, value] of Object.entries(current)) {
      result[key] = key in recovered
        ? mergeRecoveredValue(recovered[key], value)
        : value;
    }
    return result;
  }
  if (
    typeof current === "string" &&
    current.trim() === "" &&
    typeof recovered === "string" &&
    recovered.trim() !== ""
  ) {
    return recovered;
  }
  return current ?? recovered;
}

function mergeRecordText(recovered: string, current: string) {
  try {
    return JSON.stringify(mergeRecoveredValue(JSON.parse(recovered), JSON.parse(current)));
  } catch {
    return current || recovered;
  }
}

/** Restores missing history while keeping newer values already visible locally. */
export function mergeRecoveredRecords(
  current: StoredRecords,
  recovered: StoredRecords,
) {
  const merged: StoredRecords = { ...recovered };
  for (const [key, value] of Object.entries(current)) {
    merged[key] = key in recovered
      ? mergeRecordText(recovered[key], value)
      : value;
  }
  return merged;
}

export function createDataBackup(
  storage: StorageAdapter = window.localStorage,
  now = new Date(),
): DataBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    records: collectStoredRecords(storage),
  };
}

export function serializeDataBackup(backup: DataBackup) {
  return JSON.stringify(backup, null, 2);
}

export function parseDataBackup(input: string | unknown): DataBackup {
  if (typeof input === "string" && input.length > MAX_BACKUP_BYTES) {
    throw new Error("The backup file is too large.");
  }

  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new Error("The backup is not valid JSON.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The backup root must be an object.");
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.format !== undefined &&
    candidate.format !== BACKUP_FORMAT
  ) {
    throw new Error("The backup belongs to another application.");
  }
  if (
    candidate.version !== undefined &&
    candidate.version !== BACKUP_VERSION
  ) {
    throw new Error("This backup version is not supported.");
  }

  const records = sanitizeStoredRecords(candidate.records);
  if (Object.keys(records).length === 0) {
    throw new Error("The backup does not contain Daily Space records.");
  }
  if (Object.keys(records).length > MAX_RECORDS) {
    throw new Error("The backup contains too many records.");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt:
      typeof candidate.exportedAt === "string" &&
      Number.isFinite(Date.parse(candidate.exportedAt))
        ? candidate.exportedAt
        : new Date(0).toISOString(),
    records,
  };
}

export function restoreDataBackup(
  input: string | unknown,
  options: {
    mode?: "merge" | "replace";
    storage?: StorageAdapter;
    notify?: boolean;
  } = {},
) {
  const backup = parseDataBackup(input);
  const storage = options.storage ?? window.localStorage;
  const records =
    options.mode === "merge"
      ? mergeRecoveredRecords(collectStoredRecords(storage), backup.records)
      : backup.records;
  const activeUser = getActiveStorageUser(storage);
  if (activeUser) {
    // Free duplicate account/sync snapshots before writing a potentially
    // larger import. They are disposable and will be rebuilt by sync.
    clearAccountCaches(storage, activeUser);
  }
  try {
    replaceStoredRecords(storage, records);
  } catch (error) {
    const quotaExceeded = Boolean(
      error &&
        typeof error === "object" &&
        "name" in error &&
        (error.name === "QuotaExceededError" ||
          ("code" in error && error.code === 22)),
    );
    if (!quotaExceeded || !activeUser) throw error;

    // Mobile Safari/Android browsers can hit their quota because account
    // records and the old sync snapshot duplicate the visible data. Both
    // caches are rebuildable from the cloud and are safe to remove here.
    clearAccountCaches(storage, activeUser);
    replaceStoredRecords(storage, records);
  }
  if (options.notify !== false && typeof window !== "undefined") {
    dispatchStorageChanges(window);
  }
  return { importedRecords: Object.keys(backup.records).length, backup };
}

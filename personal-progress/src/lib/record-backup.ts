import {
  collectStoredRecords,
  dispatchStorageChanges,
  replaceStoredRecords,
  sanitizeStoredRecords,
  type StorageAdapter,
  type StoredRecords,
} from "@/lib/storage-contract";

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
      ? { ...collectStoredRecords(storage), ...backup.records }
      : backup.records;
  replaceStoredRecords(storage, records);
  if (options.notify !== false && typeof window !== "undefined") {
    dispatchStorageChanges(window);
  }
  return { importedRecords: Object.keys(backup.records).length, backup };
}

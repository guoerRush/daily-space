import type { DataBackup } from "@/lib/record-backup";

const DATABASE_NAME = "daily-space-local-backups";
const STORE_NAME = "settings";
const DIRECTORY_KEY = "directory";
const EMERGENCY_KEY = "emergency-backup";
const STATUS_KEY = "status";
export const LOCAL_LIVE_BACKUP_FILE_NAME = "日常留白实时数据.json";
export const LOCAL_PENDING_IMPORT_FILE_NAME = "日常留白待导入.json";

const PENDING_IMPORT_FORMAT = "daily-space-pending-import";
const PENDING_IMPORT_VERSION = 1;

export type PendingSuccessJournalImport = {
  date: string;
  lines: string[];
};

type PendingLocalImport = {
  format: typeof PENDING_IMPORT_FORMAT;
  version: typeof PENDING_IMPORT_VERSION;
  successJournals: PendingSuccessJournalImport[];
  importedAt?: string;
};

type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    startIn?: "documents";
  }) => Promise<WritableDirectoryHandle>;
};

type BackupStatus = {
  fileBackedUpAt?: string;
  emergencyBackedUpAt?: string;
};

export type LocalBackupState = {
  supported: boolean;
  directoryConnected: boolean;
  directoryName?: string;
  permission: PermissionState | "unsupported";
  status: BackupStatus;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本机备份库。"));
  });
}

async function readSetting<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      resolve(request.result as T | undefined);
      database.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("无法读取本机备份。"));
      database.close();
    };
  });
}

async function writeSetting(key: string, value: unknown) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => {
      resolve();
      database.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("无法写入本机备份。"));
      database.close();
    };
  });
}

async function getDirectory() {
  return readSetting<WritableDirectoryHandle>(DIRECTORY_KEY);
}

async function getStatus() {
  return (await readSetting<BackupStatus>(STATUS_KEY)) ?? {};
}

async function setStatus(patch: Partial<BackupStatus>) {
  await writeSetting(STATUS_KEY, { ...(await getStatus()), ...patch });
}

async function permissionFor(directory: WritableDirectoryHandle) {
  return directory.queryPermission({ mode: "readwrite" });
}

export function supportsLocalBackupFolder() {
  return typeof window !== "undefined" && Boolean((window as DirectoryPickerWindow).showDirectoryPicker);
}

export async function connectLocalBackupFolder() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("当前浏览器不支持选择本地备份文件夹，请使用 Edge 或 Chrome。");
  const directory = await picker({ mode: "readwrite", startIn: "documents" });
  await writeSetting(DIRECTORY_KEY, directory);
  return getLocalBackupState();
}

export async function requestLocalBackupPermission() {
  const directory = await getDirectory();
  if (!directory) return { granted: false as const, reason: "not-connected" as const };
  const permission = await directory.requestPermission({ mode: "readwrite" });
  return { granted: permission === "granted", state: await getLocalBackupState() };
}

export async function getLocalBackupState(): Promise<LocalBackupState> {
  const supported = supportsLocalBackupFolder();
  const [directory, status] = await Promise.all([getDirectory(), getStatus()]);
  if (!directory) {
    return { supported, directoryConnected: false, permission: supported ? "prompt" : "unsupported", status };
  }
  const permission = await permissionFor(directory).catch(() => "prompt" as const);
  return {
    supported,
    directoryConnected: true,
    directoryName: directory.name,
    permission,
    status,
  };
}

/** Stores an on-device mirror even when the user has not connected a folder yet. */
export async function saveEmergencyBackup(backup: DataBackup) {
  const savedAt = new Date().toISOString();
  await Promise.all([
    writeSetting(EMERGENCY_KEY, backup),
    setStatus({ emergencyBackedUpAt: savedAt }),
  ]);
  return savedAt;
}

export async function readEmergencyBackup() {
  return readSetting<DataBackup>(EMERGENCY_KEY);
}

export function parsePendingLocalImport(value: unknown): PendingLocalImport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("待导入文件格式不正确。");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.format !== PENDING_IMPORT_FORMAT ||
    candidate.version !== PENDING_IMPORT_VERSION ||
    !Array.isArray(candidate.successJournals)
  ) {
    throw new Error("待导入文件不是受支持的日常留白数据。");
  }

  const successJournals = candidate.successJournals.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
      !Array.isArray(record.lines)
    ) {
      return [];
    }
    const lines = record.lines.filter(
      (line): line is string => typeof line === "string" && line.trim().length > 0,
    );
    return lines.length > 0 ? [{ date: record.date, lines }] : [];
  });

  return {
    format: PENDING_IMPORT_FORMAT,
    version: PENDING_IMPORT_VERSION,
    successJournals,
    ...(typeof candidate.importedAt === "string"
      ? { importedAt: candidate.importedAt }
      : {}),
  };
}

/** Reads a one-time import from the connected folder without changing it. */
export async function readPendingLocalImport() {
  const directory = await getDirectory();
  if (!directory) return { found: false as const, reason: "not-connected" as const };
  if ((await permissionFor(directory)) !== "granted") {
    return { found: false as const, reason: "permission-needed" as const };
  }
  try {
    const fileHandle = await directory.getFileHandle(LOCAL_PENDING_IMPORT_FILE_NAME);
    const file = await fileHandle.getFile();
    const pendingImport = parsePendingLocalImport(JSON.parse(await file.text()));
    return { found: true as const, pendingImport };
  } catch (error) {
    if ((error as DOMException).name === "NotFoundError") {
      return { found: false as const, reason: "missing" as const };
    }
    throw error;
  }
}

/** Marks the import as consumed while retaining the file as an audit trail. */
export async function markPendingLocalImportCompleted(importedAt: string) {
  const directory = await getDirectory();
  if (!directory || (await permissionFor(directory)) !== "granted") return false;
  const fileHandle = await directory.getFileHandle(LOCAL_PENDING_IMPORT_FILE_NAME);
  const file = await fileHandle.getFile();
  const pendingImport = parsePendingLocalImport(JSON.parse(await file.text()));
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await writable.write(JSON.stringify({ ...pendingImport, importedAt }, null, 2));
  await writable.close();
  return true;
}

/** Overwrites one live mirror after website data changes. */
export async function saveBackupToLocalFolder(backup: DataBackup) {
  const directory = await getDirectory();
  if (!directory) return { saved: false as const, reason: "not-connected" as const };
  if ((await permissionFor(directory)) !== "granted") {
    return { saved: false as const, reason: "permission-needed" as const };
  }
  const savedAt = new Date();
  const fileName = LOCAL_LIVE_BACKUP_FILE_NAME;
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });
  await writable.write(JSON.stringify(backup, null, 2));
  await writable.close();
  const savedAtIso = savedAt.toISOString();
  await setStatus({ fileBackedUpAt: savedAtIso });
  return { saved: true as const, savedAt: savedAtIso, fileName };
}

import { browserRecords, flushBrowserRecords } from "@/lib/browser-records";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activateAccountStorage,
  readAccountRecords,
  readAccountSyncState,
  writeAccountRecords,
  writeAccountSyncState,
} from "@/lib/account-storage";
import {
  collectStoredRecords,
  dispatchStorageChanges,
  replaceStoredRecords,
  sanitizeStoredRecords,
  STORAGE_KEYS,
  storedRecordsEqual,
  type StorageAdapter,
  type StoredRecords,
} from "@/lib/storage-contract";
import { mergeRecoveredRecords } from "@/lib/record-backup";
import { migrateFitnessHistory } from "@/lib/fitness-history";

const REMOTE_METADATA_KEY = "__daily_space_sync_metadata__";
const SYNC_VERSION = 1;

type RecordVersion = {
  updatedAt: string;
  deleted?: true;
};

export type SyncMetadata = {
  version: typeof SYNC_VERSION;
  keys: Record<string, RecordVersion>;
};

type AccountSyncState = Record<string, unknown> & {
  metadata: SyncMetadata;
  lastRemoteRecords: StoredRecords;
  lastRemoteUpdatedAt?: string;
};

type UserRecordRow = {
  records: unknown;
  updated_at: string | null;
};

function emptyMetadata(): SyncMetadata {
  return { version: SYNC_VERSION, keys: {} };
}

function validTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : fallback;
}

function parseMetadata(value: unknown): SyncMetadata {
  if (typeof value !== "string") return emptyMetadata();
  try {
    const parsed = JSON.parse(value) as {
      version?: unknown;
      keys?: unknown;
    };
    if (!parsed.keys || typeof parsed.keys !== "object") {
      return emptyMetadata();
    }
    const keys: Record<string, RecordVersion> = {};
    for (const [key, version] of Object.entries(parsed.keys)) {
      if (!version || typeof version !== "object") continue;
      const candidate = version as Record<string, unknown>;
      if (
        typeof candidate.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(candidate.updatedAt))
      ) {
        continue;
      }
      keys[key] = {
        updatedAt: candidate.updatedAt,
        ...(candidate.deleted === true ? { deleted: true as const } : {}),
      };
    }
    return { version: SYNC_VERSION, keys };
  } catch {
    return emptyMetadata();
  }
}

function parseSyncState(value: Partial<AccountSyncState>): AccountSyncState {
  return {
    metadata:
      value.metadata && typeof value.metadata === "object"
        ? parseMetadata(JSON.stringify(value.metadata))
        : emptyMetadata(),
    lastRemoteRecords: sanitizeStoredRecords(value.lastRemoteRecords),
    ...(typeof value.lastRemoteUpdatedAt === "string" &&
    Number.isFinite(Date.parse(value.lastRemoteUpdatedAt))
      ? { lastRemoteUpdatedAt: value.lastRemoteUpdatedAt }
      : {}),
  };
}

function serializeMetadata(metadata: SyncMetadata) {
  const keys = Object.fromEntries(
    Object.entries(metadata.keys).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  return JSON.stringify({ version: SYNC_VERSION, keys });
}

function deriveRemoteMetadata(
  records: StoredRecords,
  embedded: SyncMetadata,
  remoteUpdatedAt: string,
  lastRemoteRecords: StoredRecords,
) {
  const metadata: SyncMetadata = {
    version: SYNC_VERSION,
    keys: { ...embedded.keys },
  };
  const hasPreviousSnapshot = Object.keys(lastRemoteRecords).length > 0;

  for (const key of Object.keys(records)) {
    const previous = metadata.keys[key];
    metadata.keys[key] = {
      // The row timestamp also changes when another, unrelated key is saved.
      updatedAt: validTimestamp(previous?.updatedAt, remoteUpdatedAt),
    };
  }

  if (hasPreviousSnapshot) {
    for (const key of Object.keys(lastRemoteRecords)) {
      if (key in records) continue;
      const previous = metadata.keys[key];
      metadata.keys[key] = {
        updatedAt: validTimestamp(previous?.updatedAt, remoteUpdatedAt),
        deleted: true,
      };
    }
  }
  return metadata;
}

export function mergeVersionedRecords(
  localRecords: StoredRecords,
  localMetadata: SyncMetadata,
  remoteRecords: StoredRecords,
  remoteMetadata: SyncMetadata,
) {
  const records: StoredRecords = {};
  const metadata = emptyMetadata();
  const keys = new Set([
    ...Object.keys(localRecords),
    ...Object.keys(remoteRecords),
    ...Object.keys(localMetadata.keys),
    ...Object.keys(remoteMetadata.keys),
  ]);

  for (const key of keys) {
    const localVersion = localMetadata.keys[key];
    const remoteVersion = remoteMetadata.keys[key];
    let winner = localVersion;
    let value = localRecords[key];

    if (
      !winner ||
      (remoteVersion && remoteVersion.updatedAt > winner.updatedAt) ||
      (remoteVersion?.updatedAt === winner.updatedAt && remoteVersion.deleted)
    ) {
      winner = remoteVersion;
      value = remoteRecords[key];
    }

    if (!winner) continue;
    metadata.keys[key] = winner;
    if (!winner.deleted && value !== undefined) records[key] = value;
  }

  return { records, metadata };
}

// Journals share one storage key. Merge independent dates against the last
// acknowledged snapshot, including deletions, instead of replacing the array.
function mergeJournalDates(base: string | undefined, local: string, remote: string) {
  type Entry = { date: string; updatedAt?: string };
  const parse = (raw: string | undefined) => {
    const entries: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(entries) || entries.some((item) => !item || typeof item.date !== "string")) {
      throw new Error("Invalid journal array");
    }
    return new Map<string, Entry>(entries.map((item: Entry) => [item.date, item]));
  };
  try {
    const before = parse(base), left = parse(local), right = parse(remote);
    const result: Entry[] = [];
    for (const date of new Set([...before.keys(), ...left.keys(), ...right.keys()])) {
      const a = left.get(date), b = right.get(date), old = before.get(date);
      const same = (x: Entry | undefined, y: Entry | undefined) => JSON.stringify(x) === JSON.stringify(y);
      const winner = same(a, old) ? b : same(b, old) ? a
        : !a || !b ? undefined // A deletion wins a simultaneous edit.
        : (a.updatedAt ?? "") > (b.updatedAt ?? "") ? a : b;
      if (winner) result.push(winner);
    }
    return JSON.stringify(result.sort((a, b) => b.date.localeCompare(a.date)));
  } catch {
    return null;
  }
}

export class RecordSynchronizer {
  private active = true;
  private requested = false;
  private running: Promise<void> | null = null;
  private collisions = 0;
  private remoteSnapshot: UserRecordRow | undefined;

  constructor(
    private readonly client: SupabaseClient,
    readonly userId: string,
    private readonly storage: StorageAdapter = browserRecords,
    private readonly notify: () => void = () =>
      dispatchStorageChanges(window),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start() {
    const previousVisibleRecords = collectStoredRecords(this.storage);
    activateAccountStorage(this.storage, this.userId);
    migrateFitnessHistory(this.storage);
    if (
      !storedRecordsEqual(
        previousVisibleRecords,
        collectStoredRecords(this.storage),
      )
    ) {
      this.notify();
    }
    this.captureLocalChanges();
    await this.sync();
  }

  captureLocalChanges() {
    if (!this.active) return false;
    const current = collectStoredRecords(this.storage);
    const previous = readAccountRecords(this.storage, this.userId);
    const state = parseSyncState(
      readAccountSyncState<AccountSyncState>(this.storage, this.userId),
    );
    const updatedAt = this.now().toISOString();
    let changed = false;

    for (const key of new Set([
      ...Object.keys(previous),
      ...Object.keys(current),
    ])) {
      if (previous[key] === current[key] && state.metadata.keys[key]) continue;
      if (previous[key] === current[key] && current[key] === undefined) continue;
      state.metadata.keys[key] = {
        updatedAt,
        ...(current[key] === undefined ? { deleted: true as const } : {}),
      };
      changed = true;
    }

    // A migrated account has records but no clocks yet.
    for (const key of Object.keys(current)) {
      if (state.metadata.keys[key]) continue;
      state.metadata.keys[key] = { updatedAt };
      changed = true;
    }

    if (changed) {
      writeAccountRecords(this.storage, this.userId, current);
      writeAccountSyncState(this.storage, this.userId, state);
    }
    return changed;
  }

  sync() {
    if (!this.active) return Promise.resolve();
    this.requested = true;
    if (this.running) return this.running;

    this.running = (async () => {
      this.collisions = 0;
      while (this.active && this.requested) {
        this.requested = false;
        await this.syncOnce();
      }
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  dispose() {
    this.active = false;
    this.requested = false;
  }

  private async syncOnce() {
    this.captureLocalChanges();
    let data: UserRecordRow | null | undefined;
    // Most polls have no remote edits. Do not download years of records and
    // inline photos again just to discover that the row is unchanged.
    if (this.remoteSnapshot?.updated_at) {
      const { data: version, error } = await this.client.from("user_records")
        .select("updated_at").eq("user_id", this.userId)
        .maybeSingle<{ updated_at: string | null }>();
      if (error) throw error;
      if (!version) data = null;
      else if (version.updated_at === this.remoteSnapshot.updated_at) data = this.remoteSnapshot;
    }
    if (data === undefined) {
      const result = await this.client.from("user_records")
        .select("records,updated_at").eq("user_id", this.userId)
        .maybeSingle<UserRecordRow>();
      if (result.error) throw result.error;
      data = result.data;
    }
    if (!this.active) return;

    // Edits can arrive while the remote snapshot is being fetched.
    this.captureLocalChanges();
    const localRecords = collectStoredRecords(this.storage);
    const state = parseSyncState(
      readAccountSyncState<AccountSyncState>(this.storage, this.userId),
    );
    const rawRemote =
      data?.records && typeof data.records === "object"
        ? (data.records as Record<string, unknown>)
        : {};
    const remoteRecords = sanitizeStoredRecords(rawRemote);
    const remoteUpdatedAt = validTimestamp(
      data?.updated_at,
      new Date(0).toISOString(),
    );
    const remoteMetadata = deriveRemoteMetadata(
      remoteRecords,
      parseMetadata(rawRemote[REMOTE_METADATA_KEY]),
      remoteUpdatedAt,
      state.lastRemoteRecords,
    );
    // A device can carry an old/future clock from a previous cloud snapshot.
    // If its visible value is still exactly that last snapshot, it has no
    // unsynced edit for this key, so a different value from the cloud must be
    // allowed to win regardless of that stale local clock.
    const localMetadata: SyncMetadata = {
      version: SYNC_VERSION,
      keys: { ...state.metadata.keys },
    };
    const comparableRemote: SyncMetadata = { ...remoteMetadata, keys: { ...remoteMetadata.keys } };
    for (const key of new Set([
      ...Object.keys(state.lastRemoteRecords),
      ...Object.keys(localRecords),
      ...Object.keys(remoteRecords),
    ])) {
      if (
        localRecords[key] === state.lastRemoteRecords[key] &&
        remoteRecords[key] !== state.lastRemoteRecords[key]
      ) {
        delete localMetadata.keys[key];
      }
      if (state.lastRemoteUpdatedAt && remoteRecords[key] === state.lastRemoteRecords[key]
        && localRecords[key] !== state.lastRemoteRecords[key]) {
        delete comparableRemote.keys[key];
      }
    }
    const merged = mergeVersionedRecords(
      localRecords,
      localMetadata,
      remoteRecords,
      comparableRemote,
    );
    if (!state.lastRemoteUpdatedAt) {
      merged.records = mergeRecoveredRecords(localRecords, remoteRecords);
      if (localRecords[STORAGE_KEYS.habits] !== undefined) {
        merged.records[STORAGE_KEYS.habits] = localRecords[STORAGE_KEYS.habits];
      }
      // Retain tombstones from the cloud when importing an empty/new device.
      merged.metadata = { version: SYNC_VERSION, keys: { ...remoteMetadata.keys } };
      for (const [key, value] of Object.entries(merged.records)) {
        merged.metadata.keys[key] = remoteRecords[key] === value && remoteMetadata.keys[key]
          ? remoteMetadata.keys[key] : { updatedAt: this.now().toISOString() };
      }
    }
    const journalKey = STORAGE_KEYS.journals;
    if (state.lastRemoteUpdatedAt && localRecords[journalKey] && remoteRecords[journalKey]
      && localRecords[journalKey] !== remoteRecords[journalKey]) {
      const journals = mergeJournalDates(state.lastRemoteRecords[journalKey], localRecords[journalKey], remoteRecords[journalKey]);
      if (journals !== null) {
        merged.records[journalKey] = journals;
        if (journals !== remoteRecords[journalKey]) {
          merged.metadata.keys[journalKey] = { updatedAt: this.now().toISOString() };
        }
      }
    }

    const recordsForRemote: Record<string, string> = {
      ...merged.records,
      [REMOTE_METADATA_KEY]: serializeMetadata(merged.metadata),
    };
    const currentRemote: Record<string, string> = {
      ...remoteRecords,
      ...(typeof rawRemote[REMOTE_METADATA_KEY] === "string"
        ? { [REMOTE_METADATA_KEY]: rawRemote[REMOTE_METADATA_KEY] }
        : {}),
    };
    let savedAt = remoteUpdatedAt;

    if (!storedRecordsEqual(currentRemote, recordsForRemote)) {
      savedAt = this.now().toISOString();
      // Compare-and-swap: two devices may read the same snapshot. The losing
      // writer must re-read and merge, never blindly overwrite the winner.
      const row = { user_id: this.userId, records: recordsForRemote, updated_at: savedAt };
      const table = this.client.from("user_records");
      let write;
      if (data) {
        const update = table.update(row).eq("user_id", this.userId);
        write = data.updated_at === null ? update.is("updated_at", null)
          : update.eq("updated_at", data.updated_at);
      } else {
        write = table.insert(row);
      }
      const { data: saved, error: saveError } = await write.select("updated_at").maybeSingle<{ updated_at: string }>();
      if ((!saveError && !saved) || saveError?.code === "23505") {
        this.remoteSnapshot = undefined;
        if (++this.collisions > 5) throw new Error("同步冲突，请稍后重试。");
        this.requested = true;
        return;
      }
      if (saveError) throw saveError;
      if (!this.active) return;
      savedAt = validTimestamp(saved?.updated_at, savedAt);
    }

    this.remoteSnapshot = { records: recordsForRemote, updated_at: savedAt };

    // Keep edits made while the upload was in flight, and send them next.
    const latest = collectStoredRecords(this.storage);
    const visible = { ...merged.records };
    let editedDuringUpload = false;
    for (const key of new Set([...Object.keys(localRecords), ...Object.keys(latest)])) {
      if (localRecords[key] === latest[key]) continue;
      editedDuringUpload = true;
      if (latest[key] === undefined) delete visible[key];
      else visible[key] = latest[key];
    }
    const visibleChanged = !storedRecordsEqual(latest, visible);
    replaceStoredRecords(this.storage, visible);
    writeAccountRecords(this.storage, this.userId, merged.records);
    writeAccountSyncState(this.storage, this.userId, {
      metadata: merged.metadata,
      lastRemoteRecords: merged.records,
      lastRemoteUpdatedAt: savedAt,
    } satisfies AccountSyncState);
    if (editedDuringUpload) {
      this.captureLocalChanges();
      this.requested = true;
    }
    // The cloud write has already succeeded. A stalled or expired Safari
    // storage connection must not hide that result or block the next upload.
    if (this.storage === browserRecords) void flushBrowserRecords().catch(() => {});
    if (this.active && visibleChanged) this.notify();
  }

}

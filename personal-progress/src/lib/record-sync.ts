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

function maxTimestamp(left: string | undefined, right: string) {
  return left && left > right ? left : right;
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

  for (const [key, value] of Object.entries(records)) {
    const changedOutsideClient =
      !hasPreviousSnapshot || lastRemoteRecords[key] !== value;
    const previous = metadata.keys[key];
    metadata.keys[key] = {
      updatedAt: changedOutsideClient
        ? maxTimestamp(previous?.updatedAt, remoteUpdatedAt)
        : validTimestamp(previous?.updatedAt, remoteUpdatedAt),
    };
  }

  if (hasPreviousSnapshot) {
    for (const key of Object.keys(lastRemoteRecords)) {
      if (key in records) continue;
      const previous = metadata.keys[key];
      metadata.keys[key] = {
        updatedAt: maxTimestamp(previous?.updatedAt, remoteUpdatedAt),
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

export class RecordSynchronizer {
  private active = true;
  private requested = false;
  private running: Promise<void> | null = null;

  constructor(
    private readonly client: SupabaseClient,
    readonly userId: string,
    private readonly storage: StorageAdapter = window.localStorage,
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
    const state = parseSyncState(
      readAccountSyncState<AccountSyncState>(this.storage, this.userId),
    );
    // Metadata can be created while the browser is offline. Until a remote
    // snapshot has actually been read or written, merge local and cloud data
    // as an initial bootstrap instead of letting one device replace the other.
    if (!state.lastRemoteUpdatedAt) {
      await this.bootstrapSync();
      return;
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

    writeAccountRecords(this.storage, this.userId, current);
    writeAccountSyncState(this.storage, this.userId, state);
    return changed;
  }

  sync() {
    if (!this.active) return Promise.resolve();
    this.requested = true;
    if (this.running) return this.running;

    this.running = (async () => {
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
    const localRecords = collectStoredRecords(this.storage);
    const state = parseSyncState(
      readAccountSyncState<AccountSyncState>(this.storage, this.userId),
    );
    const { data, error } = await this.client
      .from("user_records")
      .select("records,updated_at")
      .eq("user_id", this.userId)
      .maybeSingle<UserRecordRow>();

    if (error) throw error;
    if (!this.active) return;

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
    }
    const merged = mergeVersionedRecords(
      localRecords,
      localMetadata,
      remoteRecords,
      remoteMetadata,
    );
    const visibleChanged = !storedRecordsEqual(localRecords, merged.records);

    replaceStoredRecords(this.storage, merged.records);
    writeAccountRecords(this.storage, this.userId, merged.records);

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
      const { error: saveError } = await this.client.from("user_records").upsert(
        {
          user_id: this.userId,
          records: recordsForRemote,
          updated_at: savedAt,
        },
        { onConflict: "user_id" },
      );
      if (saveError) throw saveError;
      if (!this.active) return;
    }

    writeAccountSyncState(this.storage, this.userId, {
      metadata: merged.metadata,
      lastRemoteRecords: merged.records,
      lastRemoteUpdatedAt: savedAt,
    } satisfies AccountSyncState);
    if (visibleChanged) this.notify();
  }

  private async bootstrapSync() {
    const localRecords = collectStoredRecords(this.storage);
    const { data, error } = await this.client
      .from("user_records")
      .select("records,updated_at")
      .eq("user_id", this.userId)
      .maybeSingle<UserRecordRow>();
    if (error) throw error;
    if (!this.active) return;

    const rawRemote =
      data?.records && typeof data.records === "object"
        ? (data.records as Record<string, unknown>)
        : {};
    const remoteRecords = sanitizeStoredRecords(rawRemote);
    if (!data || Object.keys(remoteRecords).length === 0) {
      this.captureLocalChanges();
      await this.sync();
      return;
    }

    const remoteUpdatedAt = validTimestamp(
      data.updated_at,
      new Date(0).toISOString(),
    );
    const remoteMetadata = deriveRemoteMetadata(
      remoteRecords,
      parseMetadata(rawRemote[REMOTE_METADATA_KEY]),
      remoteUpdatedAt,
      {},
    );
    const mergedRecords = mergeRecoveredRecords(localRecords, remoteRecords);
    // The habits array is edited as a complete list. Merging array items here
    // would bring deleted habits back from an older cloud snapshot during the
    // first sync after a device or account switch.
    if (localRecords[STORAGE_KEYS.habits] !== undefined) {
      mergedRecords[STORAGE_KEYS.habits] = localRecords[STORAGE_KEYS.habits];
    }
    const mergedMetadata = emptyMetadata();
    const now = this.now().toISOString();
    for (const [key, value] of Object.entries(mergedRecords)) {
      mergedMetadata.keys[key] =
        remoteRecords[key] === value && remoteMetadata.keys[key]
          ? remoteMetadata.keys[key]
          : { updatedAt: now };
    }

    const visibleChanged = !storedRecordsEqual(localRecords, mergedRecords);
    replaceStoredRecords(this.storage, mergedRecords);
    writeAccountRecords(this.storage, this.userId, mergedRecords);
    const recordsForRemote: Record<string, string> = {
      ...mergedRecords,
      [REMOTE_METADATA_KEY]: serializeMetadata(mergedMetadata),
    };
    const { error: saveError } = await this.client.from("user_records").upsert(
      {
        user_id: this.userId,
        records: recordsForRemote,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (saveError) throw saveError;
    if (!this.active) return;

    writeAccountSyncState(this.storage, this.userId, {
      metadata: mergedMetadata,
      lastRemoteRecords: mergedRecords,
      lastRemoteUpdatedAt: now,
    } satisfies AccountSyncState);
    if (visibleChanged) this.notify();
  }
}

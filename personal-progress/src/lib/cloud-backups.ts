import { getSupabaseClient } from "@/lib/supabase";
import { listDiariesRemote } from "@/lib/diary-supabase";
import { writeAccountRecords } from "@/lib/account-storage";
import { mergeRecoveredRecords } from "@/lib/record-backup";
import {
  collectStoredRecords,
  dispatchStorageChanges,
  replaceStoredRecords,
  sanitizeStoredRecords,
  STORAGE_KEYS,
  type StoredRecords,
} from "@/lib/storage-contract";

export type CloudRecordCounts = {
  journals: number;
  successJournals: number;
  notes: number;
  plans: number;
};

export type CloudRecordBackup = {
  id: number;
  sourceUpdatedAt: string;
  createdAt: string;
  recordCount: number;
  counts: CloudRecordCounts;
};

export type CloudBackupResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason:
        | "not-configured"
        | "not-authenticated"
        | "not-found"
        | "query-failed";
      message?: string;
    };

export type ExportRecordsResult = {
  records: StoredRecords;
  source: "cloud-and-browser" | "browser-only";
};

async function getAuthenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false as const, reason: "not-configured" as const };
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    return { ok: false as const, reason: "not-authenticated" as const };
  }
  return { ok: true as const, client, userId: session.user.id };
}

/** Reads the complete account snapshot without changing browser or cloud data. */
export async function collectAllRecordsForExport(): Promise<ExportRecordsResult> {
  const localRecords = collectStoredRecords(window.localStorage);
  const auth = await getAuthenticatedClient();
  if (!auth.ok) {
    return { records: localRecords, source: "browser-only" };
  }

  const { data, error } = await auth.client
    .from("user_records")
    .select("records")
    .eq("user_id", auth.userId)
    .maybeSingle<{ records: Record<string, string> }>();
  if (error || !data) {
    return { records: localRecords, source: "browser-only" };
  }

  // Keep local edits while also recovering cloud-only records (important when
  // the phone has opened the account before its first successful sync).
  return {
    records: mergeRecoveredRecords(
      localRecords,
      sanitizeStoredRecords(data.records),
    ),
    source: "cloud-and-browser",
  };
}

function arrayCount(records: StoredRecords, key: string) {
  try {
    const value = JSON.parse(records[key] ?? "[]");
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

function summarizeRecords(records: StoredRecords): CloudRecordCounts {
  return {
    journals: arrayCount(records, STORAGE_KEYS.journals),
    successJournals: arrayCount(records, STORAGE_KEYS.successJournals),
    notes: arrayCount(records, STORAGE_KEYS.notes),
    plans: Object.keys(records).filter((key) => key.startsWith(STORAGE_KEYS.planPrefix)).length,
  };
}

export async function listCloudRecordBackups(): Promise<
  CloudBackupResult<CloudRecordBackup[]>
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  const { data, error } = await auth.client
    .from("user_record_backups")
    .select("id,records,source_updated_at,created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, reason: "query-failed", message: error.message };

  return {
    ok: true,
    data: (data ?? []).map((row) => {
      const records = sanitizeStoredRecords(row.records);
      return {
        id: Number(row.id),
        sourceUpdatedAt: String(row.source_updated_at),
        createdAt: String(row.created_at),
        recordCount: Object.keys(records).length,
        counts: summarizeRecords(records),
      };
    }),
  };
}

export async function restoreCloudRecordBackup(
  backupId: number,
): Promise<CloudBackupResult<{ restoredRecords: number; counts: CloudRecordCounts }>> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  const { data, error } = await auth.client
    .from("user_record_backups")
    .select("records")
    .eq("user_id", auth.userId)
    .eq("id", backupId)
    .maybeSingle<{ records: Record<string, string> }>();
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  if (!data) return { ok: false, reason: "not-found" };

  const recoveredRecords = sanitizeStoredRecords(data.records);
  const mergedRecords = mergeRecoveredRecords(
    collectStoredRecords(window.localStorage),
    recoveredRecords,
  );

  const { error: restoreError } = await auth.client.from("user_records").upsert(
    {
      user_id: auth.userId,
      records: mergedRecords,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (restoreError) {
    return {
      ok: false,
      reason: "query-failed",
      message: restoreError.message,
    };
  }
  replaceStoredRecords(window.localStorage, mergedRecords);
  writeAccountRecords(window.localStorage, auth.userId, mergedRecords);
  dispatchStorageChanges(window);
  return {
    ok: true,
    data: {
      restoredRecords: Object.keys(recoveredRecords).length,
      counts: summarizeRecords(mergedRecords),
    },
  };
}

export async function recoverCurrentCloudRecords(): Promise<
  CloudBackupResult<{ recoveredRecords: number; counts: CloudRecordCounts }>
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  const { data, error } = await auth.client
    .from("user_records")
    .select("records")
    .eq("user_id", auth.userId)
    .maybeSingle<{ records: Record<string, string> }>();
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  if (!data) return { ok: false, reason: "not-found" };

  const recoveredRecords = sanitizeStoredRecords(data.records);
  const mergedRecords = mergeRecoveredRecords(
    collectStoredRecords(window.localStorage),
    recoveredRecords,
  );
  const { error: saveError } = await auth.client.from("user_records").upsert(
    {
      user_id: auth.userId,
      records: mergedRecords,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (saveError) return { ok: false, reason: "query-failed", message: saveError.message };

  replaceStoredRecords(window.localStorage, mergedRecords);
  writeAccountRecords(window.localStorage, auth.userId, mergedRecords);
  dispatchStorageChanges(window);
  return {
    ok: true,
    data: {
      recoveredRecords: Object.keys(recoveredRecords).length,
      counts: summarizeRecords(mergedRecords),
    },
  };
}

export async function recoverRemoteDiaries(): Promise<
  CloudBackupResult<{ recoveredDiaries: number; counts: CloudRecordCounts }>
> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  const remote = await listDiariesRemote();
  if (!remote.ok) {
    return { ok: false, reason: remote.reason, message: remote.message };
  }
  if (!remote.data.length) {
    return { ok: false, reason: "not-found" };
  }

  const recoveredRecords: StoredRecords = {
    [STORAGE_KEYS.journals]: JSON.stringify(remote.data.map((entry) => ({
      date: entry.date,
      content: entry.content,
      mood: entry.mood ?? "平静",
      template: entry.template,
      touchEvent: entry.touchEvent ?? undefined,
      touchWhy: entry.touchWhy ?? undefined,
      touchAction: entry.touchAction ?? undefined,
      reviewDesc: entry.reviewDesc ?? undefined,
      reviewAnalysis: entry.reviewAnalysis ?? undefined,
      reviewAction: entry.reviewAction ?? undefined,
      linkedDiaryIds: entry.linkedDiaryIds,
      metaCognition: entry.metaCognition,
      updatedAt: entry.updatedAt,
    }))),
  };
  const mergedRecords = mergeRecoveredRecords(
    collectStoredRecords(window.localStorage),
    recoveredRecords,
  );
  const { error } = await auth.client.from("user_records").upsert(
    {
      user_id: auth.userId,
      records: mergedRecords,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, reason: "query-failed", message: error.message };

  replaceStoredRecords(window.localStorage, mergedRecords);
  writeAccountRecords(window.localStorage, auth.userId, mergedRecords);
  dispatchStorageChanges(window);
  return {
    ok: true,
    data: {
      recoveredDiaries: remote.data.length,
      counts: summarizeRecords(mergedRecords),
    },
  };
}

export async function deleteCloudRecordBackup(
  backupId: number,
): Promise<CloudBackupResult> {
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth;
  const { error } = await auth.client
    .from("user_record_backups")
    .delete()
    .eq("user_id", auth.userId)
    .eq("id", backupId);
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  return { ok: true, data: undefined };
}

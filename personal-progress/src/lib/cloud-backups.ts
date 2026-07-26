import { getSupabaseClient } from "@/lib/supabase";

export type CloudRecordBackup = {
  id: number;
  sourceUpdatedAt: string;
  createdAt: string;
  recordCount: number;
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
    data: (data ?? []).map((row) => ({
      id: Number(row.id),
      sourceUpdatedAt: String(row.source_updated_at),
      createdAt: String(row.created_at),
      recordCount:
        row.records && typeof row.records === "object"
          ? Object.keys(row.records).length
          : 0,
    })),
  };
}

export async function restoreCloudRecordBackup(
  backupId: number,
): Promise<CloudBackupResult> {
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

  const { error: restoreError } = await auth.client.from("user_records").upsert(
    {
      user_id: auth.userId,
      records: data.records,
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
  return { ok: true, data: undefined };
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

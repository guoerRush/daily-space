import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredRecords } from "@/lib/storage-contract";
import { changedSyncParts, joinSyncRecords, splitSyncRecords } from "@/lib/record-sync-parts";

export type RemoteSnapshot = { records: StoredRecords; updated_at: string | null };
export type DeltaCache = { version: string | null; parts: StoredRecords; hashes: StoredRecords };
type DeltaRead = { updated_at: string | null; exists: boolean; changes: Record<string, string | null>; hashes: Record<string, string | null> };

export class RecordSyncTransport {
  private rpcAvailable: boolean | undefined;
  private delta?: DeltaCache;
  constructor(private client: SupabaseClient, private userId: string, cache?: DeltaCache) { this.delta = cache; }

  get cache() { return this.delta; }

  async read(cached?: RemoteSnapshot): Promise<RemoteSnapshot | null> {
    if (this.rpcAvailable !== false && typeof this.client.rpc === "function") {
      const { data, error } = await this.client.rpc("daily_space_read_changes", {
        p_version: this.delta?.version ?? null, p_known: this.delta?.hashes ?? {},
      });
      if (error && ["PGRST202", "42883"].includes(error.code)) this.rpcAvailable = false;
      else {
        if (error) throw error;
        this.rpcAvailable = true;
        const result = data as DeltaRead;
        const parts = { ...this.delta?.parts }, hashes = { ...this.delta?.hashes };
        for (const [key, value] of Object.entries(result.changes)) {
          if (value === null) { delete parts[key]; delete hashes[key]; }
          else { parts[key] = value; hashes[key] = result.hashes[key]!; }
        }
        this.delta = { version: result.updated_at, parts, hashes };
        return result.exists ? { records: joinSyncRecords(parts), updated_at: result.updated_at } : null;
      }
    }

    // Existing databases work before the optional SQL migration is installed.
    // Read a small version first, including after a page reload.
    if (cached?.updated_at) {
      const { data, error } = await this.client.from("user_records").select("updated_at")
        .eq("user_id", this.userId).maybeSingle<{ updated_at: string | null }>();
      if (error) throw error;
      if (!data) return null;
      if (data.updated_at === cached.updated_at) return cached;

    }
    const { data, error } = await this.client.from("user_records").select("records,updated_at")
      .eq("user_id", this.userId).maybeSingle<RemoteSnapshot>();
    if (error) throw error;
    return data;
  }

  async write(before: RemoteSnapshot | null, records: StoredRecords, timestamp: string) {
    if (this.rpcAvailable) {
      const parts = splitSyncRecords(records);
      const changes = changedSyncParts(this.delta?.parts ?? splitSyncRecords(before?.records ?? {}), parts);
      const { data, error } = await this.client.rpc("daily_space_write_changes", {
        p_expected: before?.updated_at ?? null, p_changes: changes,
      });
      if (error) throw error;
      if (data.conflict) return null;
      const hashes = { ...this.delta?.hashes };
      for (const [key, value] of Object.entries(data.hashes as Record<string, string | null>)) {
        if (value === null) delete hashes[key]; else hashes[key] = value;
      }
      this.delta = { version: data.updated_at, parts, hashes };
      return { updated_at: data.updated_at as string };
    }
    const row = { user_id: this.userId, records, updated_at: timestamp };
    const table = this.client.from("user_records");
    const write = before ? before.updated_at === null
      ? table.update(row).eq("user_id", this.userId).is("updated_at", null)
      : table.update(row).eq("user_id", this.userId).eq("updated_at", before.updated_at)
      : table.insert(row);
    const { data, error } = await write.select("updated_at").maybeSingle<{ updated_at: string }>();
    if (error?.code === "23505") return null;
    if (error) throw error;
    return data;
  }
}

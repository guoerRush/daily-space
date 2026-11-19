import { STORAGE_KEYS, type StoredRecords } from "@/lib/storage-contract";

const JOURNAL = "__journal_date__:";
const CONTAINER = "__journal_container__";

/** Transport-only dates; the UI and backups keep their existing storage format. */
export function splitSyncRecords(records: StoredRecords): StoredRecords {
  const parts = { ...records };
  if (records[STORAGE_KEYS.journals] === undefined) return parts;
  try {
    const entries: unknown = JSON.parse(records[STORAGE_KEYS.journals]);
    if (!Array.isArray(entries) || entries.some(item => !item || typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date))
      || new Set(entries.map(item => item.date)).size !== entries.length) return parts;
    delete parts[STORAGE_KEYS.journals];
    parts[CONTAINER] = "[]";
    for (const entry of entries) parts[JOURNAL + entry.date] = JSON.stringify(entry);
  } catch { /* Preserve malformed legacy records verbatim. */ }
  return parts;
}

export function joinSyncRecords(parts: StoredRecords): StoredRecords {
  const records = { ...parts };
  if (parts[CONTAINER] !== undefined) {
    const entries = Object.entries(parts).filter(([key]) => key.startsWith(JOURNAL))
      .sort(([a], [b]) => b.localeCompare(a)).map(([, value]) => JSON.parse(value));
    records[STORAGE_KEYS.journals] = JSON.stringify(entries);
  }
  delete records[CONTAINER];
  for (const key of Object.keys(records)) if (key.startsWith(JOURNAL)) delete records[key];
  return records;
}

export function changedSyncParts(before: StoredRecords, after: StoredRecords) {
  const changes: Record<string, string | null> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] === after[key]) continue;
    // PostgreSQL normalizes JSON whitespace. A journal with identical fields
    // must not be uploaded just because it was serialized by another device.
    if (key.startsWith(JOURNAL) && before[key] && after[key]) {
      const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
        : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
      try { if (JSON.stringify(canonical(JSON.parse(before[key]))) === JSON.stringify(canonical(JSON.parse(after[key])))) continue; } catch { /* Send changed raw data. */ }
    }
    changes[key] = after[key] ?? null;
  }
  return changes;
}

import { STORAGE_EVENTS, type StorageAdapter } from "@/lib/storage-contract";

export type WeightHistory = { date: string; values: Record<string, string>; updatedAt?: string };
const prefix = "daily-space:fitness:";
export const FITNESS_DRAFT_KEY = "daily-space:fitness-draft";

export function readFitnessHistory(storage: StorageAdapter = localStorage): WeightHistory[] {
  const records: WeightHistory[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const record = JSON.parse(storage.getItem(key) || "null") as WeightHistory | null;
      if (record?.date && record.values) records.push(record);
    } catch { /* A damaged entry must not hide all other dates. */ }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export function saveFitnessHistory(record: WeightHistory) {
  localStorage.setItem(prefix + record.date, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
  window.dispatchEvent(new Event(STORAGE_EVENTS.fitnessChanged));
}

/** Called after account activation so a storage swap cannot discard the migration. */
export function migrateFitnessHistory(storage: StorageAdapter) {
  let legacy: WeightHistory[];
  try { legacy = JSON.parse(storage.getItem("fitness-weight-history") || "[]"); }
  catch { return; } // Leave unreadable legacy data intact for recovery.
  if (!Array.isArray(legacy)) return;
  for (const record of legacy) {
    if (!record?.date || !record.values) continue;
    if (!storage.getItem(prefix + record.date)) {
      storage.setItem(prefix + record.date, JSON.stringify(record));
    }
  }
  const draft = storage.getItem("fitness-weight-records");
  if (draft && !storage.getItem(FITNESS_DRAFT_KEY)) storage.setItem(FITNESS_DRAFT_KEY, draft);
  // Remove the unscoped legacy data only after all dated entries are durable.
  storage.removeItem("fitness-weight-history");
  storage.removeItem("fitness-weight-records");
}

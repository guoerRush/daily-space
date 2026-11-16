import { browserRecords } from "@/lib/browser-records";
import { STORAGE_EVENTS, type StorageAdapter } from "@/lib/storage-contract";

export type FitnessReflection = { date: string; text: string; updatedAt: string };
const prefix = "daily-space:fitness-reflection:";

export function readFitnessReflections(storage: StorageAdapter = browserRecords): FitnessReflection[] {
  const records: FitnessReflection[] = [];
  const keys = storage.keys?.() ?? Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith(prefix)) continue;
    try {
      const record = JSON.parse(storage.getItem(key) ?? "null") as FitnessReflection | null;
      if (record && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
        && key === prefix + record.date && typeof record.text === "string") records.push(record);
    } catch { /* One damaged day must not hide the other reflections. */ }
  }
  return records.sort((left, right) => right.date.localeCompare(left.date));
}

export function saveFitnessReflection(
  date: string,
  text: string,
  storage: StorageAdapter = browserRecords,
): FitnessReflection {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("无效的日期");
  const record = { date, text: text.trim(), updatedAt: new Date().toISOString() };
  storage.setItem(prefix + date, JSON.stringify(record));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORAGE_EVENTS.fitnessChanged));
  return record;
}

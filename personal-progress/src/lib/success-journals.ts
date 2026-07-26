export type SuccessJournal = {
  date: string;
  content: string;
  updatedAt: string;
};

let cachedRaw: string | null = null;
let cachedEntries: SuccessJournal[] = [];

export function listSuccessJournals(): SuccessJournal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEYS.successJournals) ?? "[]";
    if (raw === cachedRaw) return cachedEntries;
    cachedRaw = raw;
    cachedEntries = (JSON.parse(raw) as SuccessJournal[]).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    return cachedEntries;
  } catch {
    return [];
  }
}

export function findSuccessJournal(date: string) {
  return listSuccessJournals().find((entry) => entry.date === date);
}

export function saveSuccessJournal(entry: Omit<SuccessJournal, "updatedAt">) {
  const current = listSuccessJournals().filter((item) => item.date !== entry.date);
  const next = [{ ...entry, updatedAt: new Date().toISOString() }, ...current];
  window.localStorage.setItem(
    STORAGE_KEYS.successJournals,
    JSON.stringify(next),
  );
  cachedRaw = null;
  window.dispatchEvent(new Event(STORAGE_EVENTS.successJournalsChanged));
}

export function deleteSuccessJournal(date: string) {
  const next = listSuccessJournals().filter((entry) => entry.date !== date);
  window.localStorage.setItem(
    STORAGE_KEYS.successJournals,
    JSON.stringify(next),
  );
  cachedRaw = null;
  window.dispatchEvent(new Event(STORAGE_EVENTS.successJournalsChanged));
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

export type SuccessJournal = {
  date: string;
  content: string;
  updatedAt: string;
};

const STORAGE_KEY = "daily-space:success-journals";

export function listSuccessJournals(): SuccessJournal[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SuccessJournal[])
      .sort((a, b) => b.date.localeCompare(a.date));
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("daily-space:success-journals-changed"));
}

export function deleteSuccessJournal(date: string) {
  const next = listSuccessJournals().filter((entry) => entry.date !== date);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("daily-space:success-journals-changed"));
}

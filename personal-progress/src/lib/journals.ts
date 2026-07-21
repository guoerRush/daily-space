export type JournalEntry = {
  date: string;
  content: string;
  mood: string;
  images?: string[];
  highlights?: string[];
  updatedAt: string;
};

const STORAGE_KEY = "daily-space:journals";
let cachedRaw: string | null = null;
let cachedEntries: JournalEntry[] = [];

function canUseStorage() {
  return typeof window !== "undefined";
}

export function listJournals(): JournalEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";
    if (raw === cachedRaw) return cachedEntries;
    cachedRaw = raw;
    const indexed = JSON.parse(raw) as JournalEntry[];
    const dates = new Set(indexed.map((entry) => entry.date));
    const legacy = Object.keys(window.localStorage).flatMap((key) => {
      if (!key.startsWith("journal:")) return [];
      const date = key.slice("journal:".length);
      const content = window.localStorage.getItem(key) ?? "";
      if (!content || dates.has(date)) return [];
      return [{ date, content, mood: window.localStorage.getItem(`mood:${date}`) ?? "平静", updatedAt: new Date().toISOString() }];
    });
    cachedEntries = [...indexed, ...legacy].sort((a, b) => b.date.localeCompare(a.date));
    return cachedEntries;
  } catch {
    return [];
  }
}

export function findJournal(date: string) {
  return listJournals().find((entry) => entry.date === date);
}

export function saveJournal(entry: Omit<JournalEntry, "updatedAt">) {
  const current = listJournals().filter((item) => item.date !== entry.date);
  const next = [{ ...entry, updatedAt: new Date().toISOString() }, ...current];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedRaw = null;
  window.dispatchEvent(new Event("daily-space:journals-changed"));
}

export function deleteJournal(date: string) {
  const next = listJournals().filter((entry) => entry.date !== date);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Remove records written by older versions of the app as well.
  window.localStorage.removeItem(`journal:${date}`);
  window.localStorage.removeItem(`mood:${date}`);
  cachedRaw = null;
  window.dispatchEvent(new Event("daily-space:journals-changed"));
}

export function formatJournalDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function todayKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

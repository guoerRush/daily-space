export type SuccessJournal = {
  date: string;
  content: string;
  createdAt?: string;
  updatedAt: string;
};

export type SuccessJournalLineImport = {
  date: string;
  lines: string[];
};

function normalizeImportedDate(yearText: string, monthText: string, dayText: string) {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses a success-journal Markdown document grouped by date headings. */
export function parseSuccessJournalMarkdown(markdown: string) {
  const byDate = new Map<string, string[]>();
  let currentDate: string | null = null;

  for (const rawLine of markdown.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const dateMatch = line.match(
      /^(?:#{1,6}\s*)?(\d{4})\s*(?:[.\/-]|年)\s*(\d{1,2})\s*(?:[.\/-]|月)\s*(\d{1,2})\s*(?:日)?\s*$/,
    );
    if (dateMatch) {
      currentDate = normalizeImportedDate(dateMatch[1], dateMatch[2], dateMatch[3]);
      if (currentDate && !byDate.has(currentDate)) byDate.set(currentDate, []);
      continue;
    }
    if (!currentDate || !line || line.startsWith("#")) continue;

    const content = line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)、]\s*/, "")
      .trim();
    if (!content) continue;
    const lines = byDate.get(currentDate) ?? [];
    if (!lines.includes(content)) lines.push(content);
    byDate.set(currentDate, lines);
  }

  return [...byDate.entries()]
    .filter(([, lines]) => lines.length > 0)
    .map(([date, lines]) => ({ date, lines } satisfies SuccessJournalLineImport));
}

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

export function successJournalPlainText(content: string) {
  if (!content) return "";
  if (typeof DOMParser === "undefined") {
    return content
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }
  let source = content;
  for (let pass = 0; pass < 2; pass += 1) {
    const document = new DOMParser().parseFromString(source, "text/html");
    document.body.querySelectorAll("br").forEach((breakNode) => {
      breakNode.replaceWith("\n");
    });
    document.body
      .querySelectorAll("p,div,li,h1,h2,h3,h4,h5,h6,blockquote")
      .forEach((block) => block.append("\n"));
    const text = (document.body.textContent ?? "").replace(/\u00a0/g, " ");
    if (pass === 0 && /<\/?(?:p|br|div|li|h[1-6]|blockquote)\b/i.test(text)) {
      source = text;
      continue;
    }
    return text
      .split(/\n+/)
      .map((line) => line.replace(/[\t ]+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return source.trim();
}

export function saveSuccessJournal(entry: Omit<SuccessJournal, "updatedAt">) {
  const entries = listSuccessJournals();
  const existing = entries.find((item) => item.date === entry.date);
  const current = entries.filter((item) => item.date !== entry.date);
  const next = [
    {
      ...entry,
      content: successJournalPlainText(entry.content),
      createdAt: entry.createdAt ?? existing?.createdAt ?? `${entry.date}T12:00:00`,
      updatedAt: new Date().toISOString(),
    },
    ...current,
  ];
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

/** Adds missing lines by date and normalizes legacy rich text to plain lines. */
export function mergeSuccessJournalLines(imports: SuccessJournalLineImport[]) {
  const entries = listSuccessJournals();
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const updatedAt = new Date().toISOString();
  let importedLines = 0;
  let normalizedEntries = 0;

  for (const entry of imports) {
    const existing = byDate.get(entry.date);
    const existingContent = successJournalPlainText(existing?.content ?? "");
    const existingLines = new Set(existingContent.split(/\n+/).filter(Boolean));
    const missing = entry.lines
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0 && !existingLines.has(line));
    const normalized = Boolean(existing && existing.content !== existingContent);
    if (missing.length === 0 && !normalized) continue;

    byDate.set(entry.date, {
      date: entry.date,
      content: [existingContent, ...missing].filter(Boolean).join("\n"),
      createdAt: existing?.createdAt ?? `${entry.date}T12:00:00`,
      updatedAt,
    });
    importedLines += missing.length;
    if (normalized) normalizedEntries += 1;
  }

  if (importedLines === 0 && normalizedEntries === 0) {
    return { changed: false, importedLines, normalizedEntries };
  }
  const next = [...byDate.values()].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  window.localStorage.setItem(STORAGE_KEYS.successJournals, JSON.stringify(next));
  cachedRaw = null;
  window.dispatchEvent(new Event(STORAGE_EVENTS.successJournalsChanged));
  return { changed: true, importedLines, normalizedEntries };
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

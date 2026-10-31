export type StoredTask = {
  id: number;
  text: string;
  priority: number;
  done: boolean;
};
export type StoredPlanRow = { id: number; time: string; activity: string };
export type StoredActualRow = StoredPlanRow & { minutes: number };
export type RemarkItem = { id: string; text: string; done: boolean };
export type FocusSession = {
  id: string;
  taskId: number;
  startedAt: string;
  endedAt: string;
  minutes: number;
};
export type StoredDayPlan = {
  tasks?: StoredTask[];
  planned?: StoredPlanRow[];
  actual?: StoredActualRow[];
  remarks?: string;
  remarksDone?: boolean;
  remarkChecks?: Record<string, boolean>;
  dictation?: string;
  topPriorities?: [string, string, string];
  focusSessions?: FocusSession[];
  remarkCarryoverSyncedFrom?: string;
  locked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function saveDailyPlan<T extends StoredDayPlan>(date: string, plan: T) {
  const now = new Date().toISOString();
  const next = {
    ...plan,
    createdAt: plan.createdAt ?? `${date}T12:00:00`,
    updatedAt: now,
  } satisfies StoredDayPlan;
  window.localStorage.setItem(
    `${STORAGE_KEYS.planPrefix}${date}`,
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.plansChanged));
  return next;
}

function remarkLines(value: string) {
  return value
    .replace(/<(br\s*\/?>|\/p|\/li|\/h[1-6]|\/blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function buildRemarkItems(
  value: string,
  checks: Record<string, boolean> = {},
): RemarkItem[] {
  return remarkLines(value).map((text, index) => {
    const id = `${index}:${text}`;
    return { id, text, done: Boolean(checks[id]) };
  });
}

export function remarkItemsToHtml(items: RemarkItem[]) {
  return items
    .map(
      (item) =>
        `<p>${item.text.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character)}</p>`,
    )
    .join("");
}

export function listDailyPlans(): Array<{ date: string; plan: StoredDayPlan }> {
  if (typeof window === "undefined") return [];
  const entries: Array<{ date: string; plan: StoredDayPlan }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(STORAGE_KEYS.planPrefix)) continue;
    try {
      const plan = JSON.parse(
        window.localStorage.getItem(key) ?? "{}",
      ) as StoredDayPlan;
      plan.createdAt ??= `${key.slice(STORAGE_KEYS.planPrefix.length)}T12:00:00`;
      plan.updatedAt ??= plan.createdAt;
      const hasContent = Boolean(
        plan.tasks?.some((task) => task.text.trim()) ||
        plan.planned?.some((row) => row.time || row.activity) ||
        plan.actual?.some((row) => row.time || row.activity) ||
        plan.remarks?.trim() ||
        plan.dictation?.trim(),
      );
      if (hasContent) {
        entries.push({ date: key.slice(STORAGE_KEYS.planPrefix.length), plan });
      }
    } catch {
      // Ignore invalid legacy plan data.
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

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
export type WeeklyPriorities = {
  weekStart: string;
  priorities: [string, string, string];
  createdAt?: string;
  updatedAt?: string;
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

const emptyWeeklyPriorities = (): [string, string, string] => ["", "", ""];

function dateKey(day: Date) {
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDate(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function getWeekRange(reference: Date | string = new Date()) {
  const day = typeof reference === "string" ? parseDate(reference) : new Date(reference);
  day.setHours(12, 0, 0, 0);
  const mondayOffset = (day.getDay() + 6) % 7;
  const start = new Date(day);
  start.setDate(day.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: dateKey(start), weekEnd: dateKey(end) };
}

function weeklyPrioritiesKey(weekStart: string) {
  return `${STORAGE_KEYS.weeklyPrioritiesPrefix}${weekStart}`;
}

function normalizePriorities(value: unknown): [string, string, string] {
  if (!Array.isArray(value)) return emptyWeeklyPriorities();
  return [0, 1, 2].map((index) =>
    typeof value[index] === "string" ? value[index] : "",
  ) as [string, string, string];
}

function readLegacyWeeklyPriorities(weekStart: string) {
  if (typeof window === "undefined") return null;
  const { weekEnd } = getWeekRange(weekStart);
  for (const { date, plan } of listDailyPlans()) {
    if (date < weekStart || date > weekEnd) continue;
    const priorities = normalizePriorities(plan.topPriorities);
    if (priorities.some((item) => item.trim())) return priorities;
  }
  return null;
}

export function loadWeeklyPriorities(weekStart: string): WeeklyPriorities {
  if (typeof window === "undefined") {
    return { weekStart, priorities: emptyWeeklyPriorities() };
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(weeklyPrioritiesKey(weekStart)) ?? "null",
    ) as Partial<WeeklyPriorities> | null;
    if (stored && stored.weekStart === weekStart) {
      return {
        weekStart,
        priorities: normalizePriorities(stored.priorities),
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      };
    }
  } catch {
    // Fall back to legacy daily values below.
  }
  return {
    weekStart,
    priorities: readLegacyWeeklyPriorities(weekStart) ?? emptyWeeklyPriorities(),
  };
}

export function saveWeeklyPriorities(
  weekStart: string,
  priorities: [string, string, string],
) {
  const current = loadWeeklyPriorities(weekStart);
  const now = new Date().toISOString();
  const next: WeeklyPriorities = {
    weekStart,
    priorities: normalizePriorities(priorities),
    createdAt: current.createdAt ?? `${weekStart}T12:00:00`,
    updatedAt: now,
  };
  window.localStorage.setItem(weeklyPrioritiesKey(weekStart), JSON.stringify(next));
  window.dispatchEvent(new Event(STORAGE_EVENTS.plansChanged));
  return next;
}

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
        plan.dictation?.trim() ||
        plan.topPriorities?.some((item) => item.trim()),
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

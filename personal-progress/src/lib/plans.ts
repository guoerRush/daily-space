export type StoredTask = { id: number; text: string; priority: number; done: boolean };
export type StoredPlanRow = { id: number; time: string; activity: string };
export type StoredActualRow = StoredPlanRow & { minutes: number };
export type StoredDayPlan = {
  tasks?: StoredTask[];
  planned?: StoredPlanRow[];
  actual?: StoredActualRow[];
  remarks?: string;
  locked?: boolean;
};

const PREFIX = "daily-space:plan:";

export function listDailyPlans(): Array<{ date: string; plan: StoredDayPlan }> {
  if (typeof window === "undefined") return [];
  const entries: Array<{ date: string; plan: StoredDayPlan }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const plan = JSON.parse(window.localStorage.getItem(key) ?? "{}") as StoredDayPlan;
      const hasContent = Boolean(plan.tasks?.some((task) => task.text.trim()) || plan.planned?.some((row) => row.time || row.activity) || plan.actual?.some((row) => row.time || row.activity) || plan.remarks?.trim());
      if (hasContent) entries.push({ date: key.slice(PREFIX.length), plan });
    } catch {
      // Ignore invalid legacy plan data.
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

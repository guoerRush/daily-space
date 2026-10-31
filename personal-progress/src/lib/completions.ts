import { todayKey } from "@/lib/journals";
import { buildRemarkItems, type StoredDayPlan } from "@/lib/plans";
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

export type CompletionKind =
  | "goal"
  | "goal-task"
  | "plan-task"
  | "remark"
  | "actual";

export type CompletionRecord = {
  id: string;
  kind: CompletionKind;
  title: string;
  completedDate: string;
  completedAt: string;
  sourceDate?: string;
  detail?: string;
};

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function remarkCompletionId(date: string, text: string) {
  return `plan-remark:${date}:${hashText(text.trim())}`;
}

type StoredGoalTask = {
  id: number;
  label: string;
  done: boolean;
  children?: StoredGoalTask[];
};

type StoredGoal = {
  id: number;
  label: string;
  done: boolean;
  type: "long" | "short";
  tasks?: StoredGoalTask[];
};

function readArchive(): CompletionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.completionHistory) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CompletionRecord =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            typeof item.id === "string" &&
            "title" in item &&
            typeof item.title === "string" &&
            "completedAt" in item &&
            typeof item.completedAt === "string",
        ),
    );
  } catch {
    return [];
  }
}

function writeArchive(records: CompletionRecord[]) {
  window.localStorage.setItem(
    STORAGE_KEYS.completionHistory,
    JSON.stringify(records),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.completionHistoryChanged));
}

export function setCompletionStatus(
  record: Omit<CompletionRecord, "completedAt"> & { completedAt?: string },
  completed: boolean,
) {
  if (typeof window === "undefined") return;
  const current = readArchive();
  const existing = current.find((item) => item.id === record.id);
  if (!completed) {
    if (existing) writeArchive(current.filter((item) => item.id !== record.id));
    return;
  }
  const nextRecord: CompletionRecord = {
    ...record,
    completedAt: existing?.completedAt ?? record.completedAt ?? new Date().toISOString(),
  };
  writeArchive([
    nextRecord,
    ...current.filter((item) => item.id !== record.id),
  ]);
}

function derivedRecord(
  record: Omit<CompletionRecord, "completedAt">,
): CompletionRecord {
  return {
    ...record,
    completedAt: `${record.completedDate}T23:59:59`,
  };
}

function collectGoalTasks(
  goal: StoredGoal,
  tasks: StoredGoalTask[],
  records: CompletionRecord[],
) {
  for (const task of tasks) {
    if (task.done && task.label.trim()) {
      records.push(
        derivedRecord({
          id: `goal-task:${goal.id}:${task.id}`,
          kind: "goal-task",
          title: task.label.trim(),
          completedDate: todayKey(),
          detail: `目标：${goal.label}`,
        }),
      );
    }
    collectGoalTasks(goal, task.children ?? [], records);
  }
}

function collectCurrentRecords() {
  const records: CompletionRecord[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(STORAGE_KEYS.planPrefix)) continue;
    const date = key.slice(STORAGE_KEYS.planPrefix.length);
    try {
      const plan = JSON.parse(
        window.localStorage.getItem(key) ?? "{}",
      ) as StoredDayPlan;
      for (const task of plan.tasks ?? []) {
        if (!task.done || !task.text.trim()) continue;
        records.push(
          derivedRecord({
            id: `plan-task:${date}:${task.id}`,
            kind: "plan-task",
            title: task.text.trim(),
            completedDate: date,
            sourceDate: date,
          }),
        );
      }
      for (const item of buildRemarkItems(
        plan.remarks ?? "",
        plan.remarkChecks ?? {},
      )) {
        if (!item.done) continue;
        records.push(
          derivedRecord({
            id: remarkCompletionId(date, item.text),
            kind: "remark",
            title: item.text,
            completedDate: date,
            sourceDate: date,
          }),
        );
      }
      for (const row of plan.actual ?? []) {
        if (!row.activity.trim()) continue;
        records.push(
          derivedRecord({
            id: `plan-actual:${date}:${row.id}`,
            kind: "actual",
            title: row.activity.trim(),
            completedDate: date,
            sourceDate: date,
            detail: row.minutes ? `${row.minutes} 分钟` : undefined,
          }),
        );
      }
    } catch {
      // Ignore invalid legacy plan records.
    }
  }

  try {
    const goals = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.goals) ?? "[]",
    ) as StoredGoal[];
    for (const goal of goals) {
      if (goal.done && goal.label.trim()) {
        records.push(
          derivedRecord({
            id: `goal:${goal.id}`,
            kind: "goal",
            title: goal.label.trim(),
            completedDate: todayKey(),
            detail: goal.type === "long" ? "长期目标" : "短期目标",
          }),
        );
      }
      collectGoalTasks(goal, goal.tasks ?? [], records);
    }
  } catch {
    // Ignore invalid legacy goals.
  }
  return records;
}

export function listCompletions() {
  if (typeof window === "undefined") return [];
  const records = new Map<string, CompletionRecord>();
  for (const record of collectCurrentRecords()) records.set(record.id, record);
  for (const record of readArchive()) records.set(record.id, record);
  return [...records.values()].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt),
  );
}

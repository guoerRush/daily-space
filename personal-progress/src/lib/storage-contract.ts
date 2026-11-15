export type StoredRecords = Record<string, string>;

export type StorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
> & { keys?(): string[] };

export const STORAGE_KEYS = {
  cognitiveSettings: "daily-space:cognitive-settings",
  completionHistory: "daily-space:completion-history",
  feishuBindingCode: "daily-space:feishu-binding-code",
  feishuOpenId: "daily-space:feishu-open-id",
  feishuReminders: "daily-space:feishu-reminders",
  goals: "daily-space:goals",
  habits: "daily-space:habits",
  journals: "daily-space:journals",
  noteCategories: "daily-space:note-categories",
  notes: "daily-space:notes",
  place: "daily-space:place",
  planPrefix: "daily-space:plan:",
  weeklyPrioritiesPrefix: "daily-space:weekly-goals:",
  reminderSettings: "daily-space:reminder-settings",
  specialDays: "daily-space:special-days",
  specialDayTypes: "daily-space:special-day-types",
  successJournals: "daily-space:success-journals",
  weeklyReviews: "daily-space:weekly-reviews",
} as const;

export const STORAGE_EVENTS = {
  fitnessChanged: "daily-space:fitness-changed",
  cognitiveSettingsChanged: "daily-space:cognitive-settings-changed",
  completionHistoryChanged: "daily-space:completion-history-changed",
  daysChanged: "daily-space:days-changed",
  dayTypesChanged: "daily-space:day-types-changed",
  feishuRemindersChanged: "daily-space:feishu-reminders-changed",
  goalsChanged: "daily-space:goals-changed",
  habitCompleted: "daily-space:habit-completed",
  habitsChanged: "daily-space:habits-changed",
  journalsChanged: "daily-space:journals-changed",
  noteCategoriesChanged: "daily-space:note-categories-changed",
  notesChanged: "daily-space:notes-changed",
  plansChanged: "daily-space:plans-changed",
  reminderChanged: "daily-space:reminder-changed",
  successJournalsChanged: "daily-space:success-journals-changed",
  weeklyReviewsChanged: "daily-space:weekly-reviews-changed",
} as const;

export const STORAGE_CHANGE_EVENTS = Object.freeze([
  STORAGE_EVENTS.fitnessChanged,
  STORAGE_EVENTS.cognitiveSettingsChanged,
  STORAGE_EVENTS.completionHistoryChanged,
  STORAGE_EVENTS.daysChanged,
  STORAGE_EVENTS.dayTypesChanged,
  STORAGE_EVENTS.feishuRemindersChanged,
  STORAGE_EVENTS.goalsChanged,
  STORAGE_EVENTS.habitsChanged,
  STORAGE_EVENTS.journalsChanged,
  STORAGE_EVENTS.noteCategoriesChanged,
  STORAGE_EVENTS.notesChanged,
  STORAGE_EVENTS.plansChanged,
  STORAGE_EVENTS.reminderChanged,
  STORAGE_EVENTS.successJournalsChanged,
  STORAGE_EVENTS.weeklyReviewsChanged,
]);

/** Includes unknown daily-space keys so future features are backed up by default. */
export function isManagedStorageKey(key: string) {
  return (
    key.startsWith("daily-space:") ||
    key.startsWith("journal:") ||
    key.startsWith("mood:")
  );
}

export function collectStoredRecords(storage: StorageAdapter): StoredRecords {
  const records: StoredRecords = {};
  const keys = storage.keys?.() ?? Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key || !isManagedStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) records[key] = value;
  }
  return records;
}

export function sanitizeStoredRecords(value: unknown): StoredRecords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        isManagedStorageKey(entry[0]) && typeof entry[1] === "string",
    ),
  );
}

export function replaceStoredRecords(
  storage: StorageAdapter,
  records: StoredRecords,
) {
  const current = collectStoredRecords(storage);
  const next = sanitizeStoredRecords(records);
  const changes = [...new Set([...Object.keys(current), ...Object.keys(next)])]
    .filter((key) => current[key] !== next[key]);
  const sizeDelta = (key: string) =>
    (Object.hasOwn(next, key) ? key.length + next[key].length : 0) -
    (Object.hasOwn(current, key) ? key.length + current[key].length : 0);
  // Make room by applying removals and shrinking values before growing the data.
  changes.sort((left, right) => sizeDelta(left) - sizeDelta(right));
  const applied: string[] = [];
  try {
    for (const key of changes) {
      if (Object.hasOwn(next, key)) storage.setItem(key, next[key]);
      else storage.removeItem(key);
      applied.push(key);
    }
  } catch (error) {
    for (const key of applied.reverse()) {
      if (Object.hasOwn(current, key)) storage.setItem(key, current[key]);
      else storage.removeItem(key);
    }
    throw error;
  }
}

export function storedRecordsEqual(left: StoredRecords, right: StoredRecords) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

export function dispatchStorageChanges(target: Window = window) {
  for (const eventName of STORAGE_CHANGE_EVENTS) {
    target.dispatchEvent(new Event(eventName));
  }
}

export function subscribeToStorageChanges(
  listener: EventListener,
  target: Window = window,
) {
  for (const eventName of STORAGE_CHANGE_EVENTS) {
    target.addEventListener(eventName, listener);
  }
  return () => {
    for (const eventName of STORAGE_CHANGE_EVENTS) {
      target.removeEventListener(eventName, listener);
    }
  };
}

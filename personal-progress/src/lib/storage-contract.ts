export type StoredRecords = Record<string, string>;

export type StorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

export const STORAGE_KEYS = {
  cognitiveSettings: "daily-space:cognitive-settings",
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
  reminderSettings: "daily-space:reminder-settings",
  specialDays: "daily-space:special-days",
  specialDayTypes: "daily-space:special-day-types",
  successJournals: "daily-space:success-journals",
} as const;

export const STORAGE_EVENTS = {
  cognitiveSettingsChanged: "daily-space:cognitive-settings-changed",
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
} as const;

export const STORAGE_CHANGE_EVENTS = Object.freeze([
  STORAGE_EVENTS.cognitiveSettingsChanged,
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
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
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
  for (const key of Object.keys(collectStoredRecords(storage))) {
    storage.removeItem(key);
  }
  for (const [key, value] of Object.entries(sanitizeStoredRecords(records))) {
    storage.setItem(key, value);
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

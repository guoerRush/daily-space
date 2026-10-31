export type ReminderSettings = {
  enabled: boolean;
  time: string;
  lastNotifiedDate?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type FeishuReminder = {
  id: string;
  time: string;
  message: string;
  enabled: boolean;
  type?: "time" | "habit";
  habitId?: number;
  minAction?: string;
  sceneTag?: "清晨激活" | "午间充电" | "晚间反思";
  lastNotifiedDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const REMINDER_STORAGE_KEY = STORAGE_KEYS.reminderSettings;
export const defaultReminderSettings: ReminderSettings = {
  enabled: true,
  time: "21:50",
};

export function getReminderSettings(): ReminderSettings {
  if (typeof window === "undefined") return defaultReminderSettings;
  try {
    return {
      ...defaultReminderSettings,
      ...(JSON.parse(
        window.localStorage.getItem(REMINDER_STORAGE_KEY) ?? "{}",
      ) as Partial<ReminderSettings>),
    };
  } catch {
    return defaultReminderSettings;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  const existing = getReminderSettings();
  const now = new Date().toISOString();
  const next = {
    ...settings,
    createdAt: settings.createdAt ?? existing.createdAt ?? now,
    updatedAt: now,
  };
  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(STORAGE_EVENTS.reminderChanged));
  return next;
}

export function getFeishuReminders(): FeishuReminder[] {
  if (typeof window === "undefined") return [];
  try {
    return (
      JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.feishuReminders) ?? "[]",
      ) as FeishuReminder[]
    )
      .filter((item) => /^\d{2}:\d{2}$/.test(item.time))
      .map((item) => ({
        ...item,
        message: item.message?.trim() || "该记录今天的生活与思考了。",
      }));
  } catch {
    return [];
  }
}

export function saveFeishuReminders(reminders: FeishuReminder[]) {
  const previous = new Map(getFeishuReminders().map((item) => [item.id, item]));
  const now = new Date().toISOString();
  const stamped = reminders.map((item) => {
    const existing = previous.get(item.id);
    const numericId = Number(item.id);
    const idCreatedAt = Number.isFinite(numericId) && numericId >= 946_684_800_000
      ? new Date(numericId).toISOString()
      : now;
    const createdAt = item.createdAt ?? existing?.createdAt ?? idCreatedAt;
    const comparable = (reminder: FeishuReminder) => {
      const value = { ...reminder };
      delete value.createdAt;
      delete value.updatedAt;
      return value;
    };
    const changed = !existing || JSON.stringify(comparable(existing)) !== JSON.stringify(comparable(item));
    return {
      ...item,
      createdAt,
      updatedAt: changed ? now : item.updatedAt ?? existing?.updatedAt ?? createdAt,
    };
  });
  window.localStorage.setItem(
    STORAGE_KEYS.feishuReminders,
    JSON.stringify(stamped),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.feishuRemindersChanged));
  return stamped;
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

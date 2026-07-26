export type ReminderSettings = {
  enabled: boolean;
  time: string;
  lastNotifiedDate?: string;
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
  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(STORAGE_EVENTS.reminderChanged));
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
  window.localStorage.setItem(
    STORAGE_KEYS.feishuReminders,
    JSON.stringify(reminders),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.feishuRemindersChanged));
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

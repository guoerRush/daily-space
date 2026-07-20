export type ReminderSettings = { enabled: boolean; time: string; lastNotifiedDate?: string };
export type FeishuReminder = { id: string; time: string; message: string; enabled: boolean; lastNotifiedDate?: string };

export const REMINDER_STORAGE_KEY = "daily-space:reminder-settings";
const FEISHU_REMINDERS_STORAGE_KEY = "daily-space:feishu-reminders";
export const defaultReminderSettings: ReminderSettings = { enabled: true, time: "21:50" };

export function getReminderSettings(): ReminderSettings {
  if (typeof window === "undefined") return defaultReminderSettings;
  try {
    return { ...defaultReminderSettings, ...(JSON.parse(window.localStorage.getItem(REMINDER_STORAGE_KEY) ?? "{}") as Partial<ReminderSettings>) };
  } catch {
    return defaultReminderSettings;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("daily-space:reminder-changed"));
}

export function getFeishuReminders(): FeishuReminder[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(window.localStorage.getItem(FEISHU_REMINDERS_STORAGE_KEY) ?? "[]") as FeishuReminder[])
      .filter((item) => /^\d{2}:\d{2}$/.test(item.time))
      .map((item) => ({ ...item, message: item.message?.trim() || "该记录今天的生活与思考了。" }));
  } catch {
    return [];
  }
}

export function saveFeishuReminders(reminders: FeishuReminder[]) {
  window.localStorage.setItem(FEISHU_REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  window.dispatchEvent(new Event("daily-space:feishu-reminders-changed"));
}

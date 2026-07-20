"use client";

import { useEffect } from "react";
import { getFeishuReminders, getReminderSettings, saveFeishuReminders, saveReminderSettings } from "@/lib/reminder";
import { todayKey } from "@/lib/journals";

export function ReminderWatcher() {
  useEffect(() => {
    const check = () => {
      const settings = getReminderSettings();
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (settings.enabled && settings.lastNotifiedDate !== todayKey() && currentTime >= settings.time) {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("日常留白", { body: "该写下今天的日记和复盘了。" });
        }
        saveReminderSettings({ ...settings, lastNotifiedDate: todayKey() });
      }

      const reminders = getFeishuReminders();
      let changed = false;
      const next = reminders.map((reminder) => {
        if (!reminder.enabled || reminder.lastNotifiedDate === todayKey() || currentTime < reminder.time) return reminder;
        changed = true;
        void fetch("/api/reminders/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time: reminder.time, message: reminder.message, scheduled: true }) });
        return { ...reminder, lastNotifiedDate: todayKey() };
      });
      if (changed) saveFeishuReminders(next);
    };
    check();
    const timer = window.setInterval(check, 20_000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

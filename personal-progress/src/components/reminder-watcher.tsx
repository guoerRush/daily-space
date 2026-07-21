"use client";

import { useEffect } from "react";
import { getFeishuReminders, getReminderSettings, saveReminderSettings, type FeishuReminder } from "@/lib/reminder";

type ReminderSession = { acknowledged: boolean; startedAt?: number; lastSentAt?: number };

const REPEAT_AFTER_MS = 30_000;
const REQUIRED_PAGE_STAY_MS = 20_000;

function beijingNow() {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function sessionKey(date: string, reminderId: string) { return `daily-space:feishu-reminder-session:${date}:${reminderId}`; }
function readSession(date: string, reminderId: string): ReminderSession {
  try { return { acknowledged: false, ...(JSON.parse(window.localStorage.getItem(sessionKey(date, reminderId)) ?? "{}") as Partial<ReminderSession>) }; }
  catch { return { acknowledged: false }; }
}
function writeSession(date: string, reminderId: string, session: ReminderSession) { window.localStorage.setItem(sessionKey(date, reminderId), JSON.stringify(session)); }
function isPageActive() { return document.visibilityState === "visible" && document.hasFocus(); }

export function ReminderWatcher() {
  useEffect(() => {
    let stayTimer: number | undefined;
    const remindersReadyToStop = (date: string, time: string): FeishuReminder[] => getFeishuReminders().filter((reminder) => {
      const session = readSession(date, reminder.id);
      return reminder.enabled && !session.acknowledged && (Boolean(session.startedAt) || time === reminder.time);
    });
    const startStayTimer = () => {
      if (stayTimer || !isPageActive()) return;
      const { date, time } = beijingNow();
      if (!remindersReadyToStop(date, time).length) return;
      stayTimer = window.setTimeout(() => {
        stayTimer = undefined;
        if (!isPageActive()) return;
        const { date, time } = beijingNow();
        remindersReadyToStop(date, time).forEach((reminder) => {
          const session = readSession(date, reminder.id);
          writeSession(date, reminder.id, { ...session, acknowledged: true });
        });
      }, REQUIRED_PAGE_STAY_MS);
    };
    const check = () => {
      const { date, time } = beijingNow();
      const settings = getReminderSettings();
      if (settings.enabled && settings.lastNotifiedDate !== date && time >= settings.time) {
        if ("Notification" in window && Notification.permission === "granted") new Notification("日常留白", { body: "该写下今天的日记和复盘了。" });
        saveReminderSettings({ ...settings, lastNotifiedDate: date });
      }
      remindersReadyToStop(date, time).forEach((reminder) => {
        const session = readSession(date, reminder.id);
        const now = Date.now();
        if (session.lastSentAt && now - session.lastSentAt < REPEAT_AFTER_MS) return;
        writeSession(date, reminder.id, { ...session, startedAt: session.startedAt ?? now, lastSentAt: now });
        void fetch("/api/reminders/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time: reminder.time, message: reminder.message, scheduled: true }) });
      });
      startStayTimer();
    };
    const resetStayTimer = () => {
      if (stayTimer) window.clearTimeout(stayTimer);
      stayTimer = undefined;
      startStayTimer();
    };
    check();
    const timer = window.setInterval(check, 1_000);
    window.addEventListener("focus", resetStayTimer);
    window.addEventListener("blur", resetStayTimer);
    document.addEventListener("visibilitychange", resetStayTimer);
    return () => {
      window.clearInterval(timer);
      if (stayTimer) window.clearTimeout(stayTimer);
      window.removeEventListener("focus", resetStayTimer);
      window.removeEventListener("blur", resetStayTimer);
      document.removeEventListener("visibilitychange", resetStayTimer);
    };
  }, []);
  return null;
}

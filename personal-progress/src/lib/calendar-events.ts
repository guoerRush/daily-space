import { type SpecialDay } from "@/lib/days";

export type CalendarEvent = { title: string; kind: "festival" | "holiday" | "special" };

const fixedFestivals: Record<string, CalendarEvent[]> = {
  "01-01": [{ title: "元旦", kind: "festival" }],
  "05-01": [{ title: "劳动节", kind: "festival" }],
  "10-01": [{ title: "国庆节", kind: "festival" }],
  "12-25": [{ title: "圣诞节", kind: "festival" }],
};

// Chinese State Council public-holiday dates for the current calendar year.
const holidays2026: Record<string, string> = {
  "2026-01-01": "元旦假期", "2026-01-02": "元旦假期", "2026-01-03": "元旦假期",
  "2026-02-15": "春节假期", "2026-02-16": "春节假期", "2026-02-17": "春节", "2026-02-18": "春节假期", "2026-02-19": "春节假期", "2026-02-20": "春节假期", "2026-02-21": "春节假期", "2026-02-22": "春节假期", "2026-02-23": "春节假期",
  "2026-04-04": "清明假期", "2026-04-05": "清明节", "2026-04-06": "清明假期",
  "2026-05-02": "劳动节假期", "2026-05-03": "劳动节假期", "2026-05-04": "劳动节假期", "2026-05-05": "劳动节假期",
  "2026-06-19": "端午节", "2026-06-20": "端午假期", "2026-06-21": "端午假期",
  "2026-09-25": "中秋节", "2026-09-26": "中秋假期", "2026-09-27": "中秋假期",
  "2026-10-02": "国庆假期", "2026-10-03": "国庆假期", "2026-10-04": "国庆假期", "2026-10-05": "国庆假期", "2026-10-06": "国庆假期", "2026-10-07": "国庆假期",
};

export function calendarEventsForDate(date: string, specialDays: SpecialDay[] = []): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const fixed = fixedFestivals[date.slice(5)];
  if (fixed) events.push(...fixed);
  const holiday = holidays2026[date];
  if (holiday && !events.some((event) => event.title === holiday)) events.push({ title: holiday, kind: "holiday" });
  for (const day of specialDays) {
    if (day.date === date || (day.repeatsYearly && day.date.slice(5) === date.slice(5))) events.push({ title: day.title, kind: "special" });
  }
  return events;
}

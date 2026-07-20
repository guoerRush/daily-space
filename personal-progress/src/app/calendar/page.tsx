"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { calendarEventsForDate } from "@/lib/calendar-events";
import { listSpecialDays } from "@/lib/days";
import { listJournals } from "@/lib/journals";

type Plan = { tasks?: Array<{ text: string; priority: number; done: boolean }> };
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const key = (day: Date) => [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");

function tasksForDate(date: string) {
  try {
    const plan = JSON.parse(window.localStorage.getItem(`daily-space:plan:${date}`) ?? "{}") as Plan;
    return (plan.tasks ?? []).filter((task) => task.text.trim()).sort((a, b) => a.priority - b.priority);
  } catch { return []; }
}

export default function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [, setRevision] = useState(0);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    const events = ["daily-space:plans-changed", "daily-space:journals-changed", "daily-space:days-changed"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  const savedDates = new Set((ready ? listJournals() : []).map((entry) => entry.date));
  const specialDays = ready ? listSpecialDays() : [];
  const offset = (month.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const number = index - offset + 1;
    return number > 0 && number <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() ? new Date(month.getFullYear(), month.getMonth(), number) : null;
  });

  return <AppFrame><div className="mx-auto max-w-6xl"><div className="flex items-end justify-between"><div><p className="text-sm text-[#65736a]">按日期回顾、查看安排和重要日子</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">日历</h1></div><div className="flex gap-1"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="上个月" className="grid h-9 w-9 place-items-center border border-[#dfe5df] bg-white"><ChevronLeft size={18} /></button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="下个月" className="grid h-9 w-9 place-items-center border border-[#dfe5df] bg-white"><ChevronRight size={18} /></button></div></div><section className="mt-7 overflow-x-auto border border-[#dfe5df] bg-white"><div className="min-w-[700px] p-4 md:p-6"><h2 className="text-lg font-semibold">{month.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</h2><div className="mt-6 grid grid-cols-7 border-l border-t border-[#e5eae5]">{weekdays.map((day) => <div key={day} className="border-b border-r border-[#e5eae5] py-3 text-center text-xs font-medium text-[#66776c]">周{day}</div>)}{cells.map((day, index) => { const date = day ? key(day) : ""; const tasks = day && ready ? tasksForDate(date) : []; const events = day ? calendarEventsForDate(date, specialDays) : []; const shownTasks = tasks.slice(0, Math.max(1, 3 - Math.min(events.length, 2))); return <div key={date || index} className="min-h-36 border-b border-r border-[#e5eae5] p-2">{day ? <><Link href={`/journals/${date}`} aria-label={`编辑${date}日记`} className={`grid h-7 w-7 place-items-center text-sm hover:bg-[#e5eee7] ${savedDates.has(date) ? "bg-[#2f6651] text-white" : ""}`}>{day.getDate()}</Link><div className="mt-2 space-y-1">{events.slice(0, 2).map((event) => <span key={`${event.kind}-${event.title}`} className={`block truncate border-l-2 px-1.5 py-0.5 text-[11px] leading-4 ${event.kind === "holiday" ? "border-[#c86b55] bg-[#fff0ec] text-[#865143]" : event.kind === "special" ? "border-[#ab7592] bg-[#fff1f7] text-[#765064]" : "border-[#8c9d55] bg-[#f4f7e9] text-[#59623d]"}`}>{event.title}</span>)}{shownTasks.map((task) => <Link key={`${date}-${task.priority}-${task.text}`} href={`/plan?date=${date}`} title={task.text} className={`block truncate border-l-2 px-1.5 py-0.5 text-[11px] leading-4 ${task.done ? "border-[#8bad92] bg-[#eff6f0] text-[#77857c] line-through" : "border-[#d6a55a] bg-[#fff7e9] text-[#4d473c]"}`}>{task.text}</Link>)}{tasks.length > shownTasks.length ? <Link href={`/plan?date=${date}`} className="block text-[11px] text-[#2f6651]">+{tasks.length - shownTasks.length} 项</Link> : null}</div>{savedDates.has(date) ? <span className="mt-2 block text-[10px] text-[#2f6651]">已写日记</span> : null}</> : null}</div>; })}</div><p className="mt-5 text-sm text-[#718077]">粉色为纪念日，红色为假期，绿色为节日。纪念日来自“日子”页面，待办来自“今日安排”。</p></div></section></div></AppFrame>;
}

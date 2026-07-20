"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, PartyPopper } from "lucide-react";
import { calendarEventsForDate } from "@/lib/calendar-events";
import { listSpecialDays } from "@/lib/days";
import { todayKey } from "@/lib/journals";

export function TodayEvents() {
  const [events, setEvents] = useState(() => calendarEventsForDate(todayKey(), []));
  useEffect(() => {
    const refresh = () => setEvents(calendarEventsForDate(todayKey(), listSpecialDays()));
    refresh();
    window.addEventListener("daily-space:days-changed", refresh);
    return () => window.removeEventListener("daily-space:days-changed", refresh);
  }, []);
  if (!events.length) return null;
  return <section className="mt-5 border border-[#e4d5ae] bg-[#fffaf0] px-5 py-4"><div className="flex items-center gap-2 text-[#8d6829]"><PartyPopper size={18} /><h2 className="font-semibold">今天是特别的日子</h2></div><div className="mt-3 flex flex-wrap gap-2">{events.map((event) => <span key={`${event.kind}-${event.title}`} className="inline-flex items-center gap-1.5 border border-[#ead7aa] bg-white px-3 py-1.5 text-sm text-[#66522e]"><CalendarHeart size={14} />{event.title}</span>)}</div></section>;
}

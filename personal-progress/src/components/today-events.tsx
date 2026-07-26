"use client";

import { useEffect, useState } from "react";
import { CalendarHeart } from "lucide-react";
import { calendarEventsForDate } from "@/lib/calendar-events";
import { listSpecialDays } from "@/lib/days";
import { todayKey } from "@/lib/journals";

export function TodayEventLabel() {
  const [events, setEvents] = useState(() => calendarEventsForDate(todayKey(), []));
  useEffect(() => {
    const refresh = () => setEvents(calendarEventsForDate(todayKey(), listSpecialDays()));
    refresh();
    window.addEventListener("daily-space:days-changed", refresh);
    return () => window.removeEventListener("daily-space:days-changed", refresh);
  }, []);
  if (!events.length) return null;
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#a06420]"><CalendarHeart size={15} /><span>特别日子：{events.map((event) => event.title).join("、")}</span></span>;
}

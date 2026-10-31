"use client";

import { useEffect, useState } from "react";
import { CalendarHeart } from "lucide-react";
import { useTodayKey } from "@/hooks/use-today-key";
import { calendarEventsForDate } from "@/lib/calendar-events";
import { listSpecialDays } from "@/lib/days";

export function TodayEventLabel() {
  const today = useTodayKey();
  const [events, setEvents] = useState(() => calendarEventsForDate(today, []));
  useEffect(() => {
    const refresh = () => setEvents(calendarEventsForDate(today, listSpecialDays()));
    refresh();
    window.addEventListener("daily-space:days-changed", refresh);
    return () => window.removeEventListener("daily-space:days-changed", refresh);
  }, [today]);
  if (!events.length) return null;
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#a06420]"><CalendarHeart size={15} /><span>特别日子：{events.map((event) => event.title).join("、")}</span></span>;
}

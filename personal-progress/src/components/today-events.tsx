"use client";

import { useEffect, useState } from "react";
import { Cake, CalendarHeart } from "lucide-react";
import Link from "next/link";
import { calendarEventsForDate } from "@/lib/calendar-events";
import { listSpecialDays, nearestBirthdays, type SpecialDay } from "@/lib/days";
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

export function TodayEventLabel({ today }: { today: string }) {
  const [days, setDays] = useState<SpecialDay[] | null>(null);
  useEffect(() => {
    const refresh = () => setDays(listSpecialDays());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEYS.specialDays) refresh();
    };
    refresh();
    window.addEventListener(STORAGE_EVENTS.daysChanged, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STORAGE_EVENTS.daysChanged, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const { remaining, birthdays } = nearestBirthdays(days ?? [], today);
  const events = calendarEventsForDate(today, (days ?? []).filter(day => remaining !== 0 || !birthdays.includes(day)));
  return <>
    {days && <Link href="/days" className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card/75 px-2.5 py-1 text-xs font-medium text-primary hover:underline">
      <Cake size={15} aria-hidden="true" className="shrink-0" />
      <span className="break-words">{birthdays.length
        ? <>{remaining === 0 ? "今日生日" : "最近生日"} · {birthdays.map(day => day.title).join("、")}{remaining > 0 && <> · 还有 <strong>{remaining}</strong> 天</>}</>
        : "添加生日"}</span>
    </Link>}
    {events.length > 0 && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#a06420]"><CalendarHeart size={15} /><span>特别日子：{events.map((event) => event.title).join("、")}</span></span>}
  </>;
}

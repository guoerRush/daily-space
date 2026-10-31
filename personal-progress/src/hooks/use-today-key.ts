"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/journals";

export function useTodayKey(initialDate = todayKey()) {
  const [today, setToday] = useState(initialDate);

  useEffect(() => {
    const refreshDate = () => setToday(todayKey());
    refreshDate();
    const timer = window.setInterval(refreshDate, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return today;
}

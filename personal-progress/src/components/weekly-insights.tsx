"use client";

import { useEffect, useState } from "react";
import { BarChart3, BookOpenCheck, Flame } from "lucide-react";
import { listHabits } from "@/lib/habits";
import { listJournals, todayKey } from "@/lib/journals";

type DayStat = {
  date: string;
  label: string;
  journal: boolean;
  habitChecks: number;
};

function dateKey(day: Date) {
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

export function WeeklyInsights() {
  const [days, setDays] = useState<DayStat[]>([]);

  useEffect(() => {
    const refresh = () => {
      const journals = new Set(listJournals().map((item) => item.date));
      const habits = listHabits();
      const today = new Date(`${todayKey()}T12:00:00`);
      const next = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        const key = dateKey(date);

        return {
          date: key,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          journal: journals.has(key),
          habitChecks: habits.filter((habit) => habit.completedDates.includes(key)).length,
        };
      });
      setDays(next);
    };

    refresh();
    const events = ["daily-space:journals-changed", "daily-space:habits-changed"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  if (!days.length) return null;

  const journalDays = days.filter((day) => day.journal).length;
  const habitChecks = days.reduce((sum, day) => sum + day.habitChecks, 0);
  const maxHabitChecks = Math.max(1, ...days.map((day) => day.habitChecks));

  return (
    <section className="mt-5 border border-[#dfe5df] bg-white p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#2f6651]">
            <BarChart3 size={18} />
            <h2 className="font-semibold">本周洞察</h2>
          </div>
          <p className="mt-1 text-sm text-[#718077]">用趋势看见持续投入，而不只看今天。</p>
        </div>
        <span className="text-sm font-medium text-[#2f6651]">近 7 天</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="border-l-2 border-[#b67446] pl-3">
          <span className="text-xs text-[#718077]">日记记录</span>
          <strong className="mt-1 block text-2xl">{journalDays} 天</strong>
        </div>
        <div className="border-l-2 border-[#8172a3] pl-3">
          <span className="text-xs text-[#718077]">习惯打卡</span>
          <strong className="mt-1 block text-2xl">{habitChecks} 次</strong>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 items-end gap-2 border-t border-[#edf1ed] pt-4">
        {days.map((day) => {
          const height = day.habitChecks ? Math.max(14, (day.habitChecks / maxHabitChecks) * 88) : 4;
          return (
            <div key={day.date} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end bg-[#f5f2f8] px-1">
                <div
                  title={`${day.label}：${day.habitChecks} 次习惯打卡`}
                  style={{ height }}
                  className="w-full bg-[#8172a3]"
                />
              </div>
              <span
                title={day.journal ? `${day.label} 已记录日记` : `${day.label} 未记录日记`}
                className={`h-2 w-2 rounded-full ${day.journal ? "bg-[#b67446]" : "bg-[#dfe5df]"}`}
              />
              <span className="text-[10px] text-[#718077]">{day.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#718077]">
        <span className="inline-flex items-center gap-1">
          <BookOpenCheck size={13} className="text-[#b67446]" />
          圆点表示当天已记录日记
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame size={13} className="text-[#8172a3]" />
          柱形表示每日习惯打卡次数
        </span>
      </div>
    </section>
  );
}

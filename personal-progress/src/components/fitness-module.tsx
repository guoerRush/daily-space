"use client";

import Image from "next/image";
import { CalendarDays, CheckCircle2, Dumbbell, RotateCcw } from "lucide-react";
import { useTodayKey } from "@/hooks/use-today-key";

const cycle = [
  {
    label: "第 1 天",
    title: "胸 · 腹部",
    image: "/fitness-chest.jpg",
    groups: [
      ["胸部", ["杠铃卧推 4×12", "哑铃上斜卧推 4×12", "蝴蝶机夹胸 4×12", "绳索夹下胸 4×12"]],
      ["腹部", ["俄罗斯转体", "悬垂举腿"]],
    ],
  },
  {
    label: "第 2 天",
    title: "背 · 腹部",
    image: "/fitness-back.jpg",
    groups: [
      ["背部", ["引体向上", "宽距高位下拉 4×12", "窄距坐姿划船 4×12", "反手高位下拉 4×12", "坐姿单边划船 4×12"]],
      ["腹部", ["俄罗斯转体", "悬垂举腿"]],
    ],
  },
  {
    label: "第 3 天",
    title: "肩 · 腿 · 腹部",
    image: "/fitness-upper-body.jpg",
    groups: [
      ["肩部", ["飞鸟 4×12", "坐姿推肩 4×12", "绳索面拉 4×12"]],
      ["腿部", ["杠铃深蹲", "坐姿腿弯举"]],
      ["腹部", ["俄罗斯转体", "悬垂举腿"]],
    ],
  },
] as const;

function cycleIndex(date: string) {
  const start = Date.UTC(2026, 10, 10);
  const current = Date.parse(date + "T00:00:00Z");
  const days = Math.floor((current - start) / 86_400_000);
  return ((days % 4) + 4) % 4;
}

export function FitnessModule({ initialDate }: { initialDate: string }) {
  const today = useTodayKey(initialDate);
  const index = cycleIndex(today);
  const rest = index === 3;
  const day = cycle[index === 3 ? 0 : index];

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#d8e2dc] bg-white shadow-[0_8px_24px_rgba(47,102,81,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e9e4] px-5 py-4 md:px-6">
        <div>
          <div className="flex items-center gap-2 text-[#2f6651]">
            <Dumbbell size={18} strokeWidth={1.8} />
            <h2 className="font-semibold">健身</h2>
          </div>
          <p className="mt-1 text-sm text-[#718077]">三天训练后休息一天，按周期循环</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf6ef] px-3 py-1.5 text-xs font-medium text-[#2f6651]">
          <CalendarDays size={14} />
          {rest ? "第 4 天 · 休息" : day.label + " · " + day.title}
        </span>
      </div>

      {rest ? (
        <div className="grid gap-3 px-5 py-6 text-center md:px-6">
          <CheckCircle2 className="mx-auto text-[#4f8b5d]" size={28} />
          <p className="font-semibold text-[#31473a]">今天休息，明天回到胸部训练</p>
          <p className="text-sm text-[#718077]">可以散步、拉伸，给下一轮训练留出恢复时间。</p>
        </div>
      ) : (
        <div className="grid gap-5 p-5 md:grid-cols-[15rem_minmax(0,1fr)] md:p-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#f3f6f3]">
            <Image src={day.image} alt={day.title + "训练示意图"} fill className="object-cover" sizes="(min-width: 768px) 240px, 100vw" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {day.groups.map(([group, exercises]) => (
              <div key={group} className="rounded-lg border border-[#e2e9e4] bg-[#fbfdfb] p-4">
                <h3 className="font-medium text-[#315944]">{group}</h3>
                <ul className="mt-2 grid gap-2 text-sm leading-5 text-[#5d7665]">
                  {exercises.map((exercise) => <li key={exercise} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#82ab8d]" />{exercise}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-[#e2e9e4] px-5 py-3 text-xs text-[#718077] md:px-6">
        <RotateCcw size={13} />
        每完成三天训练后自动安排一天休息
      </div>
    </section>
  );
}

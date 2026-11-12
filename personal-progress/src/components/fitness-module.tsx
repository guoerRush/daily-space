"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Dumbbell, RotateCcw, Save } from "lucide-react";
import { useTodayKey } from "@/hooks/use-today-key";
import { ImageLightbox } from "@/components/image-lightbox";

type TrainingDay = { label: string; title: string; groups: [string, string[]][] };

const cycle: TrainingDay[] = [
  { label: "第 1 天", title: "胸 · 腹部", groups: [["胸部", ["杠铃卧推 4×12", "哑铃上斜卧推 4×12", "蝴蝶机夹胸 4×12", "绳索夹下胸 4×12"]], ["腹部", ["俄罗斯转体", "悬垂举腿"]]] },
  { label: "第 2 天", title: "背 · 腹部", groups: [["背部", ["引体向上", "宽距高位下拉 4×12", "窄距坐姿划船 4×12", "反手高位下拉 4×12", "坐姿单边划船 4×12"]], ["腹部", ["俄罗斯转体", "悬垂举腿"]]] },
  { label: "第 3 天", title: "肩 · 腿 · 腹部", groups: [["肩部", ["飞鸟 4×12", "坐姿推肩 4×12", "绳索面拉 4×12"]], ["腿部", ["杠铃深蹲", "坐姿腿弯举"]], ["腹部", ["俄罗斯转体", "悬垂举腿"]]] },
];

const gallery = [["/fitness-chest.jpg", "胸 · 腹部"], ["/fitness-back.jpg", "背 · 腹部"], ["/fitness-upper-body.jpg", "肩 · 腿 · 腹部"], ["/fitness-legs.jpg", "腿部动作参考"]] as const;

type WeightHistory = { date: string; values: Record<string, string> };

function cycleIndex(date: string) {
  const start = Date.UTC(2026, 10, 12);
  const current = Date.parse(date + "T00:00:00Z");
  const days = Math.floor((current - start) / 86_400_000);
  return ((days % 4) + 4) % 4;
}

export function FitnessModule({ initialDate }: { initialDate: string }) {
  const today = useTodayKey(initialDate);
  const activeIndex = cycleIndex(today);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("fitness-weight-records");
        if (stored) setWeights(JSON.parse(stored) as Record<string, string>);
        const history = window.localStorage.getItem("fitness-weight-history");
        if (history) setWeightHistory(JSON.parse(history) as WeightHistory[]);
      } catch { /* Ignore unavailable or malformed local storage. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateWeight(key: string, value: string) {
    setWeights((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function saveWeights() {
    const values = Object.fromEntries(Object.entries(weights).filter(([, value]) => value.trim()));
    if (!Object.keys(values).length) return;
    const nextHistory = [{ date: today, values }, ...weightHistory.filter((item) => item.date !== today)].slice(0, 90);
    try {
      window.localStorage.setItem("fitness-weight-records", JSON.stringify(values));
      window.localStorage.setItem("fitness-weight-history", JSON.stringify(nextHistory));
      setWeightHistory(nextHistory);
      setSaved(true);
    } catch { setSaved(false); }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#d8e2dc] bg-white shadow-[0_8px_24px_rgba(47,102,81,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e9e4] px-5 py-4 md:px-6">
        <div><div className="flex items-center gap-2 text-[#2f6651]"><Dumbbell size={18} strokeWidth={1.8} /><h2 className="font-semibold">健身</h2></div><p className="mt-1 text-sm text-[#718077]">三天训练后休息一天，四天计划完整展示</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf6ef] px-3 py-1.5 text-xs font-medium text-[#2f6651]"><CalendarDays size={14} />{activeIndex === 3 ? "今天 · 第 4 天休息" : `今天 · ${cycle[activeIndex].label} ${cycle[activeIndex].title}`}</span>
      </div>

      <div className="border-b border-[#e2e9e4] bg-[#fbfdfb] p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-[#31473a]">训练动作参考</h3><p className="mt-1 text-xs text-[#718077]">四张图集中放在顶部，训练时可对照查看</p></div><span className="inline-flex items-center gap-1 text-xs text-[#718077]"><Save size={13} />重量记录自动保存</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{gallery.map(([src, title]) => <div key={src} className="group overflow-hidden rounded-lg border border-[#e2e9e4] bg-white"><div className="relative aspect-[4/3] overflow-hidden"><ImageLightbox src={src} alt={title} renderTrigger={(openPreview) => <button type="button" onClick={openPreview} className="absolute inset-0 cursor-zoom-in" aria-label={`放大查看${title}`}><Image src={src} alt={title} fill className="object-cover transition duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, 50vw" /></button>} /></div><p className="px-3 py-2 text-sm font-medium text-[#315944]">{title}</p></div>)}</div>
      </div>

      <div className="grid gap-4 p-5 md:p-6">{cycle.map((day, dayIndex) => <article key={day.label} className={`rounded-xl border p-4 ${activeIndex === dayIndex ? "border-[#82ab8d] bg-[#f4faf5] shadow-sm" : "border-[#e2e9e4] bg-white"}`}><div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e9e4] pb-3"><div><p className="text-xs font-medium text-[#718077]">{day.label}</p><h3 className="text-lg font-semibold text-[#315944]">{day.title}</h3></div>{activeIndex === dayIndex && <span className="rounded-full bg-[#dcefe0] px-3 py-1 text-xs font-medium text-[#2f6651]">今天训练</span>}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{day.groups.map(([group, exercises]) => <div key={group} className="rounded-lg border border-[#e2e9e4] bg-[#fbfdfb] p-3"><h4 className="mb-2 font-medium text-[#315944]">{group}</h4><div className="grid gap-2">{exercises.map((exercise) => { const key = `${day.label}-${group}-${exercise}`; return <label key={key} className="grid gap-1 text-sm text-[#5d7665]"><span>{exercise}</span><input value={weights[key] ?? ""} onChange={(event) => updateWeight(key, event.target.value)} placeholder="填写当前重量 / 备注" className="w-full rounded-md border border-[#d8e2dc] bg-white px-3 py-2 text-sm text-[#31473a] outline-none transition placeholder:text-[#a2b1a7] focus:border-[#72a17f] focus:ring-2 focus:ring-[#dcefe0]" /></label>; })}</div></div>)}</div></article>)}<div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#f4f8f4] px-4 py-3 text-sm text-[#718077]"><CheckCircle2 size={16} className="text-[#4f8b5d]" />第 4 天休息，完成后自动回到第 1 天。<button type="button" onClick={saveWeights} className="rounded-md bg-[#2f6651] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#285945]">保存当前重量</button>{saved && <span className="text-[#4f8b5d]">已保存 {today}</span>}</div></div>
      {weightHistory.length ? <div className="border-t border-[#e2e9e4] bg-[#fbfdfb] px-5 py-4 md:px-6"><h3 className="font-semibold text-[#315944]">历史重量记录</h3><div className="mt-3 grid gap-2">{weightHistory.slice(0, 7).map((record) => <details key={record.date} className="rounded-lg border border-[#e2e9e4] bg-white px-3 py-2"><summary className="cursor-pointer text-sm font-medium text-[#315944]">{record.date} · {Object.keys(record.values).length} 项记录</summary><div className="mt-2 grid gap-1 border-t border-[#eef2ee] pt-2 text-xs text-[#718077]">{Object.entries(record.values).map(([key, value]) => <p key={key}><span className="text-[#4f6655]">{key.replace(/^第 [123] 天-/, "")}</span>：{value}</p>)}</div></details>)}</div></div> : null}
      <div className="flex items-center gap-2 border-t border-[#e2e9e4] px-5 py-3 text-xs text-[#718077] md:px-6"><RotateCcw size={13} />重量记录保存在当前浏览器，可随时更新。</div>
    </section>
  );
}

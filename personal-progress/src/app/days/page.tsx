"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CalendarHeart, Gift, Plus, Trash2 } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { countdown, deleteSpecialDay, listSpecialDays, saveSpecialDay, type SpecialDay } from "@/lib/days";

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  return ready ? <>{children}</> : null;
}

const categoryLabels: Record<SpecialDay["category"], string> = { anniversary: "纪念日", birthday: "生日", other: "重要日子" };

export default function DaysPage() {
  return <AppFrame><ClientOnly><DaysWorkspace /></ClientOnly></AppFrame>;
}

function DaysWorkspace() {
  const [days, setDays] = useState(() => listSpecialDays());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<SpecialDay["category"]>("anniversary");
  const [repeatsYearly, setRepeatsYearly] = useState(false);
  const addDay = () => {
    if (!title.trim() || !date) return;
    saveSpecialDay({ title: title.trim(), date, category, repeatsYearly });
    setDays(listSpecialDays());
    setTitle("");
    setDate("");
    setRepeatsYearly(false);
  };

  return <div className="mx-auto max-w-5xl">
    <div><p className="text-sm text-[#65736a]">把重要日子留在眼前</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">日子</h1></div>
    <section className="mt-7 border border-[#dfe5df] bg-white p-5 md:p-6">
      <div className="flex items-center gap-2 text-[#2f6651]"><CalendarHeart size={19} /><h2 className="font-semibold">添加倒计时</h2></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_140px_auto]">
        <input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addDay()} placeholder="例如：毕业纪念日" className="min-w-0 border border-[#cfd8d0] px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]" />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="border border-[#cfd8d0] px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]" />
        <select value={category} onChange={(event) => setCategory(event.target.value as SpecialDay["category"])} className="border border-[#cfd8d0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]"><option value="anniversary">纪念日</option><option value="birthday">生日</option><option value="other">重要日子</option></select>
        <button onClick={addDay} className="flex items-center justify-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"><Plus size={17} />添加</button>
      </div>
      <label className="mt-4 flex w-fit items-center gap-2 text-sm text-[#526158]"><input type="checkbox" checked={repeatsYearly} onChange={(event) => setRepeatsYearly(event.target.checked)} className="h-4 w-4 accent-[#2f6651]" />每年重复提醒</label>
    </section>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {days.map((day) => {
        const remaining = countdown(day);
        return <article key={day.id} className="relative min-h-48 border border-[#dfe5df] bg-white p-5"><div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm text-[#65736a]"><Gift size={16} className="text-[#b56b65]" />{categoryLabels[day.category]}</span><button onClick={() => { deleteSpecialDay(day.id); setDays(listSpecialDays()); }} aria-label={`删除${day.title}`} title="删除" className="grid h-8 w-8 place-items-center text-[#8a968e] hover:bg-[#f7eeee] hover:text-[#b54f4f]"><Trash2 size={16} /></button></div><h2 className="mt-5 font-semibold">{day.title}</h2><strong className="mt-3 block text-4xl font-semibold text-[#17221d]">{remaining >= 0 ? `${remaining} 天` : `已过 ${Math.abs(remaining)} 天`}</strong><p className="mt-4 text-sm text-[#718077]">{day.repeatsYearly ? "每年" : day.date}{day.repeatsYearly ? ` · ${new Date(`${day.date}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}` : ""}</p></article>;
      })}
      {!days.length ? <div className="col-span-full border border-dashed border-[#cfd8d0] px-5 py-16 text-center text-sm text-[#718077]">添加一个重要日子，在这里查看倒计时。</div> : null}
    </section>
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronUp, Flame, Sparkles, StickyNote } from "lucide-react";
import {
  RichTextContent,
  richTextToPlainText,
} from "@/components/rich-text-editor";
import { listJournals, todayKey, type JournalEntry } from "@/lib/journals";
import { listNotes, type Note } from "@/lib/notes";
import { buildRemarkItems, type RemarkItem } from "@/lib/plans";
import { listSuccessJournals, type SuccessJournal } from "@/lib/success-journals";

type Plan = {
  tasks?: Array<{ done: boolean }>;
  remarks?: string;
  remarkChecks?: Record<string, boolean>;
};
type ExpandedKind = "journals" | "success" | "notes" | null;
type DashboardData = {
  journals: JournalEntry[];
  successes: SuccessJournal[];
  notes: Note[];
  streak: number;
  taskDone: number;
  taskTotal: number;
  remarks: RemarkItem[];
};

function getData(): DashboardData {
  const journals = listJournals();
  const dates = new Set(journals.map((entry) => entry.date));
  let streak = 0;
  const cursor = new Date(`${todayKey()}T12:00:00`);
  while (dates.has([cursor.getFullYear(), String(cursor.getMonth() + 1).padStart(2, "0"), String(cursor.getDate()).padStart(2, "0")].join("-"))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let plan: Plan = {};
  try {
    plan = JSON.parse(
      window.localStorage.getItem(`daily-space:plan:${todayKey()}`) ?? "{}",
    ) as Plan;
  } catch {
    // Ignore invalid local plan data.
  }
  const tasks = plan.tasks ?? [];
  return {
    journals,
    successes: listSuccessJournals(),
    notes: listNotes(),
    streak,
    taskDone: tasks.filter((task) => task.done).length,
    taskTotal: tasks.length,
    remarks: buildRemarkItems(plan.remarks ?? "", plan.remarkChecks ?? {}),
  };
}

export function DashboardInsights() {
  const [data, setData] = useState<DashboardData>({ journals: [], successes: [], notes: [], streak: 0, taskDone: 0, taskTotal: 0, remarks: [] });
  const [expanded, setExpanded] = useState<ExpandedKind>(null);

  useEffect(() => {
    const refresh = () => setData(getData());
    refresh();
    const events = ["daily-space:journals-changed", "daily-space:notes-changed", "daily-space:plans-changed", "daily-space:success-journals-changed"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  const toggle = (kind: Exclude<ExpandedKind, null>) => setExpanded((current) => current === kind ? null : kind);
  const toggleTodayRemark = (id: string) => {
    try {
      const key = `daily-space:plan:${todayKey()}`;
      const plan = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Plan;
      const checks = plan.remarkChecks ?? {};
      window.localStorage.setItem(
        key,
        JSON.stringify({
          ...plan,
          remarkChecks: { ...checks, [id]: !checks[id] },
        }),
      );
      window.dispatchEvent(new Event("daily-space:plans-changed"));
    } catch {
      // Keep the dashboard usable when a legacy plan cannot be read.
    }
  };
  const cards = [
    { href: "/plan", icon: CheckCircle2, value: data.taskTotal ? `${data.taskDone}/${data.taskTotal}` : "-", label: "今日待办完成", detail: "查看今日安排", tone: "bg-[#edf6ef] text-[#35704b]" },
    { kind: "journals" as const, icon: Flame, value: data.journals.length, label: "日记回顾", detail: `连续记录 ${data.streak} 天`, tone: "bg-[#fff3e5] text-[#a5632e]" },
    { kind: "success" as const, icon: Sparkles, value: data.successes.length, label: "成功日记", detail: "展开查看记录", tone: "bg-[#eef2fb] text-[#526b9b]" },
    { kind: "notes" as const, icon: StickyNote, value: data.notes.length, label: "随记", detail: "展开查看记录", tone: "bg-[#f9eff3] text-[#9b5d75]" },
  ];

  return <>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const content = <><span className={`grid h-7 w-7 place-items-center rounded-lg ${card.tone}`}><Icon size={15} strokeWidth={1.8} /></span><div className="mt-2 flex items-end justify-between gap-2"><div><strong className="block text-xl font-semibold tracking-normal text-[#203126]">{card.value}</strong><span className="mt-0.5 block text-sm text-[#718077]">{card.label}</span><span className="mt-0.5 block text-xs text-[#93a197]">{card.detail}</span></div>{"kind" in card ? (expanded === card.kind ? <ChevronUp size={16} className="text-[#718077]" /> : <ChevronDown size={16} className="text-[#718077]" />) : null}</div></>;
        return card.href ? <Link key={card.label} href={card.href} className="rounded-xl border border-[#dce6de] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(31,67,45,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#a6c2ae] hover:shadow-[0_8px_20px_rgba(35,75,51,0.08)]">{content}</Link> : <button key={card.label} type="button" onClick={() => toggle(card.kind!)} aria-expanded={expanded === card.kind} className="rounded-xl border border-[#dce6de] bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(31,67,45,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#a6c2ae] hover:shadow-[0_8px_20px_rgba(35,75,51,0.08)]">{content}</button>;
      })}
    </section>
    <TodayRemarksPanel remarks={data.remarks} onToggle={toggleTodayRemark} />
    {expanded ? <ReviewPanel kind={expanded} journals={data.journals} successes={data.successes} notes={data.notes} /> : null}
  </>;
}

function TodayRemarksPanel({ remarks, onToggle }: { remarks: RemarkItem[]; onToggle: (id: string) => void }) {
  const unfinished = remarks.filter((item) => !item.done).length;
  const [expanded, setExpanded] = useState(false);
  const visibleRemarks = expanded ? remarks : remarks.slice(0, 3);
  return <section className="mt-3 border border-[#b9d7c0] bg-[#f4faf4] px-5 py-4 shadow-[0_5px_18px_rgba(47,102,81,0.08)]">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dcefdc] text-[#2f6651]"><StickyNote size={18} /></span>
        <div><h2 className="font-semibold text-[#294c36]">今日备注</h2><p className="mt-0.5 text-sm text-[#5d7665]">{remarks.length ? `还有 ${unfinished} 条需要留意` : "把重要提醒写进今日安排"}</p></div>
      </div>
      <Link href="/plan" className="text-sm font-medium text-[#2f6651] hover:underline">查看与修改</Link>
    </div>
    {remarks.length ? <ul className="mt-4 grid gap-2 md:grid-cols-2">
      {visibleRemarks.map((item) => <li key={item.id} className={`border border-white/80 bg-white/75 ${item.done ? "text-[#809086]" : "font-medium text-[#355642]"}`}>
        <button type="button" onClick={() => onToggle(item.id)} aria-pressed={item.done} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm leading-6">
          <span className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${item.done ? "border-[#4e8b5d] bg-[#4e8b5d] text-white" : "border-[#6d9a78] bg-white"}`}>{item.done ? <Check size={11} /> : null}</span>
          <span className={item.done ? "line-through" : ""}>{item.text}</span>
        </button>
      </li>)}
    </ul> : <p className="mt-4 border border-dashed border-[#bdd6c3] bg-white/55 px-3 py-3 text-sm text-[#718077]">暂无备注。点击“查看与修改”去记录今天需要持续提醒自己的事。</p>}
    {remarks.length > 3 ? <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2f6651] hover:underline">
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      {expanded ? "收起备注" : `展开剩余 ${remarks.length - 3} 条备注`}
    </button> : null}
  </section>;
}

function ReviewPanel({ kind, journals, successes, notes }: { kind: Exclude<ExpandedKind, null>; journals: JournalEntry[]; successes: SuccessJournal[]; notes: Note[] }) {
  const records = kind === "journals" ? journals.slice(0, 5).map((item) => ({ id: item.date, title: new Date(`${item.date}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }), body: richTextToPlainText(item.content), href: `/journals/${item.date}`, rich: false })) : kind === "success" ? successes.slice(0, 5).map((item) => ({ id: item.date, title: new Date(`${item.date}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }), body: item.content, href: "/journals", rich: true })) : notes.slice(0, 5).map((item) => ({ id: item.id, title: item.title || "未命名随记", body: richTextToPlainText(item.content), href: `/notes/${item.category}`, rich: false }));
  const config = kind === "journals" ? { title: "过往日记", href: "/journals" } : kind === "success" ? { title: "成功日记", href: "/journals" } : { title: "随记", href: "/notes" };
  return <section className="mt-3 border border-[#dce6de] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(31,67,45,0.03)]"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-[#31473a]">{config.title}</h2><Link href={config.href} className="text-sm font-medium text-[#2f6651] hover:underline">打开全部</Link></div>{records.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{records.map((record) => <Link key={record.id} href={record.href} className="border-l-2 border-[#b9d7c0] px-3 py-2 hover:bg-[#f7faf7]"><h3 className="text-sm font-medium text-[#31473a]">{record.title}</h3>{record.rich ? <RichTextContent value={record.body} className="mt-1 text-sm leading-6 text-[#65736a] [&_p]:m-0 [&_p+_p]:mt-1" /> : <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm leading-6 text-[#65736a]">{record.body || "仅包含图片或标题"}</p>}</Link>)}</div> : <p className="mt-3 text-sm text-[#718077]">这里还没有记录。</p>}</section>;
}

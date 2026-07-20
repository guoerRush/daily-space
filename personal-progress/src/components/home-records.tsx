"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatJournalDate, listJournals, todayKey, type JournalEntry } from "@/lib/journals";
import { categoryInfo, listNotes, type Note } from "@/lib/notes";
import { listDailyPlans, type StoredDayPlan } from "@/lib/plans";
import { findSuccessJournal, listSuccessJournals, saveSuccessJournal, type SuccessJournal } from "@/lib/success-journals";

type HistoryKind = "journals" | "success" | "notes";
type PlanEntry = { date: string; plan: StoredDayPlan };

function useHistory() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [successes, setSuccesses] = useState<SuccessJournal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const refresh = () => {
      setJournals(listJournals());
      setPlans(listDailyPlans());
      setSuccesses(listSuccessJournals());
      setNotes(listNotes());
    };
    refresh();
    const events = ["daily-space:journals-changed", "daily-space:plans-changed", "daily-space:success-journals-changed", "daily-space:notes-changed"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  return { journals, plans, successes, notes };
}

export function HomeRecords() {
  const { journals, plans, successes, notes } = useHistory();
  const [expanded, setExpanded] = useState<HistoryKind | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successDraft, setSuccessDraft] = useState("");
  const [successSession, setSuccessSession] = useState(0);
  const todayPlan = plans.find((entry) => entry.date === todayKey());
  const toggle = (kind: HistoryKind) => setExpanded((current) => current === kind ? null : kind);
  const openSuccessJournal = () => {
    setSuccessDraft(findSuccessJournal(todayKey())?.content ?? "");
    setSuccessSession((current) => current + 1);
    setSuccessOpen(true);
  };

  return <>
    <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
      <TodayPlanCard entry={todayPlan} />
      <Card className="shadow-sm"><CardHeader><div className="flex items-center gap-2 text-primary"><Sparkles size={18} strokeWidth={1.8} /><CardTitle>记录此刻</CardTitle></div><CardDescription>用三个动作完成今天的记录与复盘。</CardDescription></CardHeader><CardContent className="flex flex-col gap-2"><Button className="w-full" render={<Link href={`/journals/${todayKey()}`} />}>写今日日记</Button><Button className="w-full" variant="outline" render={<Link href={`/journals/${todayKey()}#reflection`} />}>写下今日反思</Button><Button className="w-full" variant="outline" onClick={openSuccessJournal}>记录今天的成功</Button></CardContent></Card>
    </section>
    <section className="mt-4"><Card className="shadow-sm"><CardHeader><CardTitle>回顾记录</CardTitle><CardDescription>需要时展开查看，不占用今天的工作空间。</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-3"><HistoryAction title="过往日记" count={journals.length} expanded={expanded === "journals"} onToggle={() => toggle("journals")} /><HistoryAction title="成功日记" count={successes.length} expanded={expanded === "success"} onToggle={() => toggle("success")} /><HistoryAction title="随记" count={notes.length} expanded={expanded === "notes"} onToggle={() => toggle("notes")} /></CardContent></Card></section>
    {expanded ? <HistoryPanel kind={expanded} journals={journals} successes={successes} notes={notes} /> : null}
    <SuccessJournalDialog key={successSession} open={successOpen} initialContent={successDraft} onOpenChange={setSuccessOpen} />
  </>;
}

function TodayPlanCard({ entry }: { entry: PlanEntry | undefined }) {
  const plan = entry?.plan;
  const tasks = plan?.tasks?.filter((task) => task.text.trim()) ?? [];
  const planned = plan?.planned?.filter((row) => row.time || row.activity) ?? [];
  const actual = plan?.actual?.filter((row) => row.time || row.activity) ?? [];
  const hasContent = tasks.length || planned.length || actual.length || plan?.remarks?.trim();
  return <Card className="shadow-sm"><CardHeader><div className="flex items-center gap-2 text-primary"><ClipboardList size={18} strokeWidth={1.8} /><CardTitle>今日安排</CardTitle></div><CardDescription>仅展示今天的待办、计划与执行情况。</CardDescription></CardHeader><CardContent>{hasContent ? <div className="flex flex-col gap-3">{tasks.length ? <div><p className="text-sm font-medium">待办事项</p><ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">{tasks.map((task) => <li key={task.id}><span className={task.done ? "text-primary" : "text-muted-foreground"}>{task.done ? "已完成" : "待完成"}</span> · {task.text}</li>)}</ul></div> : null}{planned.length ? <div><p className="text-sm font-medium">计划完成</p><div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">{planned.map((row) => <p key={row.id}>{row.time ? `${row.time} · ` : ""}{row.activity}</p>)}</div></div> : null}{actual.length ? <div><p className="text-sm font-medium">实际完成</p><div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">{actual.map((row) => <p key={row.id}>{row.time ? `${row.time} · ` : ""}{row.activity}{row.minutes ? ` · ${row.minutes} 分钟` : ""}</p>)}</div></div> : null}{plan?.remarks ? <p className="border-l-2 border-primary/35 pl-3 text-sm leading-6 text-muted-foreground">备注：{plan.remarks}</p> : null}</div> : <p className="text-sm text-muted-foreground">今天还没有安排，先把要做的事写下来。</p>}<Button className="mt-4" variant="outline" render={<Link href="/plan" />}>打开今日安排</Button></CardContent></Card>;
}

function HistoryAction({ title, count, expanded, onToggle }: { title: string; count: number; expanded: boolean; onToggle: () => void }) {
  return <Button className="h-auto min-h-16 justify-between px-3 py-3" variant="outline" onClick={onToggle} aria-expanded={expanded}><span className="text-left"><span className="block">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{count} 条</span></span>{expanded ? <ChevronUp data-icon="inline-end" /> : <ChevronDown data-icon="inline-end" />}</Button>;
}

function HistoryPanel({ kind, journals, successes, notes }: { kind: HistoryKind; journals: JournalEntry[]; successes: SuccessJournal[]; notes: Note[] }) {
  const config = kind === "journals"
    ? { title: "全部过往日记", empty: "还没有写过日记。", href: "/journals" }
    : kind === "success"
      ? { title: "全部过往成功日记", empty: "写下一件今天值得肯定的事吧。", href: undefined }
      : { title: "全部过往随记", empty: "还没有写过随记。", href: "/notes" };
  const count = kind === "journals" ? journals.length : kind === "success" ? successes.length : notes.length;

  return <section className="mt-4 border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-semibold">{config.title}</h2><p className="mt-1 text-sm text-muted-foreground">共 {count} 条，按日期从近到远完整保留。</p></div>{config.href ? <Button variant="ghost" render={<Link href={config.href} />}>打开完整页面</Button> : null}</div>
    {count ? <div className="max-h-[36rem] overflow-y-auto">{kind === "journals" ? journals.map((entry) => <JournalRow key={entry.date} entry={entry} />) : kind === "success" ? successes.map((entry) => <SuccessRow key={entry.date} entry={entry} />) : notes.map((entry) => <NoteRow key={entry.id} entry={entry} />)}</div> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">{config.empty}</p>}
  </section>;
}

function JournalRow({ entry }: { entry: JournalEntry }) {
  return <article className="border-b border-border px-5 py-5 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{formatJournalDate(entry.date)}</h3><Link href={`/journals/${entry.date}`} className="text-sm text-primary hover:underline">编辑</Link></div><p className="mt-1 text-xs text-muted-foreground">心情：{entry.mood}{entry.images?.length ? ` · ${entry.images.length} 张图片` : ""}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{entry.content || "这一天还没有写下正文。"}</p>{entry.highlights?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-primary">{entry.highlights.map((item) => <li key={item}>{item}</li>)}</ul> : null}</article>;
}

function SuccessRow({ entry }: { entry: SuccessJournal }) {
  return <article className="border-b border-border px-5 py-5 last:border-0"><h3 className="font-medium">{formatJournalDate(entry.date)}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{entry.content}</p></article>;
}

function NoteRow({ entry }: { entry: Note }) {
  return <article className="border-b border-border px-5 py-5 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">{entry.title || "未命名随记"}</h3><p className="mt-1 text-xs text-muted-foreground">{categoryInfo[entry.category].label} · {new Date(entry.updatedAt).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}{entry.images.length ? ` · ${entry.images.length} 张图片` : ""}</p></div><Link href={`/notes/${entry.category}`} className="text-sm text-primary hover:underline">打开随记</Link></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{entry.content}</p></article>;
}

function SuccessJournalDialog({ open, initialContent, onOpenChange }: { open: boolean; initialContent: string; onOpenChange: (open: boolean) => void }) {
  const date = todayKey();
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || !content.trim()) return;
    const timer = window.setTimeout(() => { saveSuccessJournal({ date, content: content.trim() }); setStatus("已自动保存"); }, 3000);
    return () => window.clearTimeout(timer);
  }, [content, date, open]);

  const save = () => {
    if (!content.trim()) { setStatus("请先写下一件值得肯定的事。"); return; }
    saveSuccessJournal({ date, content: content.trim() });
    setStatus("已保存到成功日记");
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>今天的成功日记</DialogTitle><DialogDescription>把成果、坚持、突破或微小的进步留下来。每 3 秒自动保存一次。</DialogDescription></DialogHeader><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="例如：我按计划完成了学习，并在疲惫时仍然认真写下了复盘。" className="min-h-40 leading-7" />{status ? <p className="text-sm text-primary">{status}</p> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button><Button onClick={save}><CheckCircle2 data-icon="inline-start" />保存成功日记</Button></DialogFooter></DialogContent></Dialog>;
}

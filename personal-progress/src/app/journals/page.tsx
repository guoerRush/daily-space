"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { BookOpen, Image as ImageIcon, Plus, Search } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { formatJournalDate, listJournals, todayKey, type JournalEntry } from "@/lib/journals";

const emptyEntries: JournalEntry[] = [];
function subscribe(callback: () => void) { window.addEventListener("daily-space:journals-changed", callback); return () => window.removeEventListener("daily-space:journals-changed", callback); }

export default function JournalsPage() {
  const entries = useSyncExternalStore(subscribe, listJournals, () => emptyEntries);
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("全部心情");
  const moods = ["全部心情", ...Array.from(new Set(entries.map((entry) => entry.mood)))];
  const filtered = useMemo(() => entries.filter((entry) => (mood === "全部心情" || entry.mood === mood) && (`${entry.content} ${entry.date} ${entry.mood}`.toLowerCase().includes(query.trim().toLowerCase()))), [entries, mood, query]);
  return <AppFrame><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#65736a]">你的全部记录</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">全部日记</h1></div><Link href={`/journals/${todayKey()}`} className="flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"><Plus size={17} />写今日日记</Link></div><div className="mt-7 border border-[#dfe5df] bg-white"><div className="flex flex-col gap-3 border-b border-[#e6ebe6] px-5 py-4 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-2 border border-[#d7ded7] px-3 py-2 text-[#718077]"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日记内容、日期或心情" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={mood} onChange={(event) => setMood(event.target.value)} className="border border-[#d7ded7] bg-white px-3 py-2 text-sm text-[#526158] outline-none">{moods.map((item) => <option key={item}>{item}</option>)}</select></div><div className="border-b border-[#eef1ee] px-5 py-3 text-sm text-[#65736a]">显示 {filtered.length} / {entries.length} 篇记录</div>{filtered.length ? <div>{filtered.map((entry) => <Link key={entry.date} href={`/journals/${entry.date}`} className="block border-b border-[#eef1ee] px-5 py-5 last:border-0 hover:bg-[#f7faf7]"><div className="flex items-center justify-between gap-4"><div><p className="font-medium">{formatJournalDate(entry.date)}</p><p className="mt-1 text-xs text-[#6c7a71]">心情：{entry.mood} · 更新于 {new Date(entry.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p></div><span className="text-sm text-[#2f6651]">打开</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#526158]">{entry.content || "这一天还没有写下正文。"}</p>{entry.images?.length ? <p className="mt-3 flex items-center gap-1 text-xs text-[#718077]"><ImageIcon size={14} />{entry.images.length} 张图片</p> : null}</Link>)}</div> : <div className="grid min-h-72 place-items-center px-6 text-center"><div><BookOpen size={30} className="mx-auto text-[#8aa493]" /><p className="mt-4 font-medium">没有匹配的日记</p><p className="mt-2 text-sm text-[#718077]">调整搜索关键词或心情筛选，也可以新写一篇记录。</p><Link href={`/journals/${todayKey()}`} className="mt-5 inline-block text-sm font-medium text-[#2f6651]">去写今日日记</Link></div></div>}</div></div></AppFrame>;
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, Check, History, ImagePlus, Sparkles, X } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { findJournal, formatJournalDate, saveJournal } from "@/lib/journals";
import { extractHighlights } from "@/lib/reflection";

function ClientOnly({ children }: { children: ReactNode }) { const ready = useSyncExternalStore(() => () => {}, () => true, () => false); return ready ? <>{children}</> : null; }
export default function JournalDetailPage() { const params = useParams<{ date: string }>(); return <AppFrame><ClientOnly><JournalEditor date={params.date} /></ClientOnly></AppFrame>; }

function JournalEditor({ date }: { date: string }) {
  const entry = findJournal(date);
  const [content, setContent] = useState(entry?.content ?? "");
  const [mood, setMood] = useState(entry?.mood ?? "平静");
  const [images, setImages] = useState(entry?.images ?? []);
  const [highlights, setHighlights] = useState(entry?.highlights ?? []);
  const [saved, setSaved] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [highlightStatus, setHighlightStatus] = useState("");
  const draftRef = useRef({ content, mood, images, highlights });
  const dirtyRef = useRef(false);
  const templates = [{ label: "日常回顾", text: "今天发生了什么：\n\n让我感到满足的一件事：\n\n明天想继续保持的事：" }, { label: "三件好事", text: "今天的三件好事：\n1. \n2. \n3. \n\n我从中感受到：" }, { label: "问题与下一步", text: "今天遇到的问题：\n\n原因或收获：\n\n下一步可以做：" }];
  useEffect(() => { draftRef.current = { content, mood, images, highlights }; }, [content, mood, images, highlights]);
  useEffect(() => {
    const persist = () => { if (!dirtyRef.current) return; saveJournal({ date, ...draftRef.current }); dirtyRef.current = false; setSaved(true); setAutoSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })); };
    const timer = window.setInterval(persist, 3_000);
    window.addEventListener("pagehide", persist);
    return () => { window.clearInterval(timer); window.removeEventListener("pagehide", persist); persist(); };
  }, [date]);
  const markDirty = () => { dirtyRef.current = true; setSaved(false); };
  const save = () => { dirtyRef.current = true; saveJournal({ date, ...draftRef.current }); dirtyRef.current = false; setSaved(true); setAutoSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })); };
  const insertTemplate = (template: string) => { setContent((current) => `${current}${current ? "\n\n" : ""}${template}`); markDirty(); };
  const addImages = (files: FileList | null) => { if (!files) return; Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then((items) => { setImages((current) => [...current, ...items]); markDirty(); }); };
  const createHighlights = () => {
    const next = extractHighlights(content);
    setHighlights(next);
    saveJournal({ date, content, mood, images, highlights: next });
    dirtyRef.current = false;
    setSaved(true);
    setAutoSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setHighlightStatus(next.length ? `已提炼 ${next.length} 条精华点，并保存到日记。` : "当前内容较短，暂时没有可提炼的完整要点。再补充一两句话后重试。");
  };
  return <div className="mx-auto max-w-3xl"><Link href="/journals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} />返回全部日记</Link><div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{formatJournalDate(date)}</p><h1 className="mt-1 text-2xl font-semibold">日记记录</h1></div><div className="flex flex-wrap items-center gap-2"><Link href={`/plan?date=${date}`} className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary"><CalendarDays size={16} />查看当日安排</Link><button onClick={save} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">{saved ? <Check size={16} /> : null}{saved ? "已保存" : "保存日记"}</button></div></div><section className="mt-7 rounded-xl border border-border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">快速模板</p><div className="flex flex-wrap gap-2">{templates.map((template) => <button key={template.label} onClick={() => insertTemplate(template.text)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">{template.label}</button>)}</div></div><p className="mt-6 text-sm font-medium text-muted-foreground">此刻的心情</p><div className="mt-3 flex flex-wrap gap-2">{["平静", "充实", "开心", "有点疲惫", "焦虑"].map((item) => <button onClick={() => { setMood(item); markDirty(); }} key={item} className={`rounded-md border px-3 py-1.5 text-sm ${mood === item ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground"}`}>{item}</button>)}</div><textarea value={content} onChange={(event) => { setContent(event.target.value); markDirty(); }} placeholder="今天发生了什么？哪些瞬间值得留下？" className="mt-6 min-h-80 w-full resize-y border-0 border-t border-border bg-transparent pt-5 text-[15px] leading-7 outline-none placeholder:text-muted-foreground" /><div className="mt-5 border-t border-border pt-5"><input id="journal-images" type="file" accept="image/*" multiple onChange={(event) => addImages(event.target.files)} className="sr-only" /><label htmlFor="journal-images" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><ImagePlus size={16} />添加图片</label>{images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((image, index) => <div key={image} className="relative aspect-square overflow-hidden rounded-lg border border-border"><Image src={image} alt={`日记图片 ${index + 1}`} fill unoptimized className="object-cover" /><button onClick={() => { setImages((current) => current.filter((_, itemIndex) => itemIndex !== index)); markDirty(); }} aria-label="移除图片" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white"><X size={14} /></button></div>)}</div> : null}</div><div id="reflection" className="mt-6 border-t border-border pt-5"><div className="flex items-center gap-2 text-primary"><Sparkles size={17} /><p className="font-medium">今日反思</p></div><p className="mt-3 text-sm leading-6 text-muted-foreground">今天做过的事里，哪一件最接近你想成为的人？</p><button onClick={() => insertTemplate("今日反思：\n")} className="mt-3 text-sm font-medium text-primary">将问题写入日记</button></div><div className="mt-6 border-t border-border pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-primary">精华点整理</p><p className="mt-1 text-sm text-muted-foreground">从当日日记中提取方便复习的重点。</p></div><button onClick={createHighlights} disabled={!content.trim()} className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50">提炼精华点</button></div>{highlightStatus ? <p className="mt-3 text-sm text-primary">{highlightStatus}</p> : null}{highlights.length ? <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">{highlights.map((item) => <li key={item}>{item}</li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">写完日记后，点击“提炼精华点”生成复习要点。</p>}</div></section><p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><History size={14} />{autoSavedAt ? `已于 ${autoSavedAt} 自动保存` : "每 3 秒自动保存一次"}</p></div>;
}

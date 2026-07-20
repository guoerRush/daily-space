"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categoryInfo, deleteNote, listNotes, saveNote, type Note, type NoteCategory } from "@/lib/notes";

function ClientOnly({ children }: { children: ReactNode }) { const ready = useSyncExternalStore(() => () => {}, () => true, () => false); return ready ? <>{children}</> : null; }
function isCategory(value: string): value is NoteCategory { return value === "ai" || value === "work" || value === "life"; }
function timeLabel() { return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

export default function NoteCategoryPage() { const params = useParams<{ category: string }>(); if (!isCategory(params.category)) return <AppFrame><p className="text-sm text-muted-foreground">该随记分类不存在。</p><Button variant="link" render={<Link href="/notes" />}>返回随记</Button></AppFrame>; return <AppFrame><ClientOnly><NotesEditor category={params.category} /></ClientOnly></AppFrame>; }

function NotesEditor({ category }: { category: NoteCategory }) {
  const [notes, setNotes] = useState<Note[]>(() => listNotes(category));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<number>();
  const [message, setMessage] = useState("");
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const info = categoryInfo[category];
  const draftRef = useRef({ title, content, images, draftId });
  const lastSavedRef = useRef("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleNotes = normalizedQuery ? notes.filter((note) => `${note.title}\n${note.content}`.toLocaleLowerCase().includes(normalizedQuery)) : notes;

  useEffect(() => { draftRef.current = { title, content, images, draftId }; }, [title, content, images, draftId]);
  useEffect(() => {
    const persist = () => {
      const draft = draftRef.current;
      if (!draft.title.trim() && !draft.content.trim() && !draft.images.length) return;
      const signature = JSON.stringify({ title: draft.title, content: draft.content, images: draft.images });
      if (signature === lastSavedRef.current) return;
      const saved = saveNote({ id: draft.draftId, category, title: draft.title.trim() || "未命名随记", content: draft.content.trim(), images: draft.images });
      lastSavedRef.current = signature;
      setDraftId(saved.id);
      setNotes(listNotes(category));
      setAutoSavedAt(timeLabel());
    };
    const timer = window.setInterval(persist, 3_000);
    window.addEventListener("pagehide", persist);
    return () => { window.clearInterval(timer); window.removeEventListener("pagehide", persist); persist(); };
  }, [category]);

  const addImages = (files: FileList | null) => { if (!files) return; Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then((items) => setImages((current) => [...current, ...items])); };
  const save = () => { if (!title.trim() && !content.trim() && !images.length) { setMessage("请至少写下标题、内容或添加一张图片。"); return; } saveNote({ id: draftId, category, title: title.trim() || "未命名随记", content: content.trim(), images }); setNotes(listNotes(category)); setTitle(""); setContent(""); setImages([]); setDraftId(undefined); lastSavedRef.current = ""; setMessage("随记已保存。"); };
  const confirmDelete = () => { if (!pendingDelete) return; deleteNote(pendingDelete.id); setNotes(listNotes(category)); setPendingDelete(null); setMessage("随记已删除。"); };

  return <div className="mx-auto max-w-4xl"><Button variant="ghost" size="sm" render={<Link href="/notes" />}><ArrowLeft data-icon="inline-start" />返回随记</Button><div className="mt-5"><p className="text-sm text-muted-foreground">{info.description}</p><h1 className="mt-1 text-3xl font-semibold">{info.label}</h1></div><Card className="mt-7 shadow-sm"><CardHeader><div className="flex items-center gap-2 text-primary"><Plus size={18} strokeWidth={1.8} /><CardTitle>添加信息</CardTitle></div><CardDescription>留下一条灵感、方法、链接或生活经验。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题，例如：一条好用的提示词" /><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录内容、链接、步骤或自己的想法…" className="min-h-40" /><div className="flex flex-wrap items-center gap-3"><Input id="note-images" type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addImages(event.target.files)} /><Button variant="outline" render={<label htmlFor="note-images" />}><ImagePlus data-icon="inline-start" />添加图片</Button><Button onClick={save}><Plus data-icon="inline-start" />保存随记</Button>{message ? <Badge variant="secondary">{message}</Badge> : null}{autoSavedAt ? <Badge variant="outline">已于 {autoSavedAt} 自动保存</Badge> : null}</div>{images.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((image, index) => <div key={image} className="relative aspect-square overflow-hidden rounded-lg border border-border"><Image src={image} alt={`随记图片 ${index + 1}`} fill unoptimized className="object-cover" /><Button variant="secondary" size="icon-xs" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="移除图片" className="absolute right-2 top-2"><X /></Button></div>)}</div> : null}</CardContent></Card><section className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">已保存内容</h2><p className="mt-1 text-sm text-muted-foreground">{notes.length} 条随记</p></div><div className="relative w-full sm:w-72"><Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或内容" className="pl-9 pr-9" />{query ? <Button variant="ghost" size="icon-xs" onClick={() => setQuery("")} aria-label="清空搜索" className="absolute right-1 top-1/2 -translate-y-1/2"><X /></Button> : null}</div></div><div className="mt-4 flex flex-col gap-3">{visibleNotes.length ? visibleNotes.map((note) => <Card key={note.id} size="sm" className="shadow-sm"><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{note.title}</CardTitle><CardDescription className="mt-1">{new Date(note.updatedAt).toLocaleDateString("zh-CN")}{note.images.length ? ` · ${note.images.length} 张图片` : ""}</CardDescription></div><Button variant="ghost" size="icon-sm" onClick={() => setPendingDelete(note)} aria-label={`删除${note.title}`}><Trash2 /></Button></div></CardHeader>{note.content || note.images.length ? <CardContent>{note.content ? <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{note.content}</p> : null}{note.images.length ? <div className="mt-4 grid grid-cols-3 gap-2">{note.images.map((image, index) => <div key={image} className="relative aspect-square overflow-hidden rounded-md"><Image src={image} alt={`${note.title} 图片 ${index + 1}`} fill unoptimized className="object-cover" /></div>)}</div> : null}</CardContent> : null}</Card>) : <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">{normalizedQuery ? "没有找到匹配的随记。" : "这个分类还没有内容。"}</CardContent></Card>}</div></section><AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这条随记？</AlertDialogTitle><AlertDialogDescription>“{pendingDelete?.title}”及其图片会从本机浏览器中移除，无法恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmDelete}>删除随记</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}

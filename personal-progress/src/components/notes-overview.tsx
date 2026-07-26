"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, BriefcaseBusiness, FolderPlus, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listNoteCategories, saveNoteCategory, type NoteCategoryInfo } from "@/lib/notes";

const builtInIcons = { ai: Bot, work: BriefcaseBusiness, life: Lightbulb };

export function NotesOverview() {
  const [categories, setCategories] = useState<NoteCategoryInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => setCategories(listNoteCategories());
    refresh();
    window.addEventListener("daily-space:note-categories-changed", refresh);
    return () => window.removeEventListener("daily-space:note-categories-changed", refresh);
  }, []);

  const addCategory = () => {
    try {
      saveNoteCategory({ label, description });
      setLabel("");
      setDescription("");
      setError("");
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法添加分类");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#65736a]">收集值得保留的零散信息</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">闲思札记</h1>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          添加模块
        </Button>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {categories.map((category) => {
          const Icon = builtInIcons[category.id as keyof typeof builtInIcons] ?? FolderPlus;
          return (
            <Link key={category.id} href={`/notes/${category.id}`} className="group border border-[#dfe5df] bg-white p-6 transition-colors hover:border-[#a9c5b6] hover:bg-[#f8fbf8]">
              <Icon size={22} className="text-[#2f6651]" />
              <h2 className="mt-8 text-lg font-semibold">{category.label}</h2>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[#65736a]">{category.description}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2f6651]">进入分类 <ArrowRight size={16} /></span>
            </Link>
          );
        })}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加札记模块</DialogTitle>
            <DialogDescription>例如学习、阅读、旅行或灵感。创建后可点击进入并添加文字和图片。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-medium">模块名称<Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：学习" autoFocus /></label>
            <label className="grid gap-2 text-sm font-medium">说明（可选）<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：课程、读书笔记与问题" /></label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={addCategory}>添加模块</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

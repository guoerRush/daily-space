"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Image as ImageIcon,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  RichTextContent,
  richTextToPlainText,
} from "@/components/rich-text-editor";
import {
  deleteJournal,
  formatJournalDate,
  listJournals,
  todayKey,
  type JournalEntry,
} from "@/lib/journals";
import {
  findSuccessJournal,
  listSuccessJournals,
  saveSuccessJournal,
  type SuccessJournal,
} from "@/lib/success-journals";

const emptyEntries: JournalEntry[] = [];

function subscribe(callback: () => void) {
  window.addEventListener("daily-space:journals-changed", callback);
  return () =>
    window.removeEventListener("daily-space:journals-changed", callback);
}

const emptySuccessEntries: SuccessJournal[] = [];

function subscribeSuccessJournals(callback: () => void) {
  window.addEventListener("daily-space:success-journals-changed", callback);
  return () =>
    window.removeEventListener("daily-space:success-journals-changed", callback);
}

function SuccessJournalPanel() {
  const entries = useSyncExternalStore(
    subscribeSuccessJournals,
    listSuccessJournals,
    () => emptySuccessEntries,
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [draft, setDraft] = useState(
    () => findSuccessJournal(todayKey())?.content ?? "",
  );
  const [message, setMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setDraft(findSuccessJournal(date)?.content ?? "");
    setMessage("");
  };

  const save = () => {
    const content = draft.trim();
    if (!content) {
      setMessage("请先写下一件值得肯定的事，再保存。");
      return;
    }
    saveSuccessJournal({ date: selectedDate, content });
    setMessage("成功日记已保存。");
  };

  return (
    <Card className="mt-6 border-primary/20 bg-[linear-gradient(120deg,hsl(var(--card)),hsl(var(--accent)/0.42))] shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CircleCheckBig className="size-5 text-primary" />
          成功日记
        </CardTitle>
        <CardDescription>
          记录今天完成、突破或值得为自己肯定的一件事。它与认知复盘分别保存。
        </CardDescription>
        <CardAction>
          <label className="flex items-center gap-2 rounded-lg border border-input/80 bg-background/75 px-2.5 py-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="sr-only">成功日记日期</span>
            <input
              aria-label="成功日记日期"
              type="date"
              value={selectedDate}
              max={todayKey()}
              onChange={(event) => selectDate(event.target.value)}
              className="bg-transparent text-foreground outline-none"
            />
          </label>
        </CardAction>
      </CardHeader>
      <CardContent>
        <label htmlFor="success-journal-content" className="mb-2 block text-sm font-medium">
          {formatJournalDate(selectedDate)}的成功记录
        </label>
        <Textarea
          id="success-journal-content"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="例如：我完成了原本犹豫很久的任务，也认真照顾了自己的状态。"
          className="min-h-28 resize-y bg-background/80 leading-6"
        />
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3 bg-background/35">
        <div>
          {message ? <p role="status" className="text-sm text-primary">{message}</p> : null}
          {entries.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
            >
              {historyOpen ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
              过往成功日记（{entries.length}）
            </Button>
          ) : null}
        </div>
        <Button onClick={save}>保存成功日记</Button>
      </CardFooter>
      {historyOpen ? (
        <div className="border-t border-border/70 px-4 pb-4">
          <div className="max-h-56 divide-y divide-border/60 overflow-y-auto">
            {entries.map((entry) => (
              <button
                key={entry.date}
                type="button"
                onClick={() => selectDate(entry.date)}
                className="w-full px-1 py-3 text-left transition-colors hover:bg-muted/55"
              >
                <span className="font-medium text-foreground">{formatJournalDate(entry.date)}</span>
                <span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">{entry.content}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default function JournalsPage() {
  const entries = useSyncExternalStore(
    subscribe,
    listJournals,
    () => emptyEntries,
  );
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("全部心情");
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set(),
  );
  const moods = [
    "全部心情",
    ...Array.from(new Set(entries.map((entry) => entry.mood))),
  ];
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (mood === "全部心情" || entry.mood === mood) &&
          `${entry.content} ${entry.date} ${entry.mood}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [entries, mood, query],
  );
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteJournal(pendingDelete.date);
    setPendingDelete(null);
  };
  const toggleExpanded = (date: string) =>
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <AppFrame>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">你的全部记录</p>
            <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
              全部日记
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-primary">
              <Sparkles />
              在日记编辑页顶部可选择“触动点日记”或“结构化复盘”。
            </p>
          </div>
          <Button render={<Link href={`/journals/${todayKey()}`} />}>
            <Plus data-icon="inline-start" />
            写今日认知复盘
          </Button>
        </div>
        <SuccessJournalPanel />
        <section className="mt-7 border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 border border-input px-3 py-2 text-muted-foreground">
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索日记内容、日期或心情"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={mood}
              onChange={(event) => setMood(event.target.value)}
              className="border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {moods.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
            显示 {filtered.length} / {entries.length} 篇记录
          </div>
          {filtered.length ? (
            <div>
              {filtered.map((entry) => {
                const expanded = expandedDates.has(entry.date);
                const plainContent = richTextToPlainText(entry.content);
                const canExpand =
                  plainContent.length > 96 || Boolean(entry.highlights?.length);
                return (
                  <article
                    key={entry.date}
                    className="border-b border-border px-5 py-5 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/journals/${entry.date}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {formatJournalDate(entry.date)}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          心情：{entry.mood} · 更新于{" "}
                          {new Date(entry.updatedAt).toLocaleTimeString(
                            "zh-CN",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                        {expanded ? (
                          <RichTextContent
                            value={entry.content}
                            emptyText="这一天还没有写下正文。"
                            className="mt-3 text-sm leading-6 text-muted-foreground"
                          />
                        ) : (
                          <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {plainContent || "这一天还没有写下正文。"}
                          </p>
                        )}
                        {expanded && entry.highlights?.length ? (
                          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-primary">
                            {entry.highlights.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                        {entry.images?.length ? (
                          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                            <ImageIcon />
                            {entry.images.length} 张图片
                          </p>
                        ) : null}
                        {canExpand ? (
                          <Button
                            className="mt-3"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(entry.date)}
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronUp data-icon="inline-start" />
                            ) : (
                              <ChevronDown data-icon="inline-start" />
                            )}
                            {expanded ? "收起全文" : "展开全文"}
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(entry)}
                        aria-label={`删除${formatJournalDate(entry.date)}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center px-6 text-center">
              <div>
                <BookOpen className="mx-auto text-muted-foreground" />
                <p className="mt-4 font-medium">没有匹配的日记</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  调整搜索或筛选，也可以新写一篇记录。
                </p>
                <Button
                  className="mt-5"
                  variant="outline"
                  render={<Link href={`/journals/${todayKey()}`} />}
                >
                  去写今日日记
                </Button>
              </div>
            </div>
          )}
        </section>
        <AlertDialog
          open={Boolean(pendingDelete)}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除这篇日记？</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete
                  ? formatJournalDate(pendingDelete.date)
                  : "这篇日记"}
                的正文、图片、心情和精华点将被永久删除，无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={confirmDelete}>
                删除日记
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppFrame>
  );
}

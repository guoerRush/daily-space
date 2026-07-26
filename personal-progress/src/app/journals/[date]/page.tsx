"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  History,
  ImagePlus,
  Link as LinkIcon,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import {
  RichTextEditor,
  plainTextToRichHtml,
  richTextToPlainText,
} from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  findJournal,
  formatJournalDate,
  listJournals,
  saveJournal,
  type JournalEntry,
} from "@/lib/journals";
import { getSupabaseClient } from "@/lib/supabase";
import { upsertDiaryRemote } from "@/lib/diary-supabase";
import { extractHighlights } from "@/lib/reflection";

type Template = NonNullable<JournalEntry["template"]>;
type MetaCognition = NonNullable<JournalEntry["metaCognition"]>;
type JournalDraft = Omit<JournalEntry, "updatedAt">;
type SearchResult = {
  id: string;
  date: string;
  title?: string | null;
  content: string;
};

const defaultMeta: MetaCognition = {
  isObjective: false,
  isAvoidingCoreIssue: false,
  isConfidentInAction: false,
};

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : null;
}

export default function JournalDetailPage() {
  const params = useParams<{ date: string }>();
  const searchParams = useSearchParams();
  return (
    <AppFrame>
      <ClientOnly>
        <JournalEditor
          date={params.date}
          planSummary={searchParams.get("planSummary") ?? ""}
        />
      </ClientOnly>
    </AppFrame>
  );
}

function JournalEditor({
  date,
  planSummary,
}: {
  date: string;
  planSummary: string;
}) {
  const entry = findJournal(date);
  const [content, setContent] = useState(
    entry?.content ??
      (planSummary
        ? plainTextToRichHtml(`今日计划素材：\n${planSummary}\n\n我的复盘：\n`)
        : ""),
  );
  const [mood, setMood] = useState(entry?.mood ?? "平静");
  const [images, setImages] = useState(entry?.images ?? []);
  const [highlights, setHighlights] = useState(entry?.highlights ?? []);
  const [template, setTemplate] = useState<Template>(entry?.template ?? "free");
  const [touchEvent, setTouchEvent] = useState(entry?.touchEvent ?? "");
  const [touchWhy, setTouchWhy] = useState(entry?.touchWhy ?? "");
  const [touchAction, setTouchAction] = useState(entry?.touchAction ?? "");
  const [reviewDesc, setReviewDesc] = useState(entry?.reviewDesc ?? "");
  const [reviewAnalysis, setReviewAnalysis] = useState(
    entry?.reviewAnalysis ?? "",
  );
  const [reviewAction, setReviewAction] = useState(entry?.reviewAction ?? "");
  const [linkedDiaryIds, setLinkedDiaryIds] = useState(
    entry?.linkedDiaryIds ?? [],
  );
  const [linkedDiaryDates, setLinkedDiaryDates] = useState(
    entry?.linkedDiaryDates ?? {},
  );
  const [metaCognition, setMetaCognition] = useState<MetaCognition>({
    ...defaultMeta,
    ...entry?.metaCognition,
  });
  const [saved, setSaved] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [highlightStatus, setHighlightStatus] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<SearchResult[]>([]);
  const [linkSelection, setLinkSelection] = useState<string[]>(linkedDiaryIds);
  const [linkSearching, setLinkSearching] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    first: true,
    second: true,
    third: true,
    meta: true,
  });
  const draftRef = useRef<JournalDraft>({
    date,
    content,
    mood,
    images,
    highlights,
    template,
    touchEvent,
    touchWhy,
    touchAction,
    reviewDesc,
    reviewAnalysis,
    reviewAction,
    linkedDiaryIds,
    linkedDiaryDates,
    metaCognition,
  });
  const dirtyRef = useRef(false);

  useEffect(() => {
    draftRef.current = {
      date,
      content,
      mood,
      images,
      highlights,
      template,
      touchEvent,
      touchWhy,
      touchAction,
      reviewDesc,
      reviewAnalysis,
      reviewAction,
      linkedDiaryIds,
      linkedDiaryDates,
      metaCognition,
    };
  }, [
    date,
    content,
    mood,
    images,
    highlights,
    template,
    touchEvent,
    touchWhy,
    touchAction,
    reviewDesc,
    reviewAnalysis,
    reviewAction,
    linkedDiaryIds,
    linkedDiaryDates,
    metaCognition,
  ]);

  useEffect(() => {
    const persist = () => {
      if (!dirtyRef.current) return;
      saveJournal(draftRef.current);
      void upsertDiaryRemote(draftRef.current);
      dirtyRef.current = false;
      setSaved(true);
      setAutoSavedAt(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    const timer = window.setInterval(persist, 3_000);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [date]);

  const markDirty = () => {
    dirtyRef.current = true;
    setSaved(false);
  };
  const save = () => {
    saveJournal(draftRef.current);
    void upsertDiaryRemote(draftRef.current);
    dirtyRef.current = false;
    setSaved(true);
    setAutoSavedAt(
      new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  };
  const insertTemplate = (text: string) => {
    setContent(
      (current) =>
        `${current.trim() ? plainTextToRichHtml(current) : ""}${plainTextToRichHtml(text)}`,
    );
    markDirty();
  };
  const addImages = (files: FileList | null) => {
    if (!files) return;
    Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.readAsDataURL(file);
            }),
        ),
    ).then((items) => {
      setImages((current) => [...current, ...items]);
      markDirty();
    });
  };
  const createHighlights = () => {
    const next = extractHighlights(richTextToPlainText(content));
    setHighlights(next);
    draftRef.current = { ...draftRef.current, highlights: next };
    saveJournal({ ...draftRef.current, highlights: next });
    void upsertDiaryRemote({ ...draftRef.current, highlights: next });
    dirtyRef.current = false;
    setSaved(true);
    setHighlightStatus(
      next.length
        ? `已提炼 ${next.length} 条精华点，并保存到日记。`
        : "当前内容较短，补充几句后再试试。",
    );
  };

  useEffect(() => {
    let cancelled = false;
    const query = linkQuery.trim();
    const localSearch = () =>
      listJournals()
        .filter(
          (item) =>
            item.date !== date &&
            `${item.date} ${item.content}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, 20)
        .map((item) => ({
          id: item.date,
          date: item.date,
          content: item.content,
        }));
    if (!query) {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setLinkResults(localSearch());
          setLinkSearching(false);
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    const timer = window.setTimeout(async () => {
      setLinkSearching(true);
      const client = getSupabaseClient();
      if (client) {
        const safe = query.replace(/[%,()]/g, (value) => `\\${value}`);
        const { data } = await client
          .from("diaries")
          .select("id,date,title,content")
          .or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
          .order("date", { ascending: false })
          .limit(20);
        if (!cancelled && data?.length) setLinkResults(data as SearchResult[]);
        else if (!cancelled) setLinkResults(localSearch());
      } else if (!cancelled) setLinkResults(localSearch());
      if (!cancelled) setLinkSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [linkQuery, date]);

  const toggleLinked = (id: string, checked: boolean) =>
    setLinkSelection((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  const confirmLinks = () => {
    const nextLinkedDiaryDates = { ...linkedDiaryDates };
    linkResults.forEach((item) => {
      if (linkSelection.includes(item.id)) {
        nextLinkedDiaryDates[item.id] = item.date;
      }
    });
    setLinkedDiaryIds(linkSelection);
    setLinkedDiaryDates(nextLinkedDiaryDates);
    draftRef.current = {
      ...draftRef.current,
      linkedDiaryIds: linkSelection,
      linkedDiaryDates: nextLinkedDiaryDates,
    };
    markDirty();
    setLinkDialogOpen(false);
  };
  const openLinkDialog = () => {
    setLinkSelection(linkedDiaryIds);
    setLinkQuery("");
    setLinkDialogOpen(true);
  };
  const updateMeta = (key: keyof MetaCognition, value: boolean) => {
    setMetaCognition((current) => ({ ...current, [key]: value }));
    markDirty();
  };
  const templates = [
    {
      label: "日常回顾",
      text: "今天发生了什么：\n\n让我感到满足的一件事：\n\n明天想继续保持的事：",
    },
    {
      label: "三件好事",
      text: "今天的三件好事：\n1. \n2. \n3. \n\n我从中感受到：",
    },
    {
      label: "问题与下一步",
      text: "今天遇到的问题：\n\n原因或收获：\n\n下一步可以做：",
    },
  ];
  const structuredFields =
    template === "touch"
      ? [
          {
            key: "first",
            label: "触动事件",
            value: touchEvent,
            set: setTouchEvent,
            placeholder: "发生了什么？一句话描述",
          },
          {
            key: "second",
            label: "触动原因",
            value: touchWhy,
            set: setTouchWhy,
            placeholder: "为什么触动你？",
          },
          {
            key: "third",
            label: "下一步行动",
            value: touchAction,
            set: setTouchAction,
            placeholder: "你可以有的下一步行动",
          },
        ]
      : [
          {
            key: "first",
            label: "描述经过",
            value: reviewDesc,
            set: setReviewDesc,
            placeholder: "这件事是怎样发生的？",
          },
          {
            key: "second",
            label: "分析原因",
            value: reviewAnalysis,
            set: setReviewAnalysis,
            placeholder: "背后的原因、规律或盲点是什么？",
          },
          {
            key: "third",
            label: "改进措施",
            value: reviewAction,
            set: setReviewAction,
            placeholder: "下一次准备怎样做？",
          },
        ];

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <Link
        href="/journals"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft />
        返回全部日记
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatJournalDate(date)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">日记记录</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/plan?date=${date}`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary"
          >
            <CalendarDays />
            查看当日安排
          </Link>
          <Button onClick={save}>
            <Check className={saved ? "" : "hidden"} />
            {saved ? "已保存" : "保存日记"}
          </Button>
        </div>
      </div>

      <section className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="templateSelect"
            className="text-sm font-medium text-muted-foreground"
          >
            日记模板
          </label>
          <Select
            value={template}
            onValueChange={(value) => {
              setTemplate((value ?? "free") as Template);
              markDirty();
            }}
          >
            <SelectTrigger id="templateSelect" aria-label="选择日记模板">
              <SelectValue placeholder="选择模板" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="free">自由书写</SelectItem>
                <SelectItem value="touch">触动点日记</SelectItem>
                <SelectItem value="review">结构化复盘</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {template !== "free" ? (
          <div className="mt-5 flex flex-col gap-3">
            {structuredFields.map((field) => (
              <Collapsible
                key={field.key}
                open={sectionsOpen[field.key as keyof typeof sectionsOpen]}
                onOpenChange={(open) =>
                  setSectionsOpen((current) => ({
                    ...current,
                    [field.key]: open,
                  }))
                }
              >
                <div className="rounded-lg border border-border/70 bg-secondary/35 p-3">
                  <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-sm font-medium">
                    <span>{field.label}</span>
                    <ChevronDown className="transition-transform data-panel-open:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <Textarea
                      value={field.value}
                      onChange={(event) => {
                        field.set(event.target.value);
                        markDirty();
                      }}
                      placeholder={field.placeholder}
                      rows={3}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">快速模板</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                onClick={() => insertTemplate(item.text)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          此刻的心情
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["平静", "充实", "开心", "有点疲惫", "焦虑"].map((item) => (
            <Button
              key={item}
              variant={mood === item ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setMood(item);
                markDirty();
              }}
            >
              {item}
            </Button>
          ))}
        </div>

        <RichTextEditor
          value={content}
          onChange={(next) => {
            setContent(next);
            markDirty();
          }}
          placeholder="今天发生了什么？哪些瞬间值得留下？"
          className="mt-6"
          minHeightClassName="min-h-80"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openLinkDialog}>
            <LinkIcon data-icon="inline-start" />
            关联旧记录
          </Button>
          {linkedDiaryIds.map((id) => (
            <Badge key={id} variant="secondary">
              <Link
                href={`/journals/${linkedDiaryDates[id] ?? id}`}
                className="max-w-40 truncate"
              >
                {linkedDiaryDates[id] ?? id}
              </Link>
            </Badge>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <input
            id="journal-images"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => addImages(event.target.files)}
            className="sr-only"
          />
          <label
            htmlFor="journal-images"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <ImagePlus />
            添加图片
          </label>
          {images.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={image}
                    alt={`日记图片 ${index + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <button
                    onClick={() => {
                      setImages((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      );
                      markDirty();
                    }}
                    aria-label="移除图片"
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/55 text-white"
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div id="reflection" className="mt-6 border-t border-border pt-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles />
            <p className="font-medium">今日反思</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            今天做过的事里，哪一件最接近你想成为的人？
          </p>
          <Button
            variant="link"
            className="mt-1 px-0"
            onClick={() => insertTemplate("今日反思：\n")}
          >
            将问题写入日记
          </Button>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-primary">精华点整理</p>
              <p className="mt-1 text-sm text-muted-foreground">
                从当日日记中提取方便复习的重点。
              </p>
            </div>
            <Button
              variant="outline"
              onClick={createHighlights}
              disabled={!richTextToPlainText(content)}
            >
              提炼精华点
            </Button>
          </div>
          {highlightStatus ? (
            <p className="mt-3 text-sm text-primary">{highlightStatus}</p>
          ) : null}
          {highlights.length ? (
            <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              写完日记后，点击“提炼精华点”生成复习要点。
            </p>
          )}
        </div>

        <Collapsible
          open={sectionsOpen.meta}
          onOpenChange={(open) =>
            setSectionsOpen((current) => ({ ...current, meta: open }))
          }
          className="mt-6 border-t border-border pt-5"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left font-medium text-primary">
            <span>元认知检查</span>
            <ChevronDown />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 flex flex-col gap-3">
            {(
              [
                ["isObjective", "我今天的复盘是否客观？"],
                ["isAvoidingCoreIssue", "我是否回避了某个核心问题？"],
                ["isConfidentInAction", "我对改进措施有真实信心吗？"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg bg-secondary/35 px-3 py-2.5 text-sm"
              >
                <span>{label}</span>
                <Switch
                  checked={metaCognition[key]}
                  onCheckedChange={(checked) => updateMeta(key, checked)}
                  aria-label={label}
                />
              </label>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </section>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <History />
        {autoSavedAt ? `已于 ${autoSavedAt} 自动保存` : "每 3 秒自动保存一次"}
      </p>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>关联旧记录</DialogTitle>
            <DialogDescription>
              搜索并选择与你今天复盘有关的日记。
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={linkQuery}
              onChange={(event) => setLinkQuery(event.target.value)}
              placeholder="搜索标题或内容"
              className="pl-8"
            />
          </div>
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {linkSearching ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                正在搜索…
              </p>
            ) : linkResults.length ? (
              linkResults.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={linkSelection.includes(item.id)}
                    onCheckedChange={(checked) =>
                      toggleLinked(item.id, Boolean(checked))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {item.title || formatJournalDate(item.date)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {richTextToPlainText(item.content)}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无匹配的旧记录
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmLinks}>
              确认关联（{linkSelection.length}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

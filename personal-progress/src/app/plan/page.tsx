"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import {
  RichTextContent,
  RichTextEditor,
  richTextToPlainText,
} from "@/components/rich-text-editor";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { listJournals, todayKey } from "@/lib/journals";
import {
  buildRemarkItems,
  listDailyPlans,
  remarkItemsToHtml,
  type FocusSession,
  type StoredDayPlan,
} from "@/lib/plans";
import { extractHighlights } from "@/lib/reflection";

type Task = { id: number; text: string; priority: number; done: boolean };
type PlannedRow = { id: number; time: string; activity: string };
type ActualRow = {
  id: number;
  time: string;
  activity: string;
  minutes: number;
};
type DayPlan = {
  tasks: Task[];
  planned: PlannedRow[];
  actual: ActualRow[];
  remarks: string;
  remarkChecks: Record<string, boolean>;
  dictation: string;
  topPriorities: [string, string, string];
  focusSessions: FocusSession[];
  remarkCarryoverSyncedFrom?: string;
  locked: boolean;
};
const emptyPlan: DayPlan = {
  tasks: [],
  planned: [],
  actual: [],
  remarks: "",
  remarkChecks: {},
  dictation: "",
  topPriorities: ["", "", ""],
  focusSessions: [],
  locked: false,
};

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : null;
}

function getPlanKey(date: string) {
  return `daily-space:plan:${date}`;
}
function getPlan(date: string): DayPlan {
  try {
    return {
      ...emptyPlan,
      ...(JSON.parse(
        window.localStorage.getItem(getPlanKey(date)) ?? "{}",
      ) as Partial<DayPlan>),
    };
  } catch {
    return emptyPlan;
  }
}

function previousDateKey(date: string) {
  const previous = new Date(`${date}T12:00:00`);
  previous.setDate(previous.getDate() - 1);
  return [previous.getFullYear(), String(previous.getMonth() + 1).padStart(2, "0"), String(previous.getDate()).padStart(2, "0")].join("-");
}

function syncUnfinishedRemarksFromYesterday(date: string, currentPlan: DayPlan) {
  if (date !== todayKey()) return currentPlan;

  const yesterday = previousDateKey(date);
  if (currentPlan.remarkCarryoverSyncedFrom === yesterday) return currentPlan;

  const yesterdayPlan = getPlan(yesterday);
  const unfinished = buildRemarkItems(yesterdayPlan.remarks, yesterdayPlan.remarkChecks).filter((item) => !item.done);
  if (!unfinished.length) {
    const next = { ...currentPlan, remarkCarryoverSyncedFrom: yesterday };
    window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
    return next;
  }

  const todayItems = buildRemarkItems(currentPlan.remarks, currentPlan.remarkChecks);
  const additions = unfinished.filter((item) => !todayItems.some((todayItem) => todayItem.text === item.text));
  if (!additions.length) {
    const next = { ...currentPlan, remarkCarryoverSyncedFrom: yesterday };
    window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
    return next;
  }

  const next = {
    ...currentPlan,
    remarks: `${currentPlan.remarks.trim()}${currentPlan.remarks.trim() ? "<p></p>" : ""}${remarkItemsToHtml(additions)}`,
    remarkChecks: currentPlan.remarkChecks ?? {},
    remarkCarryoverSyncedFrom: yesterday,
  };
  window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
  return next;
}

function loadPlanWithYesterdayRemarks(date: string) {
  const storedPlan = window.localStorage.getItem(getPlanKey(date));
  const currentPlan = getPlan(date);
  // Carry-over is only for a newly created day. Existing drafts are user-owned.
  return storedPlan ? currentPlan : syncUnfinishedRemarksFromYesterday(date, currentPlan);
}

export default function PlanPage() {
  return (
    <AppFrame>
      <ClientOnly>
        <>
          <PastReflectionDialog />
          <PlanWorkspace />
        </>
      </ClientOnly>
    </AppFrame>
  );
}

function PastReflectionDialog() {
  const [open, setOpen] = useState(true);
  const entries = listJournals()
    .filter((entry) => entry.date < todayKey())
    .slice(0, 5);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>先回顾，再安排今天</DialogTitle>
          <DialogDescription>
            以下是最近日记里的精华点。带着过去的收获开始今天的计划。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4">
            {entries.length ? (
              entries.map((entry) => {
                const highlights = entry.highlights?.length
                  ? entry.highlights
                  : extractHighlights(richTextToPlainText(entry.content), 3);
                return (
                  <section
                    key={entry.date}
                    className="rounded-lg border border-border p-4"
                  >
                    <p className="text-sm font-medium">
                      {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                        "zh-CN",
                        { month: "long", day: "numeric", weekday: "short" },
                      )}
                    </p>
                    {highlights.length ? (
                      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-muted-foreground">
                        {highlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        这篇日记还没有可提炼的精华点。
                      </p>
                    )}
                  </section>
                );
              })
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                写下第一篇日记后，这里会形成你的反思回顾。
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>开始安排今天</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanWorkspace() {
  const initialDate =
    new URLSearchParams(window.location.search).get("date") || todayKey();
  const [date, setDate] = useState(initialDate);
  const [plan, setPlan] = useState<DayPlan>(() =>
    loadPlanWithYesterdayRemarks(initialDate),
  );
  const [message, setMessage] = useState("");
  const [showAllPastPlans, setShowAllPastPlans] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [focusStartedAt, setFocusStartedAt] = useState("");
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusPaused, setFocusPaused] = useState(false);
  const locked = plan.locked;
  const taskDone = plan.tasks.filter((task) => task.done).length;
  const actualMinutes = plan.actual.reduce(
    (sum, item) => sum + item.minutes,
    0,
  );
  const planText = [
    ...plan.tasks.map((task) => task.text),
    ...plan.planned.map((row) => row.activity),
    ...plan.actual.map((row) => row.activity),
    richTextToPlainText(plan.remarks),
    richTextToPlainText(plan.dictation),
  ].join("\n");
  const missingRequiredTerms = ["复习", "反思"].filter(
    (item) => !planText.includes(item),
  );
  const pastPlans = listDailyPlans().filter((entry) => entry.date < date);
  const remarkItems = buildRemarkItems(plan.remarks, plan.remarkChecks);
  const focusTask = plan.tasks.find((task) => task.id === focusTaskId);
  const focusMinutes = plan.focusSessions.reduce(
    (total, session) => total + session.minutes,
    0,
  );
  const showEveningSummary = date === todayKey() && new Date().getHours() >= 20;

  useEffect(() => {
    if (!focusTask || focusPaused || focusSeconds <= 0) return;
    const timer = window.setInterval(
      () => setFocusSeconds((current) => current - 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [focusTask, focusPaused, focusSeconds]);

  useEffect(() => {
    if (!focusTask || focusSeconds > 0) return;
    const completeTimer = window.setTimeout(() => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      const session: FocusSession = {
        id: `${focusTask.id}-${Date.now()}`,
        taskId: focusTask.id,
        startedAt: focusStartedAt,
        endedAt: new Date().toISOString(),
        minutes: 25,
      };
      setPlan((current) => {
        const next = {
          ...current,
          focusSessions: [...current.focusSessions, session],
        };
        window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
        window.dispatchEvent(new Event("daily-space:plans-changed"));
        return next;
      });
      setMessage(`“${focusTask.text || "这项计划"}”已完成一次 25 分钟专注。`);
      setFocusTaskId(null);
    }, 0);
    return () => window.clearTimeout(completeTimer);
  }, [date, focusSeconds, focusStartedAt, focusTask]);

  const update = (patch: Partial<DayPlan>) => {
    if (locked) return;
    setPlan((current) => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
      window.dispatchEvent(new Event("daily-space:plans-changed"));
      return next;
    });
  };
  const startFocus = (taskId: number) => {
    setFocusTaskId(taskId);
    setFocusStartedAt(new Date().toISOString());
    setFocusSeconds(25 * 60);
    setFocusPaused(false);
  };
  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    setPlan(loadPlanWithYesterdayRemarks(nextDate));
    setMessage("");
    setFocusTaskId(null);
  };
  const addTask = () =>
    update({
      tasks: [
        ...plan.tasks,
        {
          id: Date.now(),
          text: "",
          priority: plan.tasks.length + 1,
          done: false,
        },
      ],
    });
  const addPlanned = () =>
    update({
      planned: [...plan.planned, { id: Date.now(), time: "", activity: "" }],
    });
  const addActual = () =>
    update({
      actual: [
        ...plan.actual,
        { id: Date.now(), time: "", activity: "", minutes: 0 },
      ],
    });
  const save = () => {
    if (missingRequiredTerms.length) {
      setMessage(
        `保存前请在今日安排中加入“复习”和“反思”事项。当前缺少：${missingRequiredTerms.join("、")}。`,
      );
      return;
    }
    const next = { ...plan, locked: true };
    window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
    window.dispatchEvent(new Event("daily-space:plans-changed"));
    setPlan(next);
    setMessage("今日安排已保存并锁定。需要调整时点击“修改”。");
  };
  const unlock = () => {
    setPlan((current) => {
      const next = { ...current, locked: false };
      window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
      window.dispatchEvent(new Event("daily-space:plans-changed"));
      return next;
    });
    setMessage("已进入修改状态，所有更改会自动保存草稿。");
  };
  const toggleRemarkDone = (id: string) => {
    setPlan((current) => {
      const next = {
        ...current,
        remarkChecks: {
          ...current.remarkChecks,
          [id]: !current.remarkChecks[id],
        },
      };
      window.localStorage.setItem(getPlanKey(date), JSON.stringify(next));
      window.dispatchEvent(new Event("daily-space:plans-changed"));
      return next;
    });
  };
  const carryUnfinishedToTomorrow = () => {
    const unfinished = plan.tasks.filter(
      (task) => task.text.trim() && !task.done,
    );
    const completedActivities = new Set(
      plan.actual.map((row) => row.activity.trim()).filter(Boolean),
    );
    const pendingTimeBlocks = plan.planned.filter(
      (row) =>
        row.activity.trim() && !completedActivities.has(row.activity.trim()),
    );
    const nextDate = new Date(`${date}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const tomorrow = [
      nextDate.getFullYear(),
      String(nextDate.getMonth() + 1).padStart(2, "0"),
      String(nextDate.getDate()).padStart(2, "0"),
    ].join("-");
    const tomorrowPlan = getPlan(tomorrow);
    if (tomorrowPlan.locked) {
      setMessage("明日安排已锁定，未覆盖其中内容。");
      return;
    }
    const tomorrowRemarkItems = buildRemarkItems(
      tomorrowPlan.remarks,
      tomorrowPlan.remarkChecks,
    );
    const remarkAdditions = remarkItems.filter(
      (item) =>
        !item.done &&
        !tomorrowRemarkItems.some(
          (tomorrowItem) => tomorrowItem.text === item.text,
        ),
    );
    const nextRemarks = remarkAdditions.length
      ? `${tomorrowPlan.remarks.trim()}${tomorrowPlan.remarks.trim() ? "<p></p>" : ""}${remarkItemsToHtml(remarkAdditions)}`
      : tomorrowPlan.remarks;
    const existingTasks = new Set(
      tomorrowPlan.tasks.map((task) => task.text.trim()),
    );
    const taskAdditions = unfinished
      .filter((task) => !existingTasks.has(task.text.trim()))
      .map((task, index) => ({
        id: Date.now() + index,
        text: task.text,
        priority: tomorrowPlan.tasks.length + index + 1,
        done: false,
      }));
    const existingBlocks = new Set(
      tomorrowPlan.planned.map(
        (row) => `${row.time.trim()}|${row.activity.trim()}`,
      ),
    );
    const blockAdditions = pendingTimeBlocks
      .filter(
        (row) =>
          !existingBlocks.has(`${row.time.trim()}|${row.activity.trim()}`),
      )
      .map((row, index) => ({
        id: Date.now() + taskAdditions.length + index,
        time: row.time,
        activity: row.activity,
      }));
    if (
      !taskAdditions.length &&
      !blockAdditions.length &&
      !remarkAdditions.length
    ) {
      setMessage("未完成待办和未执行时间段都已在明日安排中。");
      return;
    }
    window.localStorage.setItem(
      getPlanKey(tomorrow),
      JSON.stringify({
        ...tomorrowPlan,
        tasks: [...tomorrowPlan.tasks, ...taskAdditions],
        planned: [...tomorrowPlan.planned, ...blockAdditions],
        remarks: nextRemarks,
        remarkChecks: tomorrowPlan.remarkChecks,
      }),
    );
    window.dispatchEvent(new Event("daily-space:plans-changed"));
    const details = [
      `${taskAdditions.length} 项未完成待办`,
      `${blockAdditions.length} 个未执行时间段`,
      remarkAdditions.length ? `${remarkAdditions.length} 条未完成备注` : "",
    ]
      .filter(Boolean)
      .filter((item) => !item.startsWith("0"));
    setMessage(
      `已将${details.join("和")}带入 ${tomorrow}，不会覆盖明日已有内容。`,
    );
  };
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
    weekday: "long",
  });
  const divider = {
    "--plan-divider": locked ? "#b9d7c0" : "#bd6879",
  } as CSSProperties;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#65736a]">每日填写 · 草稿自动保存</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">今日安排</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={carryUnfinishedToTomorrow}
            className="flex items-center gap-2 border border-[#cfd8d0] px-4 py-2.5 text-sm font-medium text-[#526158] hover:bg-[#f5f8f5]"
          >
            <Plus size={16} />
            带入明天
          </button>
          {locked ? (
            <>
              <span className="inline-flex items-center gap-2 border border-[#dfe5df] bg-white px-3 py-2.5 text-sm text-[#65736a]">
                <Lock size={15} />
                已保存
              </span>
              <button
                onClick={unlock}
                className="flex items-center gap-2 border border-[#2f6651] px-4 py-2.5 text-sm font-medium text-[#2f6651]"
              >
                <Pencil size={16} />
                修改
              </button>
            </>
          ) : (
            <>
              <button
                onClick={save}
                className="flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"
              >
                <Save size={16} />
                保存并锁定
              </button>
              {missingRequiredTerms.length ? (
                <p className="w-full text-right text-xs text-[#bd6879]">
                  保存前还需加入：{missingRequiredTerms.join("、")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
      <section
        style={divider}
        className="mt-7 overflow-hidden border border-[#d8d8d0] bg-[#fffefb]"
      >
        <div className="flex flex-wrap items-center gap-4 border-b-2 border-[var(--plan-divider)] px-5 py-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            日期{" "}
            <input
              type="date"
              value={date}
              onChange={(event) => changeDate(event.target.value)}
              className="border-b border-[#bdc6bd] bg-transparent px-1 py-1 outline-none"
            />
          </label>
          <span className="text-sm text-[#65736a]">{weekday}</span>
          <span
            className={`ml-auto text-sm ${locked ? "text-[#4f7c5a]" : "text-[#bd6879]"}`}
          >
            {locked ? "已锁定，可点击修改" : "草稿会自动保存"}
          </span>
        </div>
        <section className="border-b-2 border-[var(--plan-divider)] bg-[#f4f8f3] px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#315944]">今日三件要事</h2>
              <p className="mt-1 text-sm text-[#718077]">
                只保留最重要的三件事，让注意力有明确去处。
              </p>
            </div>
            <span className="text-xs text-[#718077]">
              会高亮显示在计划清单上方
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {plan.topPriorities.map((item, index) => (
              <label
                key={index}
                className="flex items-center gap-2 border border-[#cbdacb] bg-white px-3 py-2.5 text-sm"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#dfeee3] text-xs font-semibold text-[#2f6651]">
                  {index + 1}
                </span>
                <input
                  value={item}
                  disabled={locked}
                  onChange={(event) => {
                    const next = [...plan.topPriorities] as [
                      string,
                      string,
                      string,
                    ];
                    next[index] = event.target.value;
                    update({ topPriorities: next });
                  }}
                  placeholder={`第 ${index + 1} 件最重要的事`}
                  className="min-w-0 flex-1 bg-transparent outline-none disabled:text-[#718077]"
                />
              </label>
            ))}
          </div>
        </section>
        <section className="border-b-2 border-[var(--plan-divider)] px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">（1）待办事项</h2>
              <p className="mt-1 text-sm text-[#718077]">
                列出当天要做的事，并用序号标出权重。
              </p>
            </div>
            <span className="text-sm text-[#65736a]">
              完成 {taskDone}/{plan.tasks.length}
            </span>
          </div>
          <div className="mt-4 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {[...plan.tasks]
              .sort((a, b) => a.priority - b.priority)
              .map((task) => (
                <TaskLine
                  key={task.id}
                  task={task}
                  locked={locked}
                  onChange={(patch) =>
                    update({
                      tasks: plan.tasks.map((item) =>
                        item.id === task.id ? { ...item, ...patch } : item,
                      ),
                    })
                  }
                  onDelete={() =>
                    update({
                      tasks: plan.tasks.filter((item) => item.id !== task.id),
                    })
                  }
                  onFocus={() => startFocus(task.id)}
                />
              ))}
          </div>
          {!locked ? (
            <button
              onClick={addTask}
              className="mt-4 inline-flex items-center gap-1 border border-[#2f6651] px-3 py-2 text-sm font-medium text-[#2f6651]"
            >
              <Plus size={16} />
              添加一行待办
            </button>
          ) : null}
        </section>
        <div className="grid lg:grid-cols-2">
          <section className="border-b-2 border-[var(--plan-divider)] p-5 lg:border-b-0 lg:border-r-2">
            <ColumnTitle
              title="（2）计划完成"
              subtitle="预测每一时间段要做什么"
            />
            <div className="mt-4 space-y-1">
              {plan.planned.map((row) => (
                <PlannedLine
                  key={row.id}
                  row={row}
                  locked={locked}
                  onChange={(patch) =>
                    update({
                      planned: plan.planned.map((item) =>
                        item.id === row.id ? { ...item, ...patch } : item,
                      ),
                    })
                  }
                  onDelete={() =>
                    update({
                      planned: plan.planned.filter(
                        (item) => item.id !== row.id,
                      ),
                    })
                  }
                />
              ))}
            </div>
            {!locked ? (
              <button
                onClick={addPlanned}
                className="mt-4 inline-flex items-center gap-1 border border-[#2f6651] px-3 py-2 text-sm font-medium text-[#2f6651]"
              >
                <Plus size={15} />
                添加计划时间段
              </button>
            ) : null}
            <div className="mt-8 border-t border-[var(--plan-divider)] pt-4 text-sm text-[#65736a]">
              计划时间段：
              <strong className="text-[#17221d]">
                {plan.planned.filter((row) => row.time || row.activity).length}{" "}
                条
              </strong>
            </div>
          </section>
          <section className="p-5">
            <ColumnTitle
              title="（3）实际完成"
              subtitle="记录执行情况与实际投入"
            />
            <div className="mt-4 space-y-1">
              {plan.actual.map((row) => (
                <ActualLine
                  key={row.id}
                  row={row}
                  locked={locked}
                  onChange={(patch) =>
                    update({
                      actual: plan.actual.map((item) =>
                        item.id === row.id ? { ...item, ...patch } : item,
                      ),
                    })
                  }
                  onDelete={() =>
                    update({
                      actual: plan.actual.filter((item) => item.id !== row.id),
                    })
                  }
                />
              ))}
            </div>
            {!locked ? (
              <button
                onClick={addActual}
                className="mt-4 inline-flex items-center gap-1 border border-[#2f6651] px-3 py-2 text-sm font-medium text-[#2f6651]"
              >
                <Plus size={15} />
                添加实际完成
              </button>
            ) : null}
            <div className="mt-8 border-t border-[var(--plan-divider)] pt-4 text-sm text-[#65736a]">
              <p>
                实际投入总时长：
                <strong className="text-[#17221d]">{actualMinutes} 分钟</strong>
              </p>
              <p className="mt-2">
                实际完成记录：
                <strong className="text-[#17221d]">
                  {plan.actual.filter((row) => row.time || row.activity).length}{" "}
                  条
                </strong>
              </p>
            </div>
          </section>
        </div>
        <section className="border-t-2 border-[var(--plan-divider)] px-5 py-5">
          <ColumnTitle
            title="（4）备注"
            subtitle="记录临时事项、偏差原因和当天复盘。"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[#65736a]">
              每一条备注都可以单独完成
            </span>
            {locked ? (
              <Button size="sm" variant="outline" onClick={unlock}>
                <Pencil data-icon="inline-start" />
                修改备注
              </Button>
            ) : (
              <span className="text-sm text-[#65736a]">
                正在编辑，内容会自动保存
              </span>
            )}
          </div>
          {remarkItems.length ? (
            <div className="mt-3 grid gap-2 border-l-2 border-[#b9d7c0] pl-3">
              {remarkItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleRemarkDone(item.id)}
                  aria-pressed={item.done}
                  className="flex items-start gap-2 text-left text-sm leading-6 text-[#315944]"
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.done ? "border-[#2f6651] bg-[#2f6651] text-white" : "border-[#6f8978] bg-white"}`}
                  >
                    {item.done ? <Check size={13} /> : null}
                  </span>
                  <span
                    className={item.done ? "line-through text-[#7d8d83]" : ""}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <RichTextEditor
            value={plan.remarks}
            onChange={(remarks) => update({ remarks })}
            editable={!locked}
            placeholder="例如：下午会议延长，阅读顺延。复盘：今天最满意的是……"
            className="mt-4"
            minHeightClassName="min-h-28"
          />
          <div className="mt-6">
            <ColumnTitle
              title="英语听写"
              subtitle="写下今天需要听写、订正和复习的英语内容。"
            />
            <RichTextEditor
              value={plan.dictation}
              onChange={(dictation) => update({ dictation })}
              editable={!locked}
              placeholder="例如：Dictation: I will review today's vocabulary and correct my mistakes."
              className="mt-4"
              minHeightClassName="min-h-28"
            />
          </div>
          <PastPlans
            entries={showAllPastPlans ? pastPlans : pastPlans.slice(0, 3)}
            total={pastPlans.length}
            expanded={showAllPastPlans}
            onToggle={() => setShowAllPastPlans((current) => !current)}
          />
        </section>
      </section>
      {showEveningSummary ? (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-[#b9d7c0] bg-[#edf5ef] px-5 py-4">
          <div>
            <p className="font-medium text-[#315944]">每日计划速览</p>
            <p className="mt-1 text-sm text-[#526158]">
              完成率：{taskDone}/{plan.tasks.length || 0} · 总专注时长：
              {focusMinutes} 分钟
            </p>
          </div>
          <Button
            render={
              <Link
                href={`/journals/${date}?planSummary=${encodeURIComponent(`今日计划完成：${taskDone}/${plan.tasks.length || 0}；总专注时长：${focusMinutes} 分钟。`)}`}
              />
            }
          >
            <Sparkles data-icon="inline-start" />
            一键转入复盘
          </Button>
        </section>
      ) : null}
      {message ? (
        <p className="mt-4 bg-[#edf5ef] px-4 py-3 text-sm text-[#2f6651]">
          {message}
        </p>
      ) : null}
      {focusTask ? (
        <FocusDialog
          task={focusTask}
          seconds={focusSeconds}
          paused={focusPaused}
          onTogglePause={() => setFocusPaused((current) => !current)}
          onClose={() => setFocusTaskId(null)}
        />
      ) : null}
    </div>
  );
}

function ColumnTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-semibold text-[#5a3040]">{title}</h2>
      <p className="mt-1 text-sm text-[#718077]">{subtitle}</p>
    </div>
  );
}
function PastPlans({
  entries,
  total,
  expanded,
  onToggle,
}: {
  entries: Array<{ date: string; plan: StoredDayPlan }>;
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!total)
    return (
      <section className="mt-6 border-t border-dashed border-[#d8ded8] pt-5">
        <p className="text-sm text-[#718077]">
          保存第一份安排后，这里会显示你的往日计划。
        </p>
      </section>
    );
  return (
    <section className="mt-6 border-t border-dashed border-[#d8ded8] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-[#31473a]">往日安排</h3>
          <p className="mt-1 text-sm text-[#718077]">
            在当前页面回顾已保存的计划与执行情况。
          </p>
        </div>
        {total > 3 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp data-icon="inline-start" />
            ) : (
              <ChevronDown data-icon="inline-start" />
            )}
            {expanded ? "收起往日安排" : `展开全部 ${total} 份`}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {entries.map(({ date: pastDate, plan: pastPlan }) => (
          <PastPlanRow key={pastDate} date={pastDate} plan={pastPlan} />
        ))}
      </div>
    </section>
  );
}
function PastPlanRow({ date, plan }: { date: string; plan: StoredDayPlan }) {
  const tasks = (plan.tasks ?? [])
    .filter((task) => task.text.trim())
    .sort((a, b) => a.priority - b.priority);
  const planned = (plan.planned ?? []).filter(
    (row) => row.time || row.activity,
  );
  const actual = (plan.actual ?? []).filter((row) => row.time || row.activity);
  return (
    <article className="border border-[#dce6de] bg-white/65 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[#31473a]">
          {new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        </p>
        <span className="text-xs text-[#718077]">
          待办完成 {tasks.filter((task) => task.done).length}/{tasks.length}
        </span>
      </div>
      {tasks.length ? (
        <p className="mt-2 text-sm leading-6 text-[#526158]">
          待办：
          {tasks
            .map((task) => `${task.done ? "已完成" : "待完成"} ${task.text}`)
            .join(" · ")}
        </p>
      ) : null}
      {planned.length ? (
        <p className="mt-2 text-sm leading-6 text-[#526158]">
          计划：
          {planned
            .map((row) => `${row.time ? `${row.time} ` : ""}${row.activity}`)
            .join(" · ")}
        </p>
      ) : null}
      {actual.length ? (
        <p className="mt-2 text-sm leading-6 text-[#526158]">
          实际：
          {actual
            .map(
              (row) =>
                `${row.time ? `${row.time} ` : ""}${row.activity}${row.minutes ? ` ${row.minutes}分钟` : ""}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {plan.remarks?.trim() ? (
        <details className="group mt-3 border-l-2 border-[#b9d7c0] bg-[#f7fbf7]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-[#355642] marker:hidden">
            <span>备注</span>
            <span className="text-xs font-normal text-[#718077] group-open:hidden">点击展开</span>
            <span className="hidden text-xs font-normal text-[#718077] group-open:inline">收起</span>
          </summary>
          <div className="border-t border-[#dce6de] px-3 py-3">
            <RichTextContent
              value={plan.remarks}
              className="text-sm leading-6 text-[#526158]"
            />
          </div>
        </details>
      ) : null}
      {plan.dictation?.trim() ? (
        <details className="group mt-3 border-l-2 border-[#d7c6a5] bg-[#fffdf7]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-[#625339] marker:hidden">
            <span>英语听写</span>
            <span className="text-xs font-normal text-[#8a806f] group-open:hidden">点击展开</span>
            <span className="hidden text-xs font-normal text-[#8a806f] group-open:inline">收起</span>
          </summary>
          <div className="border-t border-[#e7ddc8] px-3 py-3">
            <RichTextContent
              value={plan.dictation}
              className="text-sm leading-6 text-[#526158]"
            />
          </div>
        </details>
      ) : null}
    </article>
  );
}
function duration(range: string) {
  const match = range.match(
    /(\d{1,2}):(\d{2})\s*[-~—–至到]+\s*(\d{1,2}):(\d{2})/,
  );
  if (!match) return "";
  const start = Number(match[1]) * 60 + Number(match[2]);
  let end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) end += 24 * 60;
  const total = end - start;
  const hours = Math.floor(total / 60);
  return hours
    ? `${hours}小时${total % 60 ? `${total % 60}分钟` : ""}`
    : `${total}分钟`;
}

function TaskLine({
  task,
  locked,
  onChange,
  onDelete,
  onFocus,
}: {
  task: Task;
  locked: boolean;
  onChange: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-[#d8ded8] py-2">
      <button
        disabled={locked}
        onClick={() => onChange({ done: !task.done })}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.done ? "border-[#2f6651] bg-[#2f6651] text-white" : "border-[#718077]"}`}
      >
        {task.done ? <Check size={13} /> : null}
      </button>
      <input
        disabled={locked}
        type="number"
        min="1"
        value={task.priority}
        onChange={(event) =>
          onChange({ priority: Number(event.target.value) || 1 })
        }
        aria-label="优先级"
        className="w-9 bg-transparent text-center text-sm font-semibold outline-none"
      />
      <input
        readOnly={locked}
        value={task.text}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder="填写待办事项"
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a0aaa2] ${task.done ? "line-through text-[#8a968e]" : ""}`}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!task.text.trim()}
        onClick={onFocus}
      >
        <Timer data-icon="inline-start" />
        专注
      </Button>
      {!locked ? (
        <button
          onClick={onDelete}
          aria-label="删除待办"
          className="text-[#a0aaa2] hover:text-[#bd6879]"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}

function FocusDialog({
  task,
  seconds,
  paused,
  onTogglePause,
  onClose,
}: {
  task: Task;
  seconds: number;
  paused: boolean;
  onTogglePause: () => void;
  onClose: () => void;
}) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>专注这一件事</DialogTitle>
          <DialogDescription>{task.text}</DialogDescription>
        </DialogHeader>
        <div className="py-6 text-center">
          <p className="text-5xl font-semibold tabular-nums text-primary">
            {minutes}:{remainingSeconds}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            完成后将自动记录一次 25 分钟专注时段。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            结束专注
          </Button>
          <Button onClick={onTogglePause}>{paused ? "继续" : "暂停"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function PlannedLine({
  row,
  locked,
  onChange,
  onDelete,
}: {
  row: PlannedRow;
  locked: boolean;
  onChange: (patch: Partial<PlannedRow>) => void;
  onDelete: () => void;
}) {
  const timeLength = duration(row.time);
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)_24px] items-center gap-2 border-b border-dashed border-[#d8ded8] py-2">
      <div>
        <input
          readOnly={locked}
          value={row.time}
          onChange={(event) => onChange({ time: event.target.value })}
          placeholder="5:40-7:00"
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[#a0aaa2]"
        />
        {timeLength ? (
          <span className="text-[11px] text-[#5d8467]">{timeLength}</span>
        ) : null}
      </div>
      <input
        readOnly={locked}
        value={row.activity}
        onChange={(event) => onChange({ activity: event.target.value })}
        placeholder="计划事项"
        className="min-w-0 bg-transparent text-sm outline-none placeholder:text-[#a0aaa2]"
      />
      {!locked ? (
        <button
          onClick={onDelete}
          aria-label="删除计划"
          className="text-[#a0aaa2] hover:text-[#bd6879]"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
function ActualLine({
  row,
  locked,
  onChange,
  onDelete,
}: {
  row: ActualRow;
  locked: boolean;
  onChange: (patch: Partial<ActualRow>) => void;
  onDelete: () => void;
}) {
  const timeLength = duration(row.time);
  return (
    <div className="grid grid-cols-[105px_minmax(0,1fr)_60px_24px] items-center gap-2 border-b border-dashed border-[#d8ded8] py-2">
      <div>
        <input
          readOnly={locked}
          value={row.time}
          onChange={(event) => onChange({ time: event.target.value })}
          placeholder="7:00-7:40"
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[#a0aaa2]"
        />
        {timeLength ? (
          <span className="text-[11px] text-[#5d8467]">{timeLength}</span>
        ) : null}
      </div>
      <input
        readOnly={locked}
        value={row.activity}
        onChange={(event) => onChange({ activity: event.target.value })}
        placeholder="实际事项"
        className="min-w-0 bg-transparent text-sm outline-none placeholder:text-[#a0aaa2]"
      />
      <input
        readOnly={locked}
        type="number"
        min="0"
        value={row.minutes || ""}
        onChange={(event) => onChange({ minutes: Number(event.target.value) })}
        placeholder="分钟"
        className="min-w-0 bg-transparent text-right text-xs outline-none placeholder:text-[#a0aaa2]"
      />
      {!locked ? (
        <button
          onClick={onDelete}
          aria-label="删除实际记录"
          className="text-[#a0aaa2] hover:text-[#bd6879]"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}

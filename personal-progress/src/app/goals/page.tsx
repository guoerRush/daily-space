"use client";

import { uploadPhoto } from "@/lib/photo-upload";
import Image from "next/image";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Check,
  Archive,
  Clock3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Maximize2,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ImageLightbox } from "@/components/image-lightbox";
import { RecordTimestamp } from "@/components/record-timestamp";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addHabit,
  addHabits,
  deleteHabit,
  habitStreak,
  listHabits,
  toggleHabit,
  updateHabit,
  type Habit,
} from "@/lib/habits";
import { todayKey } from "@/lib/journals";
import { setCompletionStatus } from "@/lib/completions";

type GoalTask = {
  id: number;
  label: string;
  done: boolean;
  children?: GoalTask[];
};
type Goal = {
  id: number;
  label: string;
  done: boolean;
  status?: "active" | "completed" | "expired";
  type: "long" | "short";
  ability?: number;
  difficulty?: number;
  tasks?: GoalTask[];
  backgroundImage?: string;
  createdAt?: string;
  updatedAt?: string;
};
type PendingDelete = {
  kind: "goal" | "habit";
  id: number;
  label: string;
  completed?: boolean;
};

const defaultGoals: Goal[] = [
  { id: 1, label: "连续记录 30 天", done: false, status: "active", type: "long" },
  { id: 2, label: "建立每周复盘习惯", done: false, status: "active", type: "long" },
  { id: 3, label: "完成一次周复盘", done: false, status: "active", type: "short" },
  { id: 4, label: "完成今日记录", done: false, status: "active", type: "short" },
];

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : null;
}

function loadGoals() {
  try {
    const stored = (
      (JSON.parse(
        window.localStorage.getItem("daily-space:goals") ?? "null",
      ) as Goal[] | null) ?? defaultGoals
    );
    return stored.map((goal) => {
      const fallback = goal.id > 946_684_800_000
        ? new Date(goal.id).toISOString()
        : "2026-01-01T12:00:00";
      return {
        ...goal,
        status: goal.status ?? (goal.done ? "completed" : "active"),
        createdAt: goal.createdAt ?? fallback,
        updatedAt: goal.updatedAt ?? goal.createdAt ?? fallback,
      };
    });
  } catch {
    return defaultGoals;
  }
}

function dateKey(day: Date) {
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysInMonth(month: Date) {
  return Array.from(
    {
      length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
  );
}


export default function GoalsPage() {
  return (
    <AppFrame>
      <ClientOnly>
        <GoalsWorkspace />
      </ClientOnly>
    </AppFrame>
  );
}

function GoalsWorkspace() {
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [draft, setDraft] = useState("");
  const [type, setType] = useState<Goal["type"]>("short");
  const [ability, setAbility] = useState(5);
  const [difficulty, setDifficulty] = useState(5);
  const [goalImage, setGoalImage] = useState("");
  const [goalImageMessage, setGoalImageMessage] = useState("");
  const [habits, setHabits] = useState<Habit[]>(listHabits);
  const [habitDraft, setHabitDraft] = useState("");
  const [historyMonth, setHistoryMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const today = todayKey();
  const monthDays = daysInMonth(historyMonth);

  const writeGoals = (next: Goal[]) => {
    const previous = new Map(goals.map((goal) => [goal.id, goal]));
    const now = new Date().toISOString();
    const comparable = (goal: Goal) => {
      const value = { ...goal };
      delete value.createdAt;
      delete value.updatedAt;
      return value;
    };
    const stamped = next.map((goal) => {
      const existing = previous.get(goal.id);
      const createdAt = goal.createdAt ?? existing?.createdAt ?? now;
      const changed = !existing || JSON.stringify(comparable(existing)) !== JSON.stringify(comparable(goal));
      return {
        ...goal,
        createdAt,
        updatedAt: changed ? now : goal.updatedAt ?? existing?.updatedAt ?? createdAt,
      };
    });
    for (const goal of stamped) {
      setCompletionStatus(
        {
          id: `goal:${goal.id}`,
          kind: "goal",
          title: goal.label,
          completedDate: todayKey(),
          detail: goal.type === "long" ? "长期目标" : "短期目标",
        },
        goal.done,
      );
      const visitTasks = (tasks: GoalTask[]) => {
        for (const task of tasks) {
          setCompletionStatus(
            {
              id: `goal-task:${goal.id}:${task.id}`,
              kind: "goal-task",
              title: task.label,
              completedDate: todayKey(),
              detail: `目标：${goal.label}`,
            },
            task.done,
          );
          visitTasks(task.children ?? []);
        }
      };
      visitTasks(goal.tasks ?? []);
    }
    setGoals(stamped);
    window.localStorage.setItem("daily-space:goals", JSON.stringify(stamped));
    window.dispatchEvent(new Event("daily-space:goals-changed"));
  };
  const addGoal = () => {
    if (!draft.trim()) return;
    writeGoals([
      ...goals,
      {
        id: Date.now(),
        label: draft.trim(),
        done: false,
        status: "active",
        type,
        ability,
        difficulty,
        tasks: [],
        backgroundImage: goalImage || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setGoalImage("");
    setGoalImageMessage("");
  };
  const selectGoalImage = async (
    files: FileList | null,
    setImage: (value: string) => void,
  ) => {
    const file = files?.[0];
    if (!file) return;
    try {
      setImage(await uploadPhoto(file));
      setGoalImageMessage("");
    } catch (error) {
      setGoalImageMessage(error instanceof Error ? error.message : "图片读取失败，请重试。");
    }
  };
  const addNewHabit = () => {
    if (!habitDraft.trim()) return;
    addHabit(habitDraft.trim());
    setHabits(listHabits());
    setHabitDraft("");
  };
  const addLifeFive = () => {
    const existing = new Set(habits.map((habit) => habit.name));
    const presets = [
      { name: "早起", target: "时间自定义" },
      { name: "冥想", target: "10分钟" },
      { name: "阅读", target: "30分钟" },
      { name: "写作", target: "300字" },
      { name: "运动", target: "30分钟" },
    ].filter((habit) => !existing.has(habit.name));
    if (!presets.length) return;
    addHabits(presets);
    setHabits(listHabits());
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "goal") {
      const goal = goals.find((item) => item.id === pendingDelete.id);
      if (goal?.done) {
        setCompletionStatus(
          {
            id: `goal:${goal.id}`,
            kind: "goal",
            title: goal.label,
            completedDate: todayKey(),
            detail: goal.type === "long" ? "长期目标" : "短期目标",
          },
          true,
        );
      }
      if (goal) {
        const archiveTasks = (tasks: GoalTask[]) => {
          for (const task of tasks) {
            if (task.done) {
              setCompletionStatus(
                {
                  id: `goal-task:${goal.id}:${task.id}`,
                  kind: "goal-task",
                  title: task.label,
                  completedDate: todayKey(),
                  detail: `目标：${goal.label}`,
                },
                true,
              );
            }
            archiveTasks(task.children ?? []);
          }
        };
        archiveTasks(goal.tasks ?? []);
      }
      writeGoals(goals.filter((goal) => goal.id !== pendingDelete.id));
    } else {
      deleteHabit(pendingDelete.id);
      setHabits(listHabits());
    }
    setPendingDelete(null);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-muted-foreground">
        把重要的事变成可持续的行动
      </p>
      <h1 className="mt-1 text-2xl font-semibold md:text-3xl">目标与习惯</h1>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <GoalGroup
          title="长期目标"
          description="持续一个月以上、指向长期改变的目标"
          goals={goals.filter((goal) => goal.type === "long" && (goal.status ?? (goal.done ? "completed" : "active")) === "active")}
          onUpdate={(goal) =>
            writeGoals(goals.map((item) => (item.id === goal.id ? goal : item)))
          }
          onDelete={(goal) =>
            setPendingDelete({ kind: "goal", id: goal.id, label: goal.label, completed: goal.done })
          }
          onMoveToExpired={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? { ...item, done: false, status: "expired" } : item))}
        />
        <GoalGroup
          title="短期目标"
          description="今天、本周或当前阶段要完成的事情"
          goals={goals.filter((goal) => goal.type === "short" && (goal.status ?? (goal.done ? "completed" : "active")) === "active")}
          onUpdate={(goal) =>
            writeGoals(goals.map((item) => (item.id === goal.id ? goal : item)))
          }
          onDelete={(goal) =>
            setPendingDelete({ kind: "goal", id: goal.id, label: goal.label, completed: goal.done })
          }
          onMoveToExpired={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? { ...item, done: false, status: "expired" } : item))}
        />
      </div>

      <GoalStatusSection
        title="已完成目标"
        description="完成后的目标会自动归档在这里，完成记录仍会保留。"
        icon={<Check />}
        goals={goals.filter((goal) => (goal.status ?? (goal.done ? "completed" : "active")) === "completed")}
        empty="还没有已完成目标。"
        onUpdate={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? goal : item))}
        onDelete={(goal) => setPendingDelete({ kind: "goal", id: goal.id, label: goal.label, completed: true })}
        onRestore={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? { ...item, done: false, status: "active" } : item))}
      />
      <GoalStatusSection
        title="已过期目标"
        description="暂时没有完成的目标可以移到这里，之后仍可恢复到进行中。"
        icon={<Archive />}
        goals={goals.filter((goal) => (goal.status ?? (goal.done ? "completed" : "active")) === "expired")}
        empty="还没有已过期目标。"
        onUpdate={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? goal : item))}
        onDelete={(goal) => setPendingDelete({ kind: "goal", id: goal.id, label: goal.label })}
        onRestore={(goal) => writeGoals(goals.map((item) => item.id === goal.id ? { ...item, done: false, status: "active" } : item))}
      />

      <section className="mt-5 border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-primary">
          <Target />
          <h2 className="font-semibold">新增目标</h2>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as Goal["type"])}
              className="border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="short">短期目标</option>
              <option value="long">长期目标</option>
            </select>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addGoal()}
              placeholder="例如：完成本周阅读计划"
              className="min-w-0 flex-1 border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              id="new-goal-background"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void selectGoalImage(event.target.files, setGoalImage)}
            />
            <Button variant="outline" render={<label htmlFor="new-goal-background" />}>
              <ImagePlus data-icon="inline-start" />
              {goalImage ? "更换图片" : "添加图片"}
            </Button>
            <Button onClick={addGoal}>
              <Plus data-icon="inline-start" />
              添加
            </Button>
          </div>
          {goalImage ? (
            <div className="flex items-center gap-3">
              <ImageLightbox
                src={goalImage}
                alt="目标背景预览"
                renderTrigger={(openPreview) => (
                  <button
                    type="button"
                    onClick={openPreview}
                    aria-label="放大查看目标背景预览"
                    className="relative h-16 w-28 cursor-zoom-in overflow-hidden rounded-md border border-border"
                  >
                    <Image
                      src={goalImage}
                      alt="目标背景预览"
                      fill
                      unoptimized
                      sizes="112px"
                      className="object-cover"
                    />
                  </button>
                )}
              />
              <Button variant="ghost" size="sm" onClick={() => setGoalImage("")}>
                <X data-icon="inline-start" />
                移除图片
              </Button>
            </div>
          ) : null}
          {goalImageMessage ? (
            <p role="status" className="text-sm text-destructive">{goalImageMessage}</p>
          ) : null}
          <div className="grid gap-3 rounded-lg bg-secondary/40 p-3 sm:grid-cols-2">
            <label className="text-sm text-muted-foreground">
              当前能力自评：
              <strong className="text-foreground">{ability}/10</strong>
              <input
                type="range"
                min="1"
                max="10"
                value={ability}
                onChange={(event) => setAbility(Number(event.target.value))}
                className="mt-2 block w-full accent-primary"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              目标挑战度：
              <strong className="text-foreground">{difficulty}/10</strong>
              <input
                type="range"
                min="1"
                max="10"
                value={difficulty}
                onChange={(event) => setDifficulty(Number(event.target.value))}
                className="mt-2 block w-full accent-primary"
              />
            </label>
          </div>
          {difficulty - ability >= 4 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              建议从舒适区边缘开始，比如先设定为每天跑 1
              公里，坚持一周后再调整。
            </p>
          ) : null}
        </div>
      </section>

      <section id="habits" className="mt-5 border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Repeat2 />
              <h2 className="font-semibold">习惯轨迹</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              按天显示的柱状图，可无限切换月份查看全部记录。
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setHistoryMonth(
                  new Date(
                    historyMonth.getFullYear(),
                    historyMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              aria-label="上个月"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-28 text-center text-sm font-medium">
              {historyMonth.toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
              })}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setHistoryMonth(
                  new Date(
                    historyMonth.getFullYear(),
                    historyMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              aria-label="下个月"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={habitDraft}
            onChange={(event) => setHabitDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addNewHabit()}
            placeholder="例如：阅读 20 分钟"
            className="min-w-0 flex-1 border border-input bg-background px-3 py-2 text-sm"
          />
          <Button onClick={addNewHabit}>
            <Plus data-icon="inline-start" />
            添加习惯
          </Button>
          <Button variant="outline" onClick={addLifeFive}>
            人生五件套
          </Button>
        </div>
        <div className="mt-5 flex flex-col gap-4">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              monthDays={monthDays}
              onRefresh={() => setHabits(listHabits())}
              onDelete={() =>
                setPendingDelete({
                  kind: "habit",
                  id: habit.id,
                  label: habit.name,
                })
              }
            />
          ))}
          {!habits.length ? (
            <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              添加第一个习惯，从今天开始打卡。
            </p>
          ) : null}
        </div>
      </section>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "goal" && pendingDelete.completed
                ? `“${pendingDelete.label}”将从当前目标移除，完成记录仍会保留在首页的完成汇总中。`
                : `“${pendingDelete?.label}”及其记录将被删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GoalGroup({
  title,
  description,
  goals,
  onUpdate,
  onDelete,
  onMoveToExpired,
}: {
  title: string;
  description: string;
  goals: Goal[];
  onUpdate: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onMoveToExpired: (goal: Goal) => void;
}) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onUpdate={onUpdate}
            onDelete={() => onDelete(goal)}
            onMoveToExpired={() => onMoveToExpired(goal)}
          />
        ))}
        {!goals.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            还没有{title}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function GoalStatusSection({
  title,
  description,
  icon,
  goals,
  empty,
  onUpdate,
  onDelete,
  onRestore,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  goals: Goal[];
  empty: string;
  onUpdate: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onRestore: (goal: Goal) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleGoals = expanded ? goals : goals.slice(0, 2);
  const canExpand = goals.length > 2;

  return (
    <section className="mt-5 border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{goals.length}</span>
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={`${title}-goals`}
          >
            {expanded ? "收起" : "展开全部"}
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div id={`${title}-goals`} className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleGoals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdate={onUpdate} onDelete={() => onDelete(goal)} onRestore={() => onRestore(goal)} />)}
        {!goals.length ? <p className="col-span-full border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">{empty}</p> : null}
      </div>
    </section>
  );
}

function GoalCard({
  goal,
  onUpdate,
  onDelete,
  onMoveToExpired,
  onRestore,
}: {
  goal: Goal;
  onUpdate: (goal: Goal) => void;
  onDelete: () => void;
  onMoveToExpired?: () => void;
  onRestore?: () => void;
}) {
  const [taskDraft, setTaskDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(goal.label);
  const [editType, setEditType] = useState(goal.type);
  const [editStatus, setEditStatus] = useState<NonNullable<Goal["status"]>>(goal.status ?? (goal.done ? "completed" : "active"));
  const [editAbility, setEditAbility] = useState(goal.ability ?? 5);
  const [editDifficulty, setEditDifficulty] = useState(goal.difficulty ?? 5);
  const [editImage, setEditImage] = useState(goal.backgroundImage ?? "");
  const [editImageMessage, setEditImageMessage] = useState("");
  const addTask = (parentId?: number) => {
    if (!taskDraft.trim()) return;
    const nextTask: GoalTask = {
      id: Date.now(),
      label: taskDraft.trim(),
      done: false,
      children: [],
    };
    const append = (items: GoalTask[]): GoalTask[] =>
      items.map((item) =>
        item.id === parentId
          ? { ...item, children: [...(item.children ?? []), nextTask] }
          : { ...item, children: append(item.children ?? []) },
      );
    onUpdate({
      ...goal,
      tasks: parentId
        ? append(goal.tasks ?? [])
        : [...(goal.tasks ?? []), nextTask],
    });
    setTaskDraft("");
  };
  const openEditor = () => {
    setEditLabel(goal.label);
    setEditType(goal.type);
    setEditStatus(goal.status ?? (goal.done ? "completed" : "active"));
    setEditAbility(goal.ability ?? 5);
    setEditDifficulty(goal.difficulty ?? 5);
    setEditImage(goal.backgroundImage ?? "");
    setEditImageMessage("");
    setEditing(true);
  };
  const selectEditImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      setEditImage(await uploadPhoto(file));
      setEditImageMessage("");
    } catch (error) {
      setEditImageMessage(error instanceof Error ? error.message : "图片读取失败，请重试。");
    }
  };
  const saveEdits = () => {
    const label = editLabel.trim();
    if (!label) return;
    onUpdate({
      ...goal,
      label,
      type: editType,
      status: editStatus,
      done: editStatus === "completed",
      ability: editAbility,
      difficulty: editDifficulty,
      backgroundImage: editImage || undefined,
    });
    setEditing(false);
  };
  return (
    <article
      className={`relative overflow-hidden border border-border ${goal.backgroundImage ? "min-h-44" : ""}`}
    >
      {goal.backgroundImage ? (
        <>
          <Image
            src={goal.backgroundImage}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 768px) 32rem, 100vw"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-black/45" />
        </>
      ) : null}
      <div
        className={`relative z-10 flex items-center gap-2 px-3 py-3 ${goal.backgroundImage ? "min-h-44" : ""}`}
      >
        <button
          onClick={() => onUpdate({ ...goal, done: !goal.done, status: goal.done ? "active" : "completed" })}
          className={`grid size-5 shrink-0 place-items-center border ${goal.done ? "border-primary bg-primary text-primary-foreground" : goal.backgroundImage ? "border-white/80 text-white" : "border-muted-foreground"}`}
        >
          {goal.done ? <Check /> : null}
        </button>
        {goal.status === "active" && onMoveToExpired ? (
          <Button variant="ghost" size="icon-sm" onClick={onMoveToExpired} aria-label={`将${goal.label}移入过期目标`} title="移入过期目标"><Clock3 /></Button>
        ) : null}
        {goal.status !== "active" && onRestore ? (
          <Button variant="ghost" size="icon-sm" onClick={onRestore} aria-label={`恢复${goal.label}到进行中`} title="恢复到进行中"><RotateCcw /></Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <span
            className={
              goal.done
                ? `block truncate line-through ${goal.backgroundImage ? "text-white/70" : "text-muted-foreground"}`
                : `block truncate ${goal.backgroundImage ? "font-medium text-white" : ""}`
            }
          >
            {goal.label}
          </span>
          <RecordTimestamp
            id={goal.id}
            createdAt={goal.createdAt}
            updatedAt={goal.updatedAt}
            className={goal.backgroundImage ? "mt-1 text-white/70" : "mt-1"}
          />
        </div>
        {goal.backgroundImage ? (
          <ImageLightbox
            src={goal.backgroundImage}
            alt={`${goal.label}的背景图片`}
            renderTrigger={(openPreview) => (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={openPreview}
                aria-label={`放大查看${goal.label}的背景图片`}
                title="放大查看背景图片"
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <Maximize2 />
              </Button>
            )}
          />
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openEditor}
          aria-label={`编辑${goal.label}`}
          className={goal.backgroundImage ? "text-white hover:bg-white/15 hover:text-white" : undefined}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? "收起子任务" : "展开子任务"}
          aria-expanded={expanded}
          className={goal.backgroundImage ? "text-white hover:bg-white/15 hover:text-white" : undefined}
        >
          <ChevronDown className={expanded ? "" : "-rotate-90"} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`删除${goal.label}`}
          className={goal.backgroundImage ? "text-white hover:bg-white/15 hover:text-white" : undefined}
        >
          <Trash2 />
        </Button>
      </div>
      {expanded ? (
        <div className="relative z-10 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-sm">
          <GoalTaskTree
            items={goal.tasks ?? []}
            onChange={(tasks) => onUpdate({ ...goal, tasks })}
          />
          <div className="mt-3 flex gap-2">
            <input
              value={taskDraft}
              onChange={(event) => setTaskDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addTask()}
              placeholder="添加子任务"
              className="min-w-0 flex-1 border border-input bg-background px-2.5 py-1.5 text-sm"
            />
            <Button size="sm" onClick={() => addTask()}>
              <Plus data-icon="inline-start" />
              子任务
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑目标</DialogTitle>
            <DialogDescription>修改目标文字，或为目标卡片更换背景图片。</DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium text-foreground">
            目标内容
            <input
              value={editLabel}
              onChange={(event) => setEditLabel(event.target.value)}
              className="mt-2 block w-full border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm font-medium text-foreground">
              目标类型
              <select value={editType} onChange={(event) => setEditType(event.target.value as Goal["type"])} className="mt-2 block w-full border border-input bg-background px-3 py-2 text-sm">
                <option value="short">短期目标</option>
                <option value="long">长期目标</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              目标状态
              <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as NonNullable<Goal["status"]>)} className="mt-2 block w-full border border-input bg-background px-3 py-2 text-sm">
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="expired">已过期</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              当前能力 {editAbility}/10
              <input type="range" min="1" max="10" value={editAbility} onChange={(event) => setEditAbility(Number(event.target.value))} className="mt-3 block w-full accent-primary" />
            </label>
            <label className="text-sm font-medium text-foreground">
              挑战难度 {editDifficulty}/10
              <input type="range" min="1" max="10" value={editDifficulty} onChange={(event) => setEditDifficulty(Number(event.target.value))} className="mt-3 block w-full accent-primary" />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">背景图片</p>
            <input
              id={`edit-goal-background-${goal.id}`}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void selectEditImage(event.target.files)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                render={<label htmlFor={`edit-goal-background-${goal.id}`} />}
              >
                <ImagePlus data-icon="inline-start" />
                {editImage ? "更换图片" : "添加图片"}
              </Button>
              {editImage ? (
                <Button variant="ghost" onClick={() => setEditImage("")}>
                  <X data-icon="inline-start" />
                  移除背景
                </Button>
              ) : null}
            </div>
            {editImage ? (
              <ImageLightbox
                src={editImage}
                alt="目标背景预览"
                renderTrigger={(openPreview) => (
                  <button
                    type="button"
                    onClick={openPreview}
                    aria-label="放大查看目标背景预览"
                    className="relative mt-3 block aspect-[16/7] w-full cursor-zoom-in overflow-hidden rounded-md border border-border"
                  >
                    <Image
                      src={editImage}
                      alt="目标背景预览"
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 32rem, 100vw"
                      className="object-cover"
                    />
                  </button>
                )}
              />
            ) : null}
            {editImageMessage ? (
              <p role="status" className="mt-2 text-sm text-destructive">{editImageMessage}</p>
            ) : null}
          </div>
          <RecordTimestamp id={goal.id} createdAt={goal.createdAt} updatedAt={goal.updatedAt} showCreatedAt />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
            <Button onClick={saveEdits} disabled={!editLabel.trim()}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function GoalTaskTree({
  items,
  onChange,
  depth = 0,
}: {
  items: GoalTask[];
  onChange: (items: GoalTask[]) => void;
  depth?: number;
}) {
  const patchItem = (id: number, patch: Partial<GoalTask>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const removeItem = (id: number) => onChange(items.filter((item) => item.id !== id));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} style={{ marginLeft: `${depth * 14}px` }}>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => patchItem(item.id, { done: !item.done })}
              className={`grid size-4 shrink-0 place-items-center border ${item.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
            >
              {item.done ? <Check /> : null}
            </button>
            <input
              value={item.label}
              onChange={(event) => patchItem(item.id, { label: event.target.value })}
              aria-label="修改子任务内容"
              className={`min-w-0 flex-1 bg-transparent outline-none ${item.done ? "line-through text-muted-foreground" : ""}`}
            />
            <Button variant="ghost" size="icon-xs" onClick={() => removeItem(item.id)} aria-label={`删除子任务${item.label}`}>
              <Trash2 />
            </Button>
          </div>
          {item.children?.length ? (
            <GoalTaskTree
              items={item.children}
              onChange={(children) => patchItem(item.id, { children })}
              depth={depth + 1}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HabitRow({
  habit,
  today,
  monthDays,
  onRefresh,
  onDelete,
}: {
  habit: Habit;
  today: string;
  monthDays: Date[];
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const done = habit.completedDates.includes(today);
  const streak = habitStreak(habit);
  const completed = new Set(habit.completedDates);
  return (
    <article className="border border-border p-4">
      <div className="flex items-center gap-3">
        <Button
          variant={done ? "default" : "outline"}
          size="icon-sm"
          onClick={() => {
            toggleHabit(habit.id);
            onRefresh();
          }}
          aria-label={`${done ? "取消" : "完成"}${habit.name}打卡`}
        >
          {done ? <Check /> : null}
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{habit.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {habit.target ? `${habit.target} · ` : ""}连续 {streak} 天 · 累计{" "}
            {habit.completedDates.length} 天
          </p>
          <RecordTimestamp
            id={habit.id}
            createdAt={habit.createdAt}
            updatedAt={habit.updatedAt}
            className="mt-1"
          />
        </div>
        <HabitEditor habit={habit} onSaved={onRefresh} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`删除${habit.name}`}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-5 flex h-28 items-end gap-px border-b border-border px-1">
        {monthDays.map((day) => {
          const checked = completed.has(dateKey(day));
          return (
            <div
              key={dateKey(day)}
              title={`${dateKey(day)}${checked ? " 已打卡" : " 未打卡"}`}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                style={{ height: checked ? "82%" : "4px" }}
                className={`w-full ${checked ? "bg-primary" : "bg-muted"}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>1 日</span>
        <span>完成打卡</span>
        <span>{monthDays.length} 日</span>
      </div>
    </article>
  );
}

function HabitEditor({ habit, onSaved }: { habit: Habit; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(habit.name);
  const [target, setTarget] = useState(habit.target ?? "");
  const begin = () => {
    setName(habit.name);
    setTarget(habit.target ?? "");
    setOpen(true);
  };
  const save = () => {
    if (!name.trim()) return;
    updateHabit(habit.id, { name, target });
    onSaved();
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon-sm" onClick={begin} aria-label={`编辑${habit.name}`}>
        <Pencil />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改习惯</DialogTitle>
          <DialogDescription>修改名称与目标说明，已有打卡记录会保留。</DialogDescription>
        </DialogHeader>
        <label className="text-sm font-medium">
          习惯名称
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 block w-full border border-input bg-background px-3 py-2" />
        </label>
        <label className="text-sm font-medium">
          目标说明
          <input value={target} onChange={(event) => setTarget(event.target.value)} className="mt-2 block w-full border border-input bg-background px-3 py-2" placeholder="例如：每天阅读 20 分钟" />
        </label>
        <RecordTimestamp id={habit.id} createdAt={habit.createdAt} updatedAt={habit.updatedAt} showCreatedAt />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={save} disabled={!name.trim()}>保存修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

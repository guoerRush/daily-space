"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat2,
  Target,
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
  addHabit,
  addHabits,
  deleteHabit,
  habitStreak,
  listHabits,
  toggleHabit,
  type Habit,
} from "@/lib/habits";
import { todayKey } from "@/lib/journals";

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
  type: "long" | "short";
  ability?: number;
  difficulty?: number;
  tasks?: GoalTask[];
};
type PendingDelete = { kind: "goal" | "habit"; id: number; label: string };

const defaultGoals: Goal[] = [
  { id: 1, label: "连续记录 30 天", done: false, type: "long" },
  { id: 2, label: "建立每周复盘习惯", done: false, type: "long" },
  { id: 3, label: "完成一次周复盘", done: false, type: "short" },
  { id: 4, label: "完成今日记录", done: false, type: "short" },
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
    return (
      (JSON.parse(
        window.localStorage.getItem("daily-space:goals") ?? "null",
      ) as Goal[] | null) ?? defaultGoals
    );
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
    setGoals(next);
    window.localStorage.setItem("daily-space:goals", JSON.stringify(next));
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
        type,
        ability,
        difficulty,
        tasks: [],
      },
    ]);
    setDraft("");
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
    if (pendingDelete.kind === "goal")
      writeGoals(goals.filter((goal) => goal.id !== pendingDelete.id));
    else {
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
          goals={goals.filter((goal) => goal.type === "long")}
          onUpdate={(goal) =>
            writeGoals(goals.map((item) => (item.id === goal.id ? goal : item)))
          }
          onDelete={(goal) =>
            setPendingDelete({ kind: "goal", id: goal.id, label: goal.label })
          }
        />
        <GoalGroup
          title="短期目标"
          description="今天、本周或当前阶段要完成的事情"
          goals={goals.filter((goal) => goal.type === "short")}
          onUpdate={(goal) =>
            writeGoals(goals.map((item) => (item.id === goal.id ? goal : item)))
          }
          onDelete={(goal) =>
            setPendingDelete({ kind: "goal", id: goal.id, label: goal.label })
          }
        />
      </div>

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
            <Button onClick={addGoal}>
              <Plus data-icon="inline-start" />
              添加
            </Button>
          </div>
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
              “{pendingDelete?.label}”及其记录将被删除，无法恢复。
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
}: {
  title: string;
  description: string;
  goals: Goal[];
  onUpdate: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
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

function GoalCard({
  goal,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  onUpdate: (goal: Goal) => void;
  onDelete: () => void;
}) {
  const [taskDraft, setTaskDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
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
  return (
    <article className="border border-border">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          onClick={() => onUpdate({ ...goal, done: !goal.done })}
          className={`grid size-5 shrink-0 place-items-center border ${goal.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
        >
          {goal.done ? <Check /> : null}
        </button>
        <span
          className={
            goal.done
              ? "min-w-0 flex-1 truncate text-muted-foreground line-through"
              : "min-w-0 flex-1 truncate"
          }
        >
          {goal.label}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpanded((current) => !current)}
          aria-label="展开子任务"
        >
          <ChevronDown className={expanded ? "" : "-rotate-90"} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`删除${goal.label}`}
        >
          <Trash2 />
        </Button>
      </div>
      {expanded ? (
        <div className="border-t border-border bg-muted/20 px-3 py-3">
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
            <span
              className={item.done ? "line-through text-muted-foreground" : ""}
            >
              {item.label}
            </span>
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
        </div>
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

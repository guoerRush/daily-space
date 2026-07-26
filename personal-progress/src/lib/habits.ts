import { todayKey } from "@/lib/journals";
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

export type Habit = {
  id: number;
  name: string;
  createdAt: string;
  completedDates: string[];
  target?: string;
};

const starterHabits: Habit[] = [
  { id: 1, name: "每日写日记", createdAt: "2026-01-01", completedDates: [] },
];

export function listHabits(): Habit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.habits);
    if (!raw) return starterHabits;
    return JSON.parse(raw) as Habit[];
  } catch {
    return starterHabits;
  }
}

function writeHabits(habits: Habit[]) {
  window.localStorage.setItem(STORAGE_KEYS.habits, JSON.stringify(habits));
  window.dispatchEvent(new Event(STORAGE_EVENTS.habitsChanged));
}

export function addHabit(name: string, target?: string) {
  const next = {
    id: Date.now(),
    name,
    target,
    createdAt: todayKey(),
    completedDates: [],
  };
  writeHabits([...listHabits(), next]);
  return next;
}

export function addHabits(habits: Array<{ name: string; target?: string }>) {
  const now = Date.now();
  const next = habits.map((habit, index) => ({
    id: now + index,
    name: habit.name,
    target: habit.target,
    createdAt: todayKey(),
    completedDates: [],
  }));
  writeHabits([...listHabits(), ...next]);
  return next;
}

export function toggleHabit(id: number, date = todayKey()) {
  const next = listHabits().map((habit) =>
    habit.id !== id
      ? habit
      : {
          ...habit,
          completedDates: habit.completedDates.includes(date)
            ? habit.completedDates.filter((item) => item !== date)
            : [...habit.completedDates, date],
        },
  );
  writeHabits(next);
  const habit = next.find((item) => item.id === id);
  if (habit?.completedDates.includes(date)) {
    window.dispatchEvent(
      new CustomEvent(STORAGE_EVENTS.habitCompleted, {
        detail: { habitId: id, habitName: habit.name, date },
      }),
    );
  }
  return next;
}

export function deleteHabit(id: number) {
  writeHabits(listHabits().filter((habit) => habit.id !== id));
}

export function habitStreak(habit: Habit, from = todayKey()) {
  const complete = new Set(habit.completedDates);
  const cursor = new Date(`${from}T12:00:00`);
  let streak = 0;
  while (
    complete.has(
      [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, "0"),
        String(cursor.getDate()).padStart(2, "0"),
      ].join("-"),
    )
  ) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function habitWeekCount(habit: Habit, from = todayKey()) {
  const complete = new Set(habit.completedDates);
  const cursor = new Date(`${from}T12:00:00`);
  let count = 0;
  for (let index = 0; index < 7; index += 1) {
    const key = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");
    if (complete.has(key)) count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

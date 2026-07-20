export type SpecialDay = {
  id: number;
  title: string;
  date: string;
  category: "anniversary" | "birthday" | "other";
  repeatsYearly: boolean;
};

const STORAGE_KEY = "daily-space:special-days";

export function listSpecialDays(): SpecialDay[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SpecialDay[]).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveSpecialDay(day: Omit<SpecialDay, "id">) {
  const next = { ...day, id: Date.now() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...listSpecialDays(), next]));
  window.dispatchEvent(new Event("daily-space:days-changed"));
  return next;
}

export function deleteSpecialDay(id: number) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSpecialDays().filter((day) => day.id !== id)));
  window.dispatchEvent(new Event("daily-space:days-changed"));
}

export function countdown(day: SpecialDay, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const source = new Date(`${day.date}T12:00:00`);
  let target = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  if (day.repeatsYearly) {
    target = new Date(today.getFullYear(), source.getMonth(), source.getDate());
    if (target < today) target.setFullYear(target.getFullYear() + 1);
  }
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

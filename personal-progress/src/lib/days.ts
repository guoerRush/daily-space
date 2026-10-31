export type SpecialDay = {
  id: number;
  title: string;
  date: string;
  category: "anniversary" | "birthday" | "other";
  repeatsYearly: boolean;
  /** The shared special-day type id. Older records may omit this field. */
  type?: string;
  linkedDiaryId?: string;
  note?: string;
  backgroundImage?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SpecialDayType = {
  id: string;
  label: string;
  category: SpecialDay["category"];
};

export const defaultSpecialDayTypes: SpecialDayType[] = [
  { id: "ordinary", label: "普通纪念日", category: "anniversary" },
  { id: "birthday", label: "生日", category: "birthday" },
  { id: "important", label: "重要事件", category: "other" },
  { id: "gratitude", label: "感恩里程碑", category: "anniversary" },
  { id: "achievement", label: "成就时刻", category: "other" },
];

function canUseStorage() {
  return typeof window !== "undefined";
}

export function listSpecialDayTypes(): SpecialDayType[] {
  if (!canUseStorage()) return defaultSpecialDayTypes;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.specialDayTypes) ?? "[]",
    ) as SpecialDayType[];
    const custom = stored.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        !defaultSpecialDayTypes.some((defaultType) => defaultType.id === item.id),
    );
    return [...defaultSpecialDayTypes, ...custom];
  } catch {
    return defaultSpecialDayTypes;
  }
}

export function addSpecialDayType(label: string): SpecialDayType | null {
  const normalizedLabel = label.trim().replace(/\s+/g, " ");
  if (!normalizedLabel) return null;
  const types = listSpecialDayTypes();
  const existing = types.find(
    (item) => item.label.toLocaleLowerCase("zh-CN") === normalizedLabel.toLocaleLowerCase("zh-CN"),
  );
  if (existing) return existing;

  const custom: SpecialDayType = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: normalizedLabel.slice(0, 30),
    category: "other",
  };
  const stored = types.filter(
    (item) => !defaultSpecialDayTypes.some((defaultType) => defaultType.id === item.id),
  );
  window.localStorage.setItem(
    STORAGE_KEYS.specialDayTypes,
    JSON.stringify([...stored, custom]),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.dayTypesChanged));
  return custom;
}

export function getSpecialDayType(type?: string, category?: SpecialDay["category"]) {
  // Older forms stored the category and the default "ordinary" type separately.
  // Prefer the meaningful category for those legacy birthday/important-day records.
  if (type === "ordinary" && category === "birthday") {
    return defaultSpecialDayTypes[1];
  }
  if (type === "ordinary" && category === "other") {
    return defaultSpecialDayTypes[2];
  }
  if (type) {
    const found = listSpecialDayTypes().find((item) => item.id === type);
    if (found) return found;
  }
  if (category === "birthday") return defaultSpecialDayTypes[1];
  if (category === "other") return defaultSpecialDayTypes[2];
  return defaultSpecialDayTypes[0];
}

export function listSpecialDays(): SpecialDay[] {
  if (typeof window === "undefined") return [];
  try {
    return (
      JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.specialDays) ?? "[]",
      ) as SpecialDay[]
    ).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveSpecialDay(day: Omit<SpecialDay, "id">) {
  const id = Date.now();
  const now = new Date().toISOString();
  const next = { ...day, id, createdAt: day.createdAt ?? now, updatedAt: now };
  window.localStorage.setItem(
    STORAGE_KEYS.specialDays,
    JSON.stringify([...listSpecialDays(), next]),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.daysChanged));
  return next;
}

export function deleteSpecialDay(id: number) {
  window.localStorage.setItem(
    STORAGE_KEYS.specialDays,
    JSON.stringify(listSpecialDays().filter((day) => day.id !== id)),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.daysChanged));
}

export function updateSpecialDay(updatedDay: SpecialDay) {
  const existing = listSpecialDays().find((day) => day.id === updatedDay.id);
  const now = new Date().toISOString();
  const nextDay = {
    ...updatedDay,
    createdAt: updatedDay.createdAt ?? existing?.createdAt ?? new Date(updatedDay.id).toISOString(),
    updatedAt: now,
  };
  window.localStorage.setItem(
    STORAGE_KEYS.specialDays,
    JSON.stringify(
      listSpecialDays().map((day) =>
        day.id === updatedDay.id ? nextDay : day,
      ),
    ),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.daysChanged));
}

export function countdown(day: SpecialDay, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const source = new Date(`${day.date}T12:00:00`);
  let target = new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate(),
  );
  if (day.repeatsYearly) {
    target = new Date(today.getFullYear(), source.getMonth(), source.getDate());
    if (target < today) target.setFullYear(target.getFullYear() + 1);
  }
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

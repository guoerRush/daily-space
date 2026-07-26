export type NoteCategory = string;
export type NoteTag = "灵感" | "疑问" | "情绪波动" | "待办" | "其他";
export type NoteCategoryInfo = {
  id: NoteCategory;
  label: string;
  description: string;
};
export type Note = {
  id: number;
  category: NoteCategory;
  title: string;
  content: string;
  images: string[];
  tags?: NoteTag[];
  processed?: boolean;
  updatedAt: string;
};

const builtInCategories: NoteCategoryInfo[] = [
  { id: "ai", label: "AI", description: "工具、提示词、工作流与灵感" },
  { id: "work", label: "工作", description: "项目、会议、方法与复盘" },
  {
    id: "life",
    label: "实用生活知识",
    description: "健康、效率、消费与日常技巧",
  },
];

export const categoryInfo: Record<
  string,
  Omit<NoteCategoryInfo, "id">
> = Object.fromEntries(
  builtInCategories.map(({ id, label, description }) => [
    id,
    { label, description },
  ]),
);

export function listNoteCategories(): NoteCategoryInfo[] {
  if (typeof window === "undefined") return builtInCategories;
  try {
    const custom = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.noteCategories) ?? "[]",
    ) as NoteCategoryInfo[];
    const uniqueCustom = custom.filter(
      (category) => category.id && category.label && !categoryInfo[category.id],
    );
    return [...builtInCategories, ...uniqueCustom];
  } catch {
    return builtInCategories;
  }
}

export function getCategoryInfo(
  category: NoteCategory,
): Omit<NoteCategoryInfo, "id"> {
  const found = listNoteCategories().find((item) => item.id === category);
  return found ?? { label: "未命名分类", description: "收集值得保留的信息" };
}

export function saveNoteCategory(input: {
  label: string;
  description?: string;
}) {
  const label = input.label.trim();
  if (!label) throw new Error("分类名称不能为空");
  const id = `custom-${Date.now()}`;
  const category: NoteCategoryInfo = {
    id,
    label,
    description: input.description?.trim() || "收集值得保留的信息",
  };
  const custom = listNoteCategories().filter((item) => !categoryInfo[item.id]);
  window.localStorage.setItem(
    STORAGE_KEYS.noteCategories,
    JSON.stringify([...custom, category]),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.noteCategoriesChanged));
  return category;
}

export function listNotes(category?: NoteCategory): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const notes = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.notes) ?? "[]",
    ) as Note[];
    return notes
      .filter((note) => !category || note.category === category)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveNote(
  note: Omit<Note, "id" | "updatedAt"> & { id?: number },
) {
  const current = listNotes().filter((item) => item.id !== note.id);
  const next: Note = {
    ...note,
    id: note.id ?? Date.now(),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    STORAGE_KEYS.notes,
    JSON.stringify([next, ...current]),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.notesChanged));
  return next;
}

export function deleteNote(id: number) {
  window.localStorage.setItem(
    STORAGE_KEYS.notes,
    JSON.stringify(listNotes().filter((note) => note.id !== id)),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.notesChanged));
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";

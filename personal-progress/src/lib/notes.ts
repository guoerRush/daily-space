export type NoteCategory = "ai" | "work" | "life";
export type Note = { id: number; category: NoteCategory; title: string; content: string; images: string[]; updatedAt: string };

const STORAGE_KEY = "daily-space:notes";

export const categoryInfo: Record<NoteCategory, { label: string; description: string }> = {
  ai: { label: "AI", description: "工具、提示词、工作流与灵感" },
  work: { label: "工作", description: "项目、会议、方法与复盘" },
  life: { label: "实用生活知识", description: "健康、效率、消费与日常技巧" },
};

export function listNotes(category?: NoteCategory): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const notes = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Note[];
    return notes.filter((note) => !category || note.category === category).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

export function saveNote(note: Omit<Note, "id" | "updatedAt"> & { id?: number }) {
  const current = listNotes().filter((item) => item.id !== note.id);
  const next: Note = { ...note, id: note.id ?? Date.now(), updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...current]));
  window.dispatchEvent(new Event("daily-space:notes-changed"));
  return next;
}

export function deleteNote(id: number) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listNotes().filter((note) => note.id !== id)));
  window.dispatchEvent(new Event("daily-space:notes-changed"));
}

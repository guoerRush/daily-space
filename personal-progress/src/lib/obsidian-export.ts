import type { JournalEntry } from "@/lib/journals";
import type { SuccessJournal } from "@/lib/success-journals";

const DATABASE_NAME = "daily-space-obsidian-sync";
const STORE_NAME = "settings";
const VAULT_KEY = "vault";
const GENERATED_START = "<!-- daily-space:generated:start -->";
const GENERATED_END = "<!-- daily-space:generated:end -->";

type WritableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
  }) => Promise<WritableDirectoryHandle>;
};

export type ObsidianExportResult = {
  noteCount: number;
  imageCount: number;
  folder: string;
};

export function canExportToObsidian() {
  return typeof window !== "undefined" && Boolean((window as DirectoryPickerWindow).showDirectoryPicker);
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("OBSIDIAN_STORAGE_FAILED"));
  });
}

async function readVaultHandle() {
  const database = await openDatabase();
  return new Promise<WritableDirectoryHandle | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(VAULT_KEY);
    request.onsuccess = () => {
      resolve(request.result as WritableDirectoryHandle | undefined);
      database.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("OBSIDIAN_STORAGE_FAILED"));
      database.close();
    };
  });
}

async function writeVaultHandle(vault: WritableDirectoryHandle) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(vault, VAULT_KEY);
    request.onsuccess = () => {
      resolve();
      database.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("OBSIDIAN_STORAGE_FAILED"));
      database.close();
    };
  });
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function htmlToMarkdown(value = "") {
  if (!value.trim()) return "";
  if (!/<[a-z][\s\S]*>/i.test(value)) return value.trim();

  const document = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  const renderChildren = (node: Node) => Array.from(node.childNodes).map(renderNode).join("");
  const renderList = (element: Element, ordered: boolean) => {
    const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li");
    return `${items.map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const content = renderChildren(item).trim().replace(/\n+/g, "\n  ");
      return `${marker} ${content}`;
    }).join("\n")}\n\n`;
  };
  function renderNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent ?? "");
    if (!(node instanceof Element)) return "";
    const children = renderChildren(node);
    switch (node.tagName.toLowerCase()) {
      case "br": return "\n";
      case "p": return `${children.trim()}\n\n`;
      case "h1": return `# ${children.trim()}\n\n`;
      case "h2": return `## ${children.trim()}\n\n`;
      case "h3": return `### ${children.trim()}\n\n`;
      case "strong":
      case "b": return `**${children}**`;
      case "em":
      case "i": return `*${children}*`;
      case "u": return `<u>${children}</u>`;
      case "s":
      case "strike": return `~~${children}~~`;
      case "blockquote": return `${children.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
      case "ul": return renderList(node, false);
      case "ol": return renderList(node, true);
      case "a": {
        const href = node.getAttribute("href");
        return href ? `[${children.trim()}](${href})` : children;
      }
      default: return children;
    }
  }

  return renderChildren(document.body).replace(/\n{3,}/g, "\n\n").trim();
}

function section(title: string, value?: string) {
  const content = htmlToMarkdown(value);
  return content ? `## ${title}\n\n${content}` : "";
}

function imageExtension(mime: string) {
  const extensions: Record<string, string> = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[mime] ?? "png";
}

async function writeFile(directory: FileSystemDirectoryHandle, name: string, content: string | Blob) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readTextFile(directory: FileSystemDirectoryHandle, name: string) {
  try {
    const handle = await directory.getFileHandle(name);
    return (await handle.getFile()).text();
  } catch (error) {
    if ((error as DOMException).name === "NotFoundError") return null;
    throw error;
  }
}

function mergeManagedBlock(existing: string | null, generated: string, generatedBody: string) {
  if (!existing) return generated;
  const start = existing.indexOf(GENERATED_START);
  const end = existing.indexOf(GENERATED_END);
  if (start >= 0 && end > start) {
    return `${existing.slice(0, start)}${GENERATED_START}\n${generatedBody.trim()}\n${GENERATED_END}${existing.slice(end + GENERATED_END.length)}`;
  }
  return `${existing.trimEnd()}\n\n## 日常留白同步\n\n${GENERATED_START}\n${generatedBody.trim()}\n${GENERATED_END}\n`;
}

async function writeManagedMarkdown(
  directory: FileSystemDirectoryHandle,
  name: string,
  generated: string,
  generatedBody: string,
) {
  const existing = await readTextFile(directory, name);
  const next = mergeManagedBlock(existing, generated, generatedBody);
  if (existing === next) return false;
  await writeFile(directory, name, next);
  return true;
}

async function exportImages(
  entry: JournalEntry | undefined,
  attachments: FileSystemDirectoryHandle,
) {
  const references: string[] = [];
  let written = 0;
  for (const [index, source] of (entry?.images ?? []).entries()) {
    if (!source.startsWith("data:")) {
      references.push(`![图片 ${index + 1}](${source})`);
      continue;
    }
    const response = await fetch(source);
    const blob = await response.blob();
    const fileName = `${entry?.date ?? "journal"}-${index + 1}.${imageExtension(blob.type)}`;
    await writeFile(attachments, fileName, blob);
    references.push(`![[附件/${fileName}]]`);
    written += 1;
  }
  return { references, written };
}

function buildReflectionBody(
  date: string,
  journal: JournalEntry | undefined,
  success: SuccessJournal | undefined,
  imageReferences: string[],
) {
  const updatedAt = [journal?.updatedAt, success?.updatedAt].filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  const parts = [
    `> [!abstract] 当日概览\n> 心情：${journal?.mood ?? "未记录"}\n> 网站更新：${updatedAt}`,
    section("正文", journal?.content),
    section("触动了什么", journal?.touchEvent),
    section("为什么会被触动", journal?.touchWhy),
    section("下一步行动", journal?.touchAction),
    section("发生了什么", journal?.reviewDesc),
    section("原因与反思", journal?.reviewAnalysis),
    section("改进与行动", journal?.reviewAction),
    success?.content ? `## 成功日记\n\n${htmlToMarkdown(success.content)}` : "",
    journal?.highlights?.length ? `## 精华点\n\n${journal.highlights.map((item) => `- ${escapeMarkdownText(item)}`).join("\n")}` : "",
    imageReferences.length ? `## 图片\n\n${imageReferences.join("\n\n")}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

function buildReflectionMarkdown(date: string, body: string) {
  return `---\ntype: reflection\nsource: daily-space\ndate: ${date}\ntags:\n  - MyMind\n  - 复盘手记\n---\n\n# ${date} 复盘手记\n\n${GENERATED_START}\n${body}\n${GENERATED_END}\n`;
}

function buildIndexBody(dates: string[]) {
  const links = dates.map((date) => {
    const [year, month, day] = date.split("-");
    return `- [[${date} 复盘手记|${year}年${Number(month)}月${Number(day)}日]]`;
  });
  return [
    "> [!info] 每日思考地图\n> 由日常留白同步，点击日期可查看当天的正文、反思、行动、成功日记与图片。",
    "## 按日期查看",
    links.join("\n"),
  ].join("\n\n");
}

function buildIndexMarkdown(body: string) {
  return `---\ntype: reflection-index\nsource: daily-space\ntags:\n  - MyMind\n  - 复盘手记\n---\n\n# 每日思考索引\n\n${GENERATED_START}\n${body}\n${GENERATED_END}\n`;
}

async function writeReflectionsToVault(
  vault: WritableDirectoryHandle,
  journals: JournalEntry[],
  successes: SuccessJournal[],
): Promise<ObsidianExportResult> {
  const raw = await vault.getDirectoryHandle("00Raw", { create: true });
  const personal = await raw.getDirectoryHandle("Personal", { create: true });
  const weeklyReviews = await personal.getDirectoryHandle("Weekly-reviews", { create: true });
  const myMind = await weeklyReviews.getDirectoryHandle("MyMind", { create: true });
  const reflections = await myMind.getDirectoryHandle("复盘手记", { create: true });
  const attachments = await reflections.getDirectoryHandle("附件", { create: true });
  const journalsByDate = new Map(journals.map((entry) => [entry.date, entry]));
  const successesByDate = new Map(successes.map((entry) => [entry.date, entry]));
  const dates = [...new Set([...journalsByDate.keys(), ...successesByDate.keys()])].sort().reverse();
  let imageCount = 0;

  for (const date of dates) {
    const journal = journalsByDate.get(date);
    const success = successesByDate.get(date);
    const images = await exportImages(journal, attachments);
    imageCount += images.written;
    const body = buildReflectionBody(date, journal, success, images.references);
    await writeManagedMarkdown(
      reflections,
      `${date} 复盘手记.md`,
      buildReflectionMarkdown(date, body),
      body,
    );
  }

  const indexBody = buildIndexBody(dates);
  await writeManagedMarkdown(
    reflections,
    "索引.md",
    buildIndexMarkdown(indexBody),
    indexBody,
  );

  return {
    noteCount: dates.length,
    imageCount,
    folder: `${vault.name}/00Raw/Personal/Weekly-reviews/MyMind/复盘手记`,
  };
}

async function validateVault(vault: WritableDirectoryHandle) {
  try {
    await vault.getDirectoryHandle(".obsidian");
  } catch {
    throw new Error("NOT_OBSIDIAN_VAULT");
  }
}

export async function exportReflectionsToObsidian(
  journals: JournalEntry[],
  successes: SuccessJournal[],
) {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("OBSIDIAN_EXPORT_UNSUPPORTED");

  let vault = await readVaultHandle();
  if (vault) {
    const permission = await vault.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      const requested = await vault.requestPermission({ mode: "readwrite" });
      if (requested !== "granted") throw new Error("OBSIDIAN_PERMISSION_DENIED");
    }
  } else {
    vault = await picker({ id: "daily-space-obsidian", mode: "readwrite", startIn: "documents" });
    await validateVault(vault);
    await writeVaultHandle(vault);
  }

  await validateVault(vault);
  return writeReflectionsToVault(vault, journals, successes);
}

export async function syncReflectionsToConnectedObsidian(
  journals: JournalEntry[],
  successes: SuccessJournal[],
) {
  const vault = await readVaultHandle();
  if (!vault) return { synced: false as const, reason: "not-connected" as const };
  if ((await vault.queryPermission({ mode: "readwrite" })) !== "granted") {
    return { synced: false as const, reason: "permission-needed" as const };
  }
  await validateVault(vault);
  const result = await writeReflectionsToVault(vault, journals, successes);
  return { synced: true as const, result };
}

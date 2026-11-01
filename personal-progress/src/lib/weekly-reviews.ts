import type { JournalEntry } from "@/lib/journals";
import { listJournals } from "@/lib/journals";
import type { StoredDayPlan } from "@/lib/plans";
import {
  buildRemarkItems,
  listDailyPlans,
  loadWeeklyPriorities,
} from "@/lib/plans";
import type { SuccessJournal } from "@/lib/success-journals";
import { listSuccessJournals } from "@/lib/success-journals";
import {
  STORAGE_EVENTS,
  STORAGE_KEYS,
} from "@/lib/storage-contract";

export type WeeklyReviewStats = {
  elapsedDays: number;
  journalDays: number;
  successDays: number;
  planDays: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number | null;
};

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  stats: WeeklyReviewStats;
  progressPoints: string[];
  improvementPoints: string[];
  missedPoints: string[];
  reflectionThemes: string[];
  weeklyThought: string;
  sourceSignature: string;
  generatedAt: string;
  updatedAt: string;
};

type WeeklySources = {
  journals: JournalEntry[];
  successes: SuccessJournal[];
  plans: Array<{ date: string; plan: StoredDayPlan }>;
  weeklyPriorities: string[];
};

type WeeklyReviewMaterial = {
  weekStart: string;
  weekEnd: string;
  weeklyPriorities: string[];
  dailySummaries: Array<{ date: string; text: string }>;
  successJournals: Array<{ date: string; text: string }>;
  dailyPlans: Array<{
    date: string;
    planned: string[];
    actual: string[];
    completed: string[];
    incomplete: string[];
    remarks: Array<{ text: string; done: boolean }>;
  }>;
  stats: WeeklyReviewStats;
};

function loadWeeklySources(weekStart: string, weekEnd: string): WeeklySources {
  return {
    journals: listJournals().filter((entry) => inRange(entry.date, weekStart, weekEnd)),
    successes: listSuccessJournals().filter((entry) => inRange(entry.date, weekStart, weekEnd)),
    plans: listDailyPlans().filter((entry) => inRange(entry.date, weekStart, weekEnd)),
    weeklyPriorities: loadWeeklyPriorities(weekStart).priorities.filter((item) => item.trim()),
  };
}

const THEME_KEYWORDS = [
  { name: "执行与行动", words: ["执行", "行动", "拖延", "完成", "开始", "坚持", "落实"] },
  { name: "时间与节奏", words: ["时间", "效率", "节奏", "安排", "计划", "优先级"] },
  { name: "学习与成长", words: ["学习", "复习", "知识", "阅读", "课程", "英语", "认知"] },
  { name: "工作与产出", words: ["工作", "项目", "任务", "客户", "成果", "产出"] },
  { name: "健康与精力", words: ["运动", "睡眠", "健康", "身体", "休息", "早睡", "精力"] },
  { name: "情绪与心态", words: ["情绪", "焦虑", "开心", "难过", "压力", "心态", "感受"] },
  { name: "关系与沟通", words: ["沟通", "朋友", "家人", "关系", "同事", "表达"] },
] as const;

const REFLECTION_WORDS = ["反思", "因为", "需要", "应该", "下次", "问题", "改进", "不足", "避免", "意识到"];

function dateKey(day: Date) {
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDate(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function getWeekRange(reference: Date | string = new Date()) {
  const day = typeof reference === "string" ? parseDate(reference) : new Date(reference);
  day.setHours(12, 0, 0, 0);
  const mondayOffset = (day.getDay() + 6) % 7;
  const start = new Date(day);
  start.setDate(day.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: dateKey(start), weekEnd: dateKey(end) };
}

export function shiftWeek(weekStart: string, amount: number) {
  const day = parseDate(weekStart);
  day.setDate(day.getDate() + amount * 7);
  return dateKey(day);
}

function inRange(date: string, weekStart: string, weekEnd: string) {
  return date >= weekStart && date <= weekEnd;
}

function htmlToLines(value = "") {
  return value
    .replace(/<(br\s*\/?>|\/p|\/li|\/h[1-6]|\/blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function compact(value: string, maxLength = 54) {
  const normalized = value.replace(/^[\s•·\-—\d.、]+/, "").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function signature(value: unknown) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}-${(hash >>> 0).toString(36)}`;
}

function sourceLines(sources: WeeklySources) {
  const journalLines = sources.journals.flatMap((entry) => unique([
    ...htmlToLines(entry.content),
    ...htmlToLines(entry.reviewDesc),
    ...htmlToLines(entry.reviewAnalysis),
    ...htmlToLines(entry.reviewAction),
    ...htmlToLines(entry.touchEvent),
    ...htmlToLines(entry.touchWhy),
    ...htmlToLines(entry.touchAction),
    ...(entry.highlights ?? []).flatMap((item) => htmlToLines(item)),
  ]));
  const successLines = sources.successes.flatMap((entry) => htmlToLines(entry.content));
  const planLines = sources.plans.flatMap(({ plan }) => [
    ...(plan.tasks ?? []).map((task) => task.text),
    ...(plan.planned ?? []).map((row) => row.activity),
    ...(plan.actual ?? []).map((row) => row.activity),
    ...htmlToLines(plan.remarks),
    ...htmlToLines(plan.dictation),
    ...(plan.topPriorities ?? []),
  ].map((line) => line.trim()).filter(Boolean));
  const weeklyPriorityLines = sources.weeklyPriorities.map((line) => line.trim()).filter(Boolean);
  return {
    journalLines,
    successLines,
    planLines,
    all: [...journalLines, ...successLines, ...weeklyPriorityLines, ...planLines],
  };
}

function createTextBudget(total: number) {
  let remaining = total;
  return (value: string, itemLimit: number) => {
    if (remaining <= 0) return "";
    const normalized = value.replace(/\s+/g, " ").trim();
    const result = normalized.slice(0, Math.min(itemLimit, remaining));
    remaining -= result.length;
    return result;
  };
}

function plainRecordText(values: Array<string | undefined>) {
  return unique(values.flatMap((value) => htmlToLines(value ?? ""))).join("\n");
}

function metaCognitionSummary(entry: JournalEntry) {
  if (!entry.metaCognition) return "";
  return [
    entry.metaCognition.isObjective ? "复盘较客观" : "复盘客观性待校正",
    entry.metaCognition.isAvoidingCoreIssue ? "可能回避核心问题" : "未发现主动回避",
    entry.metaCognition.isConfidentInAction ? "对改进措施有信心" : "对改进措施信心不足",
  ].join("；");
}

function boundedPromptItems(
  values: string[],
  take: (value: string, itemLimit: number) => string,
) {
  return values
    .map((value) => take(plainRecordText([value]), 260))
    .filter(Boolean)
    .slice(0, 12);
}

function buildWeeklyReviewMaterial(
  weekStart: string,
  stats: WeeklyReviewStats,
): WeeklyReviewMaterial {
  const { weekEnd } = getWeekRange(weekStart);
  const sources = loadWeeklySources(weekStart, weekEnd);
  const takeJournal = createTextBudget(8_500);
  const takeSuccess = createTextBudget(5_500);
  const takePlan = createTextBudget(15_000);

  return {
    weekStart,
    weekEnd,
    weeklyPriorities: sources.weeklyPriorities,
    dailySummaries: sources.journals.map((entry) => ({
      date: entry.date,
      text: takeJournal(plainRecordText([
        entry.mood ? `心情：${entry.mood}` : "",
        entry.content,
        entry.reviewDesc,
        entry.reviewAnalysis,
        entry.reviewAction,
        entry.touchEvent,
        entry.touchWhy,
        entry.touchAction,
        metaCognitionSummary(entry),
        ...(entry.highlights ?? []),
      ]), 1_200),
    })),
    successJournals: sources.successes.map((entry) => ({
      date: entry.date,
      text: takeSuccess(plainRecordText([entry.content]), 800),
    })),
    dailyPlans: sources.plans.map(({ date, plan }) => {
      const tasks = plan.tasks ?? [];
      return {
        date,
        planned: boundedPromptItems([
          ...(plan.topPriorities ?? []),
          ...(plan.planned ?? []).map((row) => [row.time, row.activity].filter(Boolean).join(" ")),
        ], takePlan),
        actual: boundedPromptItems((plan.actual ?? []).map((row) => [
          row.time,
          row.activity,
          row.minutes ? `${row.minutes} 分钟` : "",
        ].filter(Boolean).join(" ")), takePlan),
        completed: boundedPromptItems(tasks.filter((task) => task.done).map((task) => task.text), takePlan),
        incomplete: boundedPromptItems(tasks.filter((task) => !task.done).map((task) => task.text), takePlan),
        remarks: buildRemarkItems(plan.remarks ?? "", plan.remarkChecks)
          .map((item) => ({ ...item, text: takePlan(item.text, 260) }))
          .filter((item) => item.text)
          .slice(0, 12),
      };
    }),
    stats,
  };
}

export function buildDoubaoWeeklyReviewPrompt(
  weekStart: string,
  stats: WeeklyReviewStats,
) {
  const material = buildWeeklyReviewMaterial(weekStart, stats);
  return `请根据下面这一周的个人记录，帮我完成一次有洞察的周复盘。

要求：
1. 综合分析每日总结、成功日记、每日安排和实际完成情况，不要只复述流水账。
2. 不要虚构记录中没有出现的事件、动机、因果或成果；证据不足时明确写“现有记录不足以判断”。
3. 找出反复出现的认知模式、进步证据、行动与目标之间的差距，以及可能被忽略的盲点。
4. 给出最多 3 条下周行动，每条都必须包含具体动作和可以检查的完成标准。
5. 最后必须总结前面所有分析，提炼为 1 至 2 句话、总计不超过 60 字的“本周结论”。结论必须同时包含本周最关键的认识和下周最重要的方向，简短有力，不重复前文，不写空泛口号。
6. 使用中文纯文本输出，不要使用 Markdown 符号，按以下六个标题依次书写；前五部分各 1 至 3 段，最后一部分严格遵守第 5 条：

认知模式
矛盾与原因
进步证据
可能盲点
下周可验证行动
本周结论

以下是本周记录：
${JSON.stringify(material, null, 2)}`;
}

function buildThemes(lines: string[]) {
  const sentences = unique(lines.flatMap((line) => line.split(/[。！？!?；;]/).map((item) => item.trim()).filter(Boolean)));
  const reflective = sentences.filter((sentence) => REFLECTION_WORDS.some((word) => sentence.includes(word)));
  const ranked = THEME_KEYWORDS.map((theme) => {
    const matches = sentences.filter((sentence) => theme.words.some((word) => sentence.includes(word)));
    return { ...theme, matches, score: matches.length };
  }).filter((theme) => theme.score > 0).sort((left, right) => right.score - left.score);

  const themes = ranked.slice(0, 3).map((theme) => {
    const evidence = theme.matches.find((item) => reflective.includes(item)) ?? theme.matches[0];
    return `${theme.name}：${compact(evidence)}`;
  });
  if (!themes.length && reflective.length) {
    return reflective.slice(0, 3).map((item) => `本周反思：${compact(item)}`);
  }
  return themes;
}

function elapsedDaysInWeek(weekStart: string, weekEnd: string) {
  const today = dateKey(new Date());
  if (weekStart > today) return 0;
  const lastDay = weekEnd < today ? weekEnd : today;
  return Math.min(7, Math.max(1, Math.round((parseDate(lastDay).getTime() - parseDate(weekStart).getTime()) / 86_400_000) + 1));
}

function generatedThought(progress: string[], improvement: string[], missed: string[], themes: string[]) {
  const theme = themes[0]?.split("：")[0] ?? "保持觉察并把想法落实为行动";
  const seen = progress[0] ?? "我已经开始为这一周留下真实记录";
  const gap = missed[0] ?? improvement[0] ?? "有些经历还需要更具体地记录和验证";
  const next = improvement[0] ?? "下周继续保留每日总结，并及时核对计划完成情况";
  return [
    `<p><strong>本周主题：</strong>${escapeHtml(theme)}</p>`,
    `<p><strong>我看见的进步：</strong>${escapeHtml(seen)}</p>`,
    `<p><strong>需要正视的地方：</strong>${escapeHtml(gap)}</p>`,
    `<p><strong>带到下周的实践：</strong>${escapeHtml(next)}</p>`,
  ].join("");
}

export function generateWeeklyReview(weekStart: string): WeeklyReview {
  const { weekEnd } = getWeekRange(weekStart);
  const sources = loadWeeklySources(weekStart, weekEnd);
  const lines = sourceLines(sources);
  const tasks = sources.plans.flatMap(({ plan }) => plan.tasks ?? []).filter((task) => task.text.trim());
  const completedTasks = tasks.filter((task) => task.done).length;
  const incompleteTasks = tasks.filter((task) => !task.done).map((task) => compact(task.text));
  const incompleteRemarks = sources.plans.flatMap(({ plan }) =>
    buildRemarkItems(plan.remarks ?? "", plan.remarkChecks).filter((item) => !item.done).map((item) => compact(item.text)),
  );
  const planWithoutActual = sources.plans.filter(({ plan }) =>
    (plan.planned ?? []).some((row) => row.time || row.activity.trim()) &&
    !(plan.actual ?? []).some((row) => row.time || row.activity.trim()),
  ).length;
  const elapsedDays = elapsedDaysInWeek(weekStart, weekEnd);
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : null;
  const stats: WeeklyReviewStats = {
    elapsedDays,
    journalDays: new Set(sources.journals.map((item) => item.date)).size,
    successDays: new Set(sources.successes.map((item) => item.date)).size,
    planDays: new Set(sources.plans.map((item) => item.date)).size,
    completedTasks,
    totalTasks: tasks.length,
    completionRate,
  };

  const progressPoints = unique([
    stats.journalDays ? `写下了 ${stats.journalDays} 天每日总结，已经形成可回看的复盘素材。` : "",
    stats.successDays ? `记录了 ${stats.successDays} 天成功日记，为自己的有效行动留下了证据。` : "",
    stats.totalTasks && stats.completedTasks ? `完成 ${stats.completedTasks}/${stats.totalTasks} 项计划，任务完成率为 ${stats.completionRate}%。` : "",
    lines.journalLines.length >= 5 ? `本周留下 ${lines.journalLines.length} 条日记要点，记录的具体程度在提高。` : "",
  ]);

  const improvementPoints = unique([
    elapsedDays > stats.journalDays ? `本周已过 ${elapsedDays} 天，其中 ${elapsedDays - stats.journalDays} 天尚无每日总结，可优先补记关键事件与原因。` : "",
    stats.totalTasks && completionRate !== null && completionRate < 80 ? `计划完成率为 ${completionRate}%，下周可减少同时推进的事项，先守住最重要的一件事。` : "",
    planWithoutActual ? `有 ${planWithoutActual} 天写了计划但没有记录实际完成情况，复盘时缺少结果证据。` : "",
    incompleteRemarks.length ? `仍有 ${incompleteRemarks.length} 条备注未完成，建议明确下一步动作或删除已经失效的事项。` : "",
    stats.successDays < Math.min(elapsedDays, 3) ? "成功日记样本较少，可以每天记录一件做对的小事，积累可复用的方法。" : "",
  ]);

  const missedPoints = unique([
    incompleteTasks.length ? `未完成事项：${incompleteTasks.slice(0, 4).join("；")}${incompleteTasks.length > 4 ? "等" : ""}。` : "",
    incompleteRemarks.length ? `未落实备注：${incompleteRemarks.slice(0, 4).join("；")}${incompleteRemarks.length > 4 ? "等" : ""}。` : "",
    planWithoutActual ? `${planWithoutActual} 天的计划没有对应的实际完成记录，执行结果未被确认。` : "",
  ]);

  const reflectionThemes = buildThemes(lines.all);
  if (!progressPoints.length) progressPoints.push("本周还没有足够记录，先从今天的一条总结或成功日记开始积累素材。");
  if (!improvementPoints.length) improvementPoints.push("继续保持当前记录节奏，并把每次反思落实为一个可检查的下一步动作。");
  if (!missedPoints.length) missedPoints.push("现有记录中没有发现明确的未完成事项；可补充失败尝试和原因，让复盘更完整。");
  if (!reflectionThemes.length) reflectionThemes.push("记录与觉察：素材暂时不足，建议写清事件、原因、感受和下一步行动。");

  const now = new Date().toISOString();
  return {
    weekStart,
    weekEnd,
    stats,
    progressPoints,
    improvementPoints,
    missedPoints,
    reflectionThemes,
    weeklyThought: generatedThought(progressPoints, improvementPoints, missedPoints, reflectionThemes),
    sourceSignature: signature(sources),
    generatedAt: now,
    updatedAt: now,
  };
}

export function listWeeklyReviews(): WeeklyReview[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.weeklyReviews) ?? "[]") as WeeklyReview[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.weekStart && item?.weekEnd).sort((a, b) => b.weekStart.localeCompare(a.weekStart)) : [];
  } catch {
    return [];
  }
}

export function findWeeklyReview(weekStart: string) {
  return listWeeklyReviews().find((review) => review.weekStart === weekStart);
}

export function saveWeeklyReview(review: WeeklyReview) {
  const saved = { ...review, updatedAt: new Date().toISOString() };
  const next = [
    saved,
    ...listWeeklyReviews().filter((item) => item.weekStart !== review.weekStart),
  ];
  window.localStorage.setItem(STORAGE_KEYS.weeklyReviews, JSON.stringify(next));
  window.dispatchEvent(new Event(STORAGE_EVENTS.weeklyReviewsChanged));
  return saved;
}

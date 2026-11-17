export const newsSections = [
  { title: "AI 与前沿", topics: ["AI", "前沿研究"] },
  { title: "市场观察", topics: ["黄金", "纳指与标普500", "A股与宏观"] },
  { title: "时政与国际", topics: ["中国", "美国", "俄罗斯", "其他国际要闻"] },
] as const;

export type NewsTopic = (typeof newsSections)[number]["topics"][number] | "中美俄" | "AI政策";

export type NewsItem = {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  context?: string;
  next?: { text: string; source: string; url: string };
};

export type NewsBrief = {
  date: string;
  generatedAt: string;
  items: Partial<Record<NewsTopic, NewsItem>>;
  order?: NewsTopic[];
};

export function orderedNews(brief: NewsBrief) {
  const order = brief.order ?? newsSections.flatMap((section) => [...section.topics]);
  return order.flatMap((topic) => {
    const item = brief.items[topic];
    return item ? [{ ...item, topic }] : [];
  });
}

export function formatNewsTime(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: "Asia/Shanghai" }).format(new Date(date));
}

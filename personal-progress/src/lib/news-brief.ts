const newsSections = [
  { id: "politics", title: "中美俄与国际", topics: ["中美俄", "中国", "美国", "俄罗斯", "其他国际要闻"] },
  { id: "markets", title: "市场观察", topics: ["纳指与标普500", "黄金", "A股与宏观"] },
  { id: "technology", title: "AI 与前沿", topics: ["AI政策", "AI", "前沿研究"] },
] as const;

export type NewsTopic = (typeof newsSections)[number]["topics"][number];

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

export function groupedNews(brief: NewsBrief) {
  return newsSections.flatMap(({ id, title, topics }) => {
    const category: readonly NewsTopic[] = topics;
    const stories = (brief.order ?? category).flatMap((topic) => {
      const item = brief.items[topic];
      return item && category.includes(topic) ? [{ ...item, topic }] : [];
    });
    return stories.length ? [{ id, title, stories }] : [];
  });
}

export function formatNewsTime(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: "Asia/Shanghai" }).format(new Date(date));
}

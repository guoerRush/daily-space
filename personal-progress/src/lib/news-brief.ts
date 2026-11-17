export const newsSections = [
  { title: "AI 与前沿", topics: ["AI", "前沿研究"] },
  { title: "市场观察", topics: ["黄金", "纳指与标普500", "A股与宏观"] },
  { title: "时政与国际", topics: ["中国", "美国", "俄罗斯", "其他国际要闻"] },
] as const;

export type NewsTopic = (typeof newsSections)[number]["topics"][number];

export type NewsBrief = {
  date: string;
  generatedAt: string;
  items: Partial<Record<NewsTopic, {
    title: string;
    summary: string;
    source: string;
    url: string;
    publishedAt: string;
  }>>;
};

export const marketWatch: Partial<Record<NewsTopic, string>> = {
  黄金: "观察美元、美国实际利率与避险需求。美元或实际利率走高时，金价通常会承压。",
  纳指与标普500: "关注美债收益率与企业财报。科技股权重较高，纳指对大型科技公司业绩更敏感。",
  A股与宏观: "关注国内经济数据、政策落地和人民币汇率变化。",
};

export function formatNewsTime(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: "Asia/Shanghai" }).format(new Date(date));
}

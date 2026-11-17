import { type NewsBrief } from "@/lib/news-brief";

const november17: Omit<NewsBrief, "generatedAt"> = {
  date: "2026-11-17",
  order: ["中美俄", "纳指与标普500", "黄金", "AI政策", "AI"],
  items: {
    中美俄: {
      title: "中美俄元首将于 11 月 19 日在深圳会晤",
      summary: "中国外交部宣布，习近平将在深圳同俄罗斯总统普京、美国总统特朗普举行三方会晤。公告确认了日期和地点，具体议程尚未公布。",
      context: "观察三方会后是否就国际安全等议题发布共同声明。",
      source: "中国外交部",
      url: "https://www.fmprc.gov.cn/wjdt_674879/wsrc_674883/202611/t20261116_12059654.shtml",
      publishedAt: "2026-11-16T00:00:00+08:00",
    },
    纳指与标普500: {
      title: "美股科技股领跌，纳指跌 2.49%",
      summary: "美东时间 11 月 16 日收盘，纳斯达克综合指数报 24,509.76 点，跌 2.49%。标普 500 报 7,416.59 点，跌 1.92%。英伟达与多家芯片股走弱。",
      context: "英伟达对下季收入和 AI 芯片需求的展望，可能影响后续科技股情绪。",
      next: {
        text: "北京时间 11 月 18 日约 05:20，英伟达将公布财报。",
        source: "英伟达投资者关系",
        url: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/default.aspx",
      },
      source: "美联社",
      url: "https://apnews.com/article/2e6a9c41b6336e9240c1b01585d20cd4",
      publishedAt: "2026-11-16T16:00:00-05:00",
    },
    黄金: {
      title: "现货黄金触及逾一年低位",
      summary: "据路透社，美东时间 11 月 16 日 13:45，现货黄金报 3,848.51 美元／盎司，跌 0.8%，盘中一度触及约 3,830 美元。",
      context: "路透社将这轮下跌与美元走强及市场对美联储 12 月加息的预期联系起来。",
      next: {
        text: "北京时间 11 月 19 日 03:00，美联储公布 10 月议息会议纪要。",
        source: "美联储日历",
        url: "https://www.federalreserve.gov/newsevents/2026-November.htm",
      },
      source: "路透社（MarketScreener 转载）",
      url: "https://ca.marketscreener.com/news/gold-hits-over-one-year-low-on-resilient-dollar-as-hawkish-fed-bets-build-ce785eded08df22c",
      publishedAt: "2026-11-16T13:45:00-05:00",
    },
    AI政策: {
      title: "美国公布针对先进 AI 芯片远程访问的规则",
      summary: "美国商务部工业与安全局发布临时最终规则，对部分境外数据中心向受限对象提供大量先进算力的远程访问设立许可要求。",
      context: "部分中国 AI 企业通过境外云服务获取高端算力可能更难，实际适用范围取决于规则中的收件方、算力规模等条件。",
      source: "美国商务部工业与安全局",
      url: "https://www.bis.gov/press-release/bis-issues-rule-addressing-remote-access-american-super-intelligence-technology",
      publishedAt: "2026-11-16T05:00:00Z",
    },
    AI: {
      title: "阿里巴巴发布旗舰模型 Qwen4-Max",
      summary: "阿里巴巴发布 Qwen4-Max，并通过旗下平台和 API 提供。阿里称，新模型在其专业任务评测中消耗更少的词元，平均任务成本下降。",
      context: "对使用者更有参考价值的是，同类任务的完成质量与实际调用成本能否同时改善。",
      source: "阿里云官方公告",
      url: "https://www.alibabacloud.com/en/press-room/alibaba-unveils-qwen4-max",
      publishedAt: "2026-11-16T00:00:00+08:00",
    },
  },
};

export function getEditorialNews(date: string): NewsBrief | null {
  if (date !== november17.date) return null;
  return { ...november17, generatedAt: new Date().toISOString() };
}

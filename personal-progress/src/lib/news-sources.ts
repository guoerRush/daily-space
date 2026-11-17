import { formatNewsTime, type NewsBrief, type NewsItem, type NewsTopic } from "@/lib/news-brief";

type Article = NewsItem;
const chinanews = "https://www.chinanews.com.cn/rss/";
const cls = "https://api3.cls.cn/share/subject/";
const xinhua = "https://www.news.cn";
const day = 86_400_000;

function plain(raw: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", emsp: " " };
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (!code.startsWith("#")) return entities[code] ?? entity;
      const value = code.startsWith("#x") ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : "";
    })
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function shortSummary(raw: string, limit = 125) {
  const body = plain(raw).replace(/^(?:中新网|中新社|IT之家|财联社)[^，。]{0,30}?(?:消息|电)[， ：]?(?:\([^)]*\)\s*)?/, "");
  const sentence = body.match(new RegExp(`^.{14,${limit}}?[。！？]`, "u"))?.[0];
  return sentence ?? (body.length <= limit ? body : `${body.slice(0, limit - 1)}…`);
}

function articleUrl(raw: string, origin: string, hosts: string[]) {
  try {
    const url = new URL(plain(raw), origin);
    if (!hosts.includes(url.hostname) || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    url.protocol = "https:";
    return url.href;
  } catch {
    return "";
  }
}

async function readSource(url: string, cache = true) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7_000), ...(cache ? { next: { revalidate: 900 } } : { cache: "no-store" }) });
    return response.ok ? await response.text() : "";
  } catch {
    return "";
  }
}

async function readRss(url: string, source: string, hosts: string[]): Promise<Article[]> {
  const xml = await readSource(url);
  return Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).slice(0, 80).flatMap(([, item]) => {
    const tag = (name: string) => item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "";
    const title = plain(tag("title"));
    const link = articleUrl(tag("link"), url, hosts);
    const time = Date.parse(plain(tag("pubDate")));
    return title && link && Number.isFinite(time) ? [{
      title, url: link, source, publishedAt: new Date(time).toISOString(), summary: shortSummary(tag("description")),
    }] : [];
  });
}

async function readXinhua(channel: string): Promise<Article[]> {
  const html = await readSource(`${xinhua}/${channel}/`);
  const links = html.matchAll(/<a\s[^>]*\bhref=["']([^"']+)["'][^>]*>([^<]{8,})<\/a>/gi);
  return Array.from(links).flatMap(([, href, rawTitle]) => {
    const url = articleUrl(href, xinhua, ["www.news.cn"]);
    const date = url.match(/\/(20\d\d)(\d\d)(\d\d)\/[\da-f]+\/c\.html/);
    if (!date) return [];
    const time = Date.parse(`${date[1]}-${date[2]}-${date[3]}T00:00:00+08:00`);
    return Number.isFinite(time) ? [{
      url, title: plain(rawTitle), source: "新华网", publishedAt: new Date(time).toISOString(), summary: "",
    }] : [];
  });
}

async function readCls(id: number): Promise<Article[]> {
  const url = `${cls}${id}?os=ios&sv=899`;
  const html = await readSource(url);
  return Array.from(html.matchAll(/<li\b[^>]*class="[^"]*\bsubject-list\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)).flatMap(([, item]) => {
    const title = plain(item.match(/class="[^"]*subject-telegraph-list-title[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    const raw = plain(item.match(/class="subject-list-text-content"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const sentences = raw.match(/[^。！？]+[。！？]?/g) ?? [];
    const quote = id === 1483 && sentences.find((line) => /[\d,.]+\s*美元\s*[/／]\s*盎司|每盎司\s*[\d,.]+\s*美元/.test(line) && /金价|黄金|伦敦金/.test(line));
    const driver = id === 1483 && sentences.find((line) => /推动|压制|承压|受.*影响/.test(line) && /美元|美债|通胀|美联储/.test(line) && line.length <= 125);
    const summary = shortSummary(quote || raw, 155);
    const articleId = item.match(/href="\/share\/article\/(\d+)/)?.[1];
    const time = Number(item.match(/data-ctime="(\d+)"/)?.[1]) * 1_000;
    if (!summary || !Number.isFinite(time)) return [];
    return [{
      title: title || summary, summary: title ? summary : "", source: "财联社",
      url: articleId ? `https://www.cls.cn/detail/${articleId}` : url, publishedAt: new Date(time).toISOString(),
      ...(driver && driver !== quote ? { context: `据财联社报道，${shortSummary(driver)}` } : {}),
    }];
  });
}

async function readDiplomacy(now: Date): Promise<Article[]> {
  const index = "https://www.mfa.gov.cn/wjdt_674879/wsrc_674883/";
  const list = await readSource(index);
  const entries = Array.from(list.matchAll(/href="(\.\/\d{6}\/t(20\d{6})_\d+\.shtml)"[^>]*>([^<]+)</g));
  const recent = entries.flatMap(([, href, date, rawTitle]) => {
    const time = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00+08:00`);
    const url = articleUrl(href, index, ["www.mfa.gov.cn"]);
    if (!url || !Number.isFinite(time) || now.getTime() - time > 4 * day || time > now.getTime()) return [];
    return [{ title: plain(rawTitle).replace(/（\d{4}-\d{2}-\d{2}）$/, ""), url, time }];
  }).slice(0, 6);
  return Promise.all(recent.map(async ({ title, url, time }) => {
    const html = await readSource(url);
    const raw = html.match(/class="[^"<>]*\btrs_word\b[^"<>]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const summary = shortSummary(plain(raw).replace(/^外交部发言人[^：]{0,20}：\s*/, ""));
    return { title, url, publishedAt: new Date(time).toISOString(), source: "中国外交部", summary: summary === title ? "" : summary };
  }));
}

async function readBIS(): Promise<Article[]> {
  // The listing is larger than the Next.js Data Cache entry limit.
  const html = await readSource("https://www.bis.gov/news-updates", false);
  const entries = Array.from(html.matchAll(/<li data-date="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)).slice(0, 15);
  return entries.flatMap(([, date, card]) => {
    const link = card.match(/href="(\/press-release\/[^"#?]+)"/);
    const headline = plain(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "");
    const time = Date.parse(date);
    if (!link || !headline || !Number.isFinite(time) || !/chip|semiconductor|advanced computing|export control|AI models|super intelligence/i.test(headline)) return [];
    const remote = /remote access/i.test(headline);
    return [{
      title: remote ? "美国 BIS 公布针对先进算力远程访问的规则" : `美国 BIS 发布出口管制动态｜${headline}`,
      summary: remote ? "美国商务部工业与安全局发布临时最终规则，涉及对先进芯片和服务器的远程访问。" : "适用产品、对象及生效日期以公告和规则原文为准。",
      ...(remote ? { context: "关注境外云算力服务商是否需要核查客户资格和申请许可。" } : {}),
      source: "美国商务部工业与安全局",
      url: new URL(link[1], "https://www.bis.gov").href,
      publishedAt: new Date(time).toISOString(),
    }];
  });
}

async function readAlibaba(): Promise<Article[]> {
  const index = "https://www.alibabacloud.com/en/press-room";
  const html = await readSource(index);
  return Array.from(html.matchAll(/\{"heading":"([^"\\]*(?:\\.[^"\\]*)*)","date":"([^"]+)","year":"(20\d\d)","readMoreLink":"([^"]+)"/g)).slice(0, 25).flatMap(([, title, monthDay, year, rawUrl]) => {
    const model = title.match(/\bQwen[\w.-]+/i)?.[0];
    const url = articleUrl(rawUrl, index, ["www.alibabacloud.com"]);
    const date = new Date(`${monthDay}, ${year} 00:00:00 GMT+0800`);
    if (!model || !url || !Number.isFinite(date.getTime()) || !/releases?|unveils?|launches?|introduces?/i.test(title)) return [];
    return [{
      title: `阿里巴巴发布 ${model} 模型`, summary: "发布公告列出了模型能力、使用入口和阿里巴巴的评测结果。",
      context: "比较自己常用任务中的完成质量和单次成本，再判断升级是否划算。",
      source: "阿里云官方公告", url, publishedAt: date.toISOString(),
    }];
  });
}

type FedEvent = { title?: string; month?: string; days?: string; time?: string };

function fedEventTime(event: FedEvent) {
  const clock = event.time?.match(/^(\d{1,2}):(\d{2})\s*([ap])\.m\.$/i);
  if (!clock || !/^\d{4}-\d{2}$/.test(event.month ?? "") || !/^\d{1,2}$/.test(event.days ?? "")) return null;
  const date = `${event.month}-${event.days!.padStart(2, "0")}`;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`)).find((part) => part.type === "timeZoneName")?.value.slice(3);
  const hour = Number(clock[1]) % 12 + (clock[3].toLowerCase() === "p" ? 12 : 0);
  const time = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${clock[2]}:00${offset ?? ""}`);
  return offset && Number.isFinite(time) ? time : null;
}

async function readFedAgenda(now: Date): Promise<NewsItem["next"]> {
  const source = "https://www.federalreserve.gov/json/calendar.json";
  try {
    const { events } = JSON.parse(await readSource(source)) as { events?: FedEvent[] };
    const titles: Record<string, string> = { "FOMC Minutes": "美联储公布议息会议纪要", "FOMC Press Conference": "美联储举行议息会议记者会" };
    const agenda = (events ?? []).flatMap((event) => {
      const title = event.title && titles[event.title];
      const time = fedEventTime(event);
      return title && time && time >= now.getTime() && time - now.getTime() <= 3 * day ? [{ title, time }] : [];
    }).sort((a, b) => a.time - b.time);
    const event = agenda[0];
    if (event) return { text: `北京时间 ${formatNewsTime(new Date(event.time).toISOString(), { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}，${event.title}。`, source: "美联储日历", url: "https://www.federalreserve.gov/newsevents/calendar.htm" };
  } catch {
    // Market reports remain useful when the calendar is unavailable.
  }
}

export async function buildNewsBrief(date: string, now = new Date()): Promise<NewsBrief> {
  const cns = (channel: string) => readRss(`${chinanews}${channel}.xml`, "中新网", ["www.chinanews.com.cn", "www.chinanews.com"]);
  const [tech, it, finance, china, world, xinhuaWorld, usClose, globalFinance, goldNews, diplomacy, bis, alibaba, fedAgenda] = await Promise.all([
    readXinhua("tech"), readRss("https://www.ithome.com/rss/", "IT之家", ["www.ithome.com", "m.ithome.com"]),
    cns("finance"), cns("china"), cns("world"), readXinhua("world"), readCls(7373), readCls(1556), readCls(1483),
    readDiplomacy(now), readBIS(), readAlibaba(), readFedAgenda(now),
  ]);
  const items: NewsBrief["items"] = {};
  const used = new Set<string>();
  const pick = (topic: NewsTopic, sources: Article[], match: RegExp, priority?: RegExp, maxAge = 3 * day) => {
    const eligible = sources.filter((article) => {
      const age = now.getTime() - Date.parse(article.publishedAt);
      return age >= 0 && age <= maxAge && match.test(`${article.title} ${article.summary}`) && !used.has(article.title);
    });
    const ranked = eligible.sort((a, b) => {
      const score = (item: Article) => {
        const original = /中国外交部|阿里云官方公告/.test(item.source) ? day / 2 : 0;
        return Date.parse(item.publishedAt) + original + (priority?.test(`${item.title} ${item.summary}`) ? day : 0);
      };
      return score(b) - score(a);
    });
    const selected = ranked[0];
    if (selected) {
      items[topic] = selected;
      used.add(selected.title);
    }
  };
  pick("中美俄", diplomacy, /中俄美|中美俄|中俄|中美|俄美|美国总统|俄罗斯总统/, /元首|会晤|联合声明|会谈/);
  pick("AI政策", bis, /芯片|算力|管制/, /芯片|算力/, 2 * day);
  const modelRelease = /(?:发布|推出|开源).{0,22}(?:模型|Claude|Gemini|GPT|Qwen|DeepSeek)|(?:Claude|Gemini|GPT|Qwen|DeepSeek).{0,22}(?:发布|上线|开源|推出)/i;
  const confirmedReleases = [...tech, ...it].filter((item) => modelRelease.test(item.title) && !/开箱|国补|AI-HDR|传闻|消息称|网络攻击|出口管制/.test(item.title));
  pick("AI", [...alibaba, ...confirmedReleases], /模型|Qwen|Claude|Gemini|GPT|DeepSeek/i, /发布|开源|技术报告/);
  pick("前沿研究", [...tech, ...xinhuaWorld, ...finance, ...it].filter((item) => !/泄露|停机|非法访问/.test(item.title)), /研究[:：]|研究发现|研究团队|量子|航天|基因编辑|可控核聚变|6G|超算|具身智能|科研|实验突破/i, /实验|量子|基因|研究发现|超算/, 5 * day);
  const goldTerms = /金价|现货金|黄金期[货价]|纽约黄金|黄金价格|金银价格/;
  pick("黄金", [...goldNews, ...globalFinance, ...finance, ...world].filter((item) => !/目标价|唱多|唱空|饰品|黄金股|投资展望/.test(item.title)), goldTerms, /逾一年|年新[低高]|最低水平|强势美元|美元走[强弱]|利率预期|通胀/, 2 * day);
  const gold = items.黄金;
  if (gold && !goldTerms.test(gold.title)) {
    const fact = gold.summary.split(/[；。]/).find((part) => goldTerms.test(part));
    if (fact) items.黄金 = { ...gold, title: fact, summary: "" };
  }
  if (items.黄金 && fedAgenda) items.黄金 = { ...items.黄金, next: fedAgenda };
  pick("纳指与标普500", usClose.filter((item) => {
    const report = `${item.title} ${item.summary}`;
    return /标普\s*500|标准普尔\s*500/.test(report) && /纳斯达克综合|纳指/.test(report);
  }), /标普|纳斯达克|纳指/, /收盘|收涨|收跌|股指低开低走/, 4 * day);
  if (!items.纳指与标普500) pick("纳指与标普500", [...globalFinance, ...world].filter((item) => !/期货|盘前|盘中/.test(item.title)), /标普|纳斯达克|纳指|美股三大|纽约股市/, /收盘|收涨|收跌/, 2 * day);
  pick("A股与宏观", finance, /A股|沪指|创业板|美联储|国家统计局|央行|商务部|汇率|GDP/i, /A股|收盘|美联储|国家统计局/);
  pick("中国", [...diplomacy, ...china], /习近平|国务院|中央|外交部|全国人大|商务部|政策|会见|APEC/i, /习近平|国务院|外交部|全国人大/);
  pick("俄罗斯", [...world, ...xinhuaWorld], /俄罗斯|俄方|俄美|俄乌|俄称|普京|克里姆林宫|对俄/, /谈判|会谈|制裁|俄乌|普京/);
  const usPolitics = /特朗普|白宫|美国务院|美政府|美法官|中美|美国.{0,20}(法案|政策|制裁|政府|总统|国会|法院|关税)/;
  pick("美国", [...world, ...xinhuaWorld].filter((item) => usPolitics.test(item.title)), usPolitics, /白宫|特朗普|国会|美国务院|中美/);
  pick("其他国际要闻", [...world, ...xinhuaWorld], /联合国|欧盟|中东|伊朗|以色列|政府|会谈|总统|制裁|政局/, /联合国|停火|总统|制裁|会谈/);

  const cutoff = now.getTime() - 36 * 60 * 60 * 1000;
  const politics: NewsTopic[] = ["中国", "美国", "俄罗斯", "其他国际要闻"];
  politics.sort((a, b) => {
    const score = (topic: NewsTopic) => {
      const item = items[topic];
      if (!item) return 0;
      const major = /元首|总统|选举|国会|峰会|会谈|制裁|关税|停火|联合声明|政策/.test(item.title);
      return Date.parse(item.publishedAt) + (major ? day : 0);
    };
    return score(b) - score(a);
  });
  const lead = items.中美俄 ? "中美俄" : politics.find((topic) => Date.parse(items[topic]?.publishedAt ?? "") >= cutoff);
  const candidates: (NewsTopic | undefined)[] = [lead, "纳指与标普500", "黄金", "AI政策", "AI", "前沿研究", "A股与宏观", ...politics];
  const order = [...new Set(candidates.filter((topic): topic is NewsTopic => Boolean(topic && items[topic])))].slice(0, 5);
  const selected: NewsBrief["items"] = {};
  for (const topic of order) selected[topic] = items[topic];

  await Promise.all(Object.entries(selected).map(async ([topic, item]) => {
    if (item.source === "阿里云官方公告") {
      const html = await readSource(item.url);
      const text = plain(html);
      const facts = [
        /1[- ]million[- ]token context|1M[- ]token context/i.test(text) && "官方公告称，模型支持约 100 万词元的上下文。",
        /fewer tokens|fewer activated parameters/i.test(text) && "阿里称，部分能力或成本指标较上一代改善，具体口径见官方评测。",
      ].filter(Boolean);
      if (facts.length) selected[topic as NewsTopic] = { ...item, summary: facts.join("") };
      return;
    }
    if (item.summary || item.source !== "新华网") return;
    const html = await readSource(item.url);
    const lead = html.match(/id="detailContent"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
    selected[topic as NewsTopic] = { ...item, summary: shortSummary(lead) };
  }));
  return { date, generatedAt: now.toISOString(), items: selected, order };
}

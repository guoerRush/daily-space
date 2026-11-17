import { type NewsBrief, type NewsTopic } from "@/lib/news-brief";

type Article = NonNullable<NewsBrief["items"][NewsTopic]>;
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

function shortSummary(raw: string) {
  const body = plain(raw).replace(/^(?:中新网|中新社|IT之家|财联社)[^，。]{0,30}?(?:消息|电)[， ：]?(?:\([^)]*\)\s*)?/, "");
  const sentence = body.match(/^.{14,95}?[。！？]/u)?.[0];
  return sentence ?? (body.length <= 95 ? body : `${body.slice(0, 92)}…`);
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

async function readSource(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7_000), next: { revalidate: 900 } });
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
  return Array.from(html.matchAll(/<li\b[^>]*class="[^"]*\bsubject-list-telegraph\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)).flatMap(([, item]) => {
    const title = plain(item.match(/class="[^"]*subject-telegraph-list-title[^"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    const summary = shortSummary(item.match(/class="subject-list-text-content"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const id = item.match(/href="\/share\/article\/(\d+)/)?.[1];
    const time = Number(item.match(/data-ctime="(\d+)"/)?.[1]) * 1_000;
    if (!summary || !Number.isFinite(time)) return [];
    return [{ title: title || summary, summary: title ? summary : "", source: "财联社", url: id ? `https://www.cls.cn/detail/${id}` : url, publishedAt: new Date(time).toISOString() }];
  });
}

export async function buildNewsBrief(date: string, now = new Date()): Promise<NewsBrief> {
  const cns = (channel: string) => readRss(`${chinanews}${channel}.xml`, "中新网", ["www.chinanews.com.cn", "www.chinanews.com"]);
  const [tech, it, finance, china, world, xinhuaWorld, usClose, globalFinance] = await Promise.all([
    readXinhua("tech"), readRss("https://www.ithome.com/rss/", "IT之家", ["www.ithome.com", "m.ithome.com"]),
    cns("finance"), cns("china"), cns("world"), readXinhua("world"), readCls(7373), readCls(1556),
  ]);
  const items: NewsBrief["items"] = {};
  const used = new Set<string>();
  const pick = (topic: NewsTopic, sources: Article[], match: RegExp, priority?: RegExp, maxAge = 3 * day) => {
    const eligible = sources.filter((article) => {
      const age = now.getTime() - Date.parse(article.publishedAt);
      return age >= 0 && age <= maxAge && match.test(`${article.title} ${article.summary}`) && !used.has(article.title);
    });
    const ranked = eligible.sort((a, b) => {
      const score = (item: Article) => Date.parse(item.publishedAt) + (priority?.test(item.title) ? day : 0);
      return score(b) - score(a);
    });
    const selected = ranked[0];
    if (selected) {
      items[topic] = selected;
      used.add(selected.title);
    }
  };
  pick("AI", [...tech, ...it].filter((item) => !/开箱|国补|AI-HDR/.test(item.title)), /人工智能|大模型|生成式|OpenAI|Anthropic|Gemini|机器学习|算力|\bAI\b/i, /大模型|开源|人工智能|模型泛化/);
  pick("前沿研究", [...tech, ...xinhuaWorld, ...finance, ...it].filter((item) => !/泄露|停机|非法访问/.test(item.title)), /研究[:：]|研究发现|研究团队|量子|航天|基因编辑|可控核聚变|6G|超算|具身智能|科研|实验突破/i, /实验|量子|基因|研究发现|超算/, 5 * day);
  const goldTerms = /金价|现货金|黄金期[货价]|纽约黄金|黄金价格|金银价格/;
  pick("黄金", [...globalFinance, ...finance, ...world], goldTerms);
  const gold = items.黄金;
  if (gold && !goldTerms.test(gold.title)) {
    const fact = gold.summary.split(/[；。]/).find((part) => goldTerms.test(part));
    if (fact) items.黄金 = { ...gold, title: fact, summary: "" };
  }
  pick("纳指与标普500", [...usClose, ...globalFinance, ...world], /标普|纳斯达克|纳指|美股三大|纽约股市/, /收盘|收涨|收跌|股指低开低走/);
  pick("A股与宏观", finance, /A股|沪指|创业板|美联储|国家统计局|央行|商务部|汇率|GDP/i, /A股|收盘|美联储|国家统计局/);
  pick("中国", china, /习近平|国务院|中央|外交部|全国人大|商务部|政策|会见|APEC/i, /习近平|国务院|外交部|全国人大/);
  pick("俄罗斯", [...world, ...xinhuaWorld], /俄罗斯|俄方|俄美|俄乌|俄称|普京|克里姆林宫|对俄/, /谈判|会谈|制裁|俄乌|普京/);
  const usPolitics = /特朗普|白宫|美国务院|美政府|美法官|中美|美国.{0,20}(法案|政策|制裁|政府|总统|国会|法院|关税)/;
  pick("美国", [...world, ...xinhuaWorld].filter((item) => usPolitics.test(item.title)), usPolitics, /白宫|特朗普|国会|美国务院|中美/);
  pick("其他国际要闻", [...world, ...xinhuaWorld], /联合国|欧盟|中东|伊朗|以色列|政府|会谈|总统|制裁|政局/, /联合国|停火|总统|制裁|会谈/);

  await Promise.all(Object.entries(items).map(async ([topic, item]) => {
    if (item.summary || item.source !== "新华网") return;
    const html = await readSource(item.url);
    const lead = html.match(/id="detailContent"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
    items[topic as NewsTopic] = { ...item, summary: shortSummary(lead) };
  }));
  return { date, generatedAt: now.toISOString(), items };
}

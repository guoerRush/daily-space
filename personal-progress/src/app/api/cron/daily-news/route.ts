import { timingSafeEqual } from "node:crypto";
import { sendFeishuReminder } from "@/lib/feishu";
import { todayKey } from "@/lib/journals";
import { marketWatch, newsSections, type NewsBrief } from "@/lib/news-brief";
import { claimNewsDelivery, publishNews, readPublishedNews } from "@/lib/news-editions";
import { buildNewsBrief } from "@/lib/news-sources";

export const maxDuration = 45;

function message(brief: NewsBrief) {
  const lines = [`日常留白 · ${brief.date} 每日新闻（北京时间）`];
  for (const section of newsSections) {
    lines.push(`\n【${section.title}】`);
    for (const topic of section.topics) {
      const item = brief.items[topic];
      if (!item) {
        lines.push(`${topic} · 暂无符合条件的近期报道`);
        continue;
      }
      lines.push(`${topic} · ${item.title}`);
      if (item.summary && item.summary !== item.title) lines.push(item.summary);
      lines.push(`${item.source} ${item.url}`);
    }
  }
  lines.push(`\n市场关注点\n${Object.values(marketWatch).join("\n")}`);
  lines.push("\n查看简报：https://daily-space-six.vercel.app/#daily-news");
  return lines.join("\n");
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || expected.length !== authorization.length || !timingSafeEqual(expected, authorization)) {
    return Response.json({ message: "未授权的定时任务请求。" }, { status: 401 });
  }

  try {
    const date = todayKey();
    let brief = await readPublishedNews(date);
    if (!brief) {
      const draft = await buildNewsBrief(date);
      if (Object.keys(draft.items).length === 0) {
        return Response.json({ message: "新闻来源暂不可用。" }, { status: 503 });
      }
      brief = await publishNews(draft);
    }

    const release = await claimNewsDelivery(date);
    if (!release) return Response.json({ status: "already_claimed", date });
    const result = await sendFeishuReminder(message(brief));
    if (!result.ok) {
      await release();
      console.error("Daily news Feishu delivery failed", result.message);
      return Response.json({ message: "飞书简报发送失败。" }, { status: 503 });
    }
    return Response.json({ status: "sent", date, count: Object.keys(brief.items).length });
  } catch (error) {
    console.error("Daily news job failed", error instanceof Error ? error.message : "storage error");
    return Response.json({ message: "简报暂未完成发布。" }, { status: 503 });
  }
}

import { timingSafeEqual } from "node:crypto";
import { sendFeishuReminder } from "@/lib/feishu";
import { todayKey } from "@/lib/journals";
import { orderedNews, type NewsBrief } from "@/lib/news-brief";
import { claimNewsDelivery, publishNews, readPublishedNews } from "@/lib/news-editions";
import { getEditorialNews } from "@/lib/news-editorial";
import { buildNewsBrief } from "@/lib/news-sources";

export const maxDuration = 45;

function message(brief: NewsBrief) {
  const lines = [`日常留白 · ${brief.date} 晨间简报（北京时间）`];
  orderedNews(brief).forEach((item, index) => {
    lines.push(`\n${index + 1}. ${item.title}`);
    if (item.summary && item.summary !== item.title) lines.push(item.summary);
    if (item.context) lines.push(`关注点 · ${item.context}`);
    if (item.next) lines.push(`${item.next.text} ${item.next.source} ${item.next.url}`);
    lines.push(`${item.source} ${item.url}`);
  });
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
      const draft = getEditorialNews(date) ?? await buildNewsBrief(date);
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

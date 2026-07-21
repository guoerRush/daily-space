import { NextRequest, NextResponse } from "next/server";
import { sendFeishuReminder } from "@/lib/feishu";

function beijingTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { time?: string; message?: string; scheduled?: boolean };
  const time = /^\d{2}:\d{2}$/.test(body.time ?? "") ? body.time : "21:50";
  const reminderMessage = body.message?.trim().slice(0, 500) || "留出几分钟记录今天的生活与思考。";
  const text = body.scheduled
    ? `日常留白：北京时间现在是 ${beijingTime()}，这是 ${time} 的提醒。${reminderMessage}`
    : `日常留白：飞书提醒连接成功。提醒时间 ${time}，${reminderMessage}`;
  const result = await sendFeishuReminder(text);
  return NextResponse.json(
    result.ok ? { message: "测试提醒已发送，请查看飞书群。" } : { message: result.message },
    { status: result.ok ? 200 : 503 },
  );
}

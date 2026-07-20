import { NextRequest, NextResponse } from "next/server";
import { sendFeishuReminder } from "@/lib/feishu";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { time?: string; message?: string; scheduled?: boolean };
  const time = /^\d{2}:\d{2}$/.test(body.time ?? "") ? body.time : "21:50";
  const reminderMessage = body.message?.trim().slice(0, 500) || "留出几分钟记录今天的生活与思考。";
  const text = body.scheduled ? `日常留白：现在是 ${time}，${reminderMessage}` : `日常留白：飞书提醒连接成功。今晚 ${time}，${reminderMessage}`;
  const result = await sendFeishuReminder(text);
  return NextResponse.json(
    result.ok ? { message: "测试提醒已发送，请查看飞书群。" } : { message: result.message },
    { status: result.ok ? 200 : 503 },
  );
}

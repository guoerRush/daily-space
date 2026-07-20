import { NextRequest, NextResponse } from "next/server";
import { sendFeishuReminder } from "@/lib/feishu";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "未授权的定时任务请求。" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const suffix = appUrl ? `\n打开记录：${appUrl}` : "";
  const result = await sendFeishuReminder(`日常留白：晚上好，花 5 分钟写下今天的收获、困惑和明天最重要的一件事。${suffix}`);
  return NextResponse.json(result.ok ? { message: "每日提醒已发送。" } : { message: result.message }, { status: result.ok ? 200 : 503 });
}

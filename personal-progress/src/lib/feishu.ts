import { createHmac } from "node:crypto";

type FeishuResult = { ok: true } | { ok: false; message: string };

export async function sendFeishuReminder(text: string): Promise<FeishuResult> {
  const webhook = process.env.FEISHU_WEBHOOK_URL;
  if (!webhook) {
    return { ok: false, message: "尚未配置 FEISHU_WEBHOOK_URL。" };
  }

  const payload: Record<string, unknown> = {
    msg_type: "text",
    content: { text },
  };
  const secret = process.env.FEISHU_WEBHOOK_SECRET;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64");
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as { StatusCode?: number; code?: number; msg?: string } | null;
    if (!response.ok || (data?.StatusCode !== undefined && data.StatusCode !== 0) || (data?.code !== undefined && data.code !== 0)) {
      return { ok: false, message: data?.msg ?? "飞书接口拒绝了该提醒。" };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "无法连接飞书 webhook，请检查地址与网络。" };
  }
}

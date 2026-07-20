import { after, NextRequest, NextResponse } from "next/server";

// Run close to the caller instead of waiting for a single US serverless region.
// This endpoint is also used by Feishu's strict three-second URL validation.
export const runtime = "edge";

type StoredRecord = Record<string, string>;
type CommandTarget =
  | "ai"
  | "work"
  | "life"
  | "journal"
  | "plan"
  | "success"
  | "long-goal"
  | "short-goal"
  | "habit"
  | "checkin"
  | "special-day"
  | "reminder"
  | "help";
type FeishuMessage = { message_id?: string; message_type?: string; content?: string };
type FeishuEvent = { sender?: { sender_type?: string; sender_id?: { open_id?: string } }; message?: FeishuMessage };

// Keep the URL verification path independent from Supabase. Feishu allows only
// three seconds for it, while a cold database client can take longer to load.
async function getServiceSupabase() {
  const { getServiceSupabaseClient } = await import("@/lib/supabase-server");
  return getServiceSupabaseClient();
}

function parseJson(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readArray<T>(records: StoredRecord, key: string): T[] {
  try {
    const parsed = JSON.parse(records[key] || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray(records: StoredRecord, key: string, value: unknown[]) {
  records[key] = JSON.stringify(value);
}

function beijingDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseCommand(text: string): { target: CommandTarget; content: string } {
  const matched = text.trim().match(/^\/?(AI|\u5de5\u4f5c|\u751f\u6d3b|\u65e5\u8bb0|\u5b89\u6392|\u6210\u529f\u65e5\u8bb0|\u6210\u529f|\u957f\u671f\u76ee\u6807|\u77ed\u671f\u76ee\u6807|\u76ee\u6807|\u4e60\u60ef|\u6253\u5361|\u7eaa\u5ff5\u65e5|\u63d0\u9192|\u5e2e\u52a9)\s*([\s\S]*)$/i);
  if (!matched) return { target: "ai", content: text.trim() };
  const label = matched[1].toUpperCase();
  const content = matched[2].trim();
  if (label === "AI") return { target: "ai", content };
  if (label === "\u5de5\u4f5c") return { target: "work", content };
  if (label === "\u751f\u6d3b") return { target: "life", content };
  if (label === "\u65e5\u8bb0") return { target: "journal", content };
  if (label === "\u5b89\u6392") return { target: "plan", content };
  if (label === "\u6210\u529f\u65e5\u8bb0" || label === "\u6210\u529f") return { target: "success", content };
  if (label === "\u957f\u671f\u76ee\u6807") return { target: "long-goal", content };
  if (label === "\u77ed\u671f\u76ee\u6807" || label === "\u76ee\u6807") return { target: "short-goal", content };
  if (label === "\u4e60\u60ef") return { target: "habit", content };
  if (label === "\u6253\u5361") return { target: "checkin", content };
  if (label === "\u7eaa\u5ff5\u65e5") return { target: "special-day", content };
  if (label === "\u63d0\u9192") return { target: "reminder", content };
  return { target: "help", content };
}

function noteTitle(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 30) || "\u98de\u4e66\u56fe\u7247\u968f\u8bb0";
}

async function tenantAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error("missing_feishu_credentials");
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = (await response.json()) as { code?: number; tenant_access_token?: string };
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) throw new Error("feishu_token_failed");
  return data.tenant_access_token;
}

async function replyToMessage(messageId: string, text: string) {
  try {
    const accessToken = await tenantAccessToken();
    await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text }) }),
    });
  } catch {
    // Reply failures should not block saving the user's record.
  }
}

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function importImage(userId: string, messageId: string, imageKey: string) {
  const serviceSupabase = await getServiceSupabase();
  if (!serviceSupabase) throw new Error("missing_supabase_service_key");
  const accessToken = await tenantAccessToken();
  const response = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/resources/${encodeURIComponent(imageKey)}?type=image`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("feishu_image_download_failed");
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const path = `${userId}/${messageId}-${crypto.randomUUID()}.${imageExtension(contentType)}`;
  const { error } = await serviceSupabase.storage.from("feishu-imports").upload(path, await response.arrayBuffer(), { contentType, upsert: false });
  if (error) throw new Error("image_upload_failed");
  const { data, error: signedUrlError } = await serviceSupabase.storage.from("feishu-imports").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedUrlError || !data.signedUrl) throw new Error("image_url_failed");
  return data.signedUrl;
}

async function upsertRecords(userId: string, records: StoredRecord, updatedAt: string) {
  const serviceSupabase = await getServiceSupabase();
  if (!serviceSupabase) throw new Error("missing_supabase_service_key");
  const { error } = await serviceSupabase.from("user_records").upsert({ user_id: userId, records, updated_at: updatedAt });
  if (error) throw error;
}

async function writeIncomingMessage(userId: string, message: FeishuMessage) {
  const serviceSupabase = await getServiceSupabase();
  if (!serviceSupabase) throw new Error("missing_supabase_service_key");
  const { data, error } = await serviceSupabase.from("user_records").select("records").eq("user_id", userId).maybeSingle();
  if (error) throw error;

  const records: StoredRecord = data?.records && typeof data.records === "object" ? (data.records as StoredRecord) : {};
  const contentObject = parseJson(message.content);
  const text = typeof contentObject.text === "string" ? contentObject.text.trim() : "";
  const command = parseCommand(text);
  const imageKey = typeof contentObject.image_key === "string" ? contentObject.image_key : "";
  const images = imageKey && message.message_id ? [await importImage(userId, message.message_id, imageKey)] : [];
  const updatedAt = new Date().toISOString();

  if (command.target === "help") return;

  if (command.target === "success") {
    const key = "daily-space:success-journals";
    const current = readArray<{ date: string; content: string; updatedAt: string }>(records, key);
    const date = beijingDate();
    const old = current.find((entry) => entry.date === date);
    const next = { date, content: [old?.content, command.content].filter(Boolean).join(old?.content ? "\n" : ""), updatedAt };
    writeArray(records, key, [next, ...current.filter((entry) => entry.date !== date)]);
    await upsertRecords(userId, records, updatedAt);
    return;
  }

  if (command.target === "long-goal" || command.target === "short-goal") {
    const key = "daily-space:goals";
    const current = readArray<{ id: number; label: string; done: boolean; type: "long" | "short" }>(records, key);
    writeArray(records, key, [...current, { id: Date.now(), label: command.content || "\u672a\u547d\u540d\u76ee\u6807", done: false, type: command.target === "long-goal" ? "long" : "short" }]);
    await upsertRecords(userId, records, updatedAt);
    return;
  }

  if (command.target === "habit") {
    const key = "daily-space:habits";
    const current = readArray<{ id: number; name: string; createdAt: string; completedDates: string[] }>(records, key);
    writeArray(records, key, [...current, { id: Date.now(), name: command.content || "\u65b0\u4e60\u60ef", createdAt: beijingDate(), completedDates: [] }]);
    await upsertRecords(userId, records, updatedAt);
    return;
  }

  if (command.target === "checkin") {
    const key = "daily-space:habits";
    const current = readArray<{ id: number; name: string; createdAt: string; completedDates: string[] }>(records, key);
    const requested = command.content.toLocaleLowerCase();
    const index = current.findIndex((habit) => habit.name.toLocaleLowerCase() === requested || habit.name.toLocaleLowerCase().includes(requested));
    if (index >= 0) {
      const dates = new Set(current[index].completedDates);
      dates.add(beijingDate());
      current[index] = { ...current[index], completedDates: [...dates] };
      writeArray(records, key, current);
      await upsertRecords(userId, records, updatedAt);
    }
    return;
  }

  if (command.target === "special-day") {
    const match = command.content.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (match) {
      const key = "daily-space:special-days";
      const current = readArray<{ id: number; title: string; date: string; category: "anniversary" | "birthday" | "other"; repeatsYearly: boolean }>(records, key);
      writeArray(records, key, [...current, { id: Date.now(), date: match[1], title: match[2].trim(), category: "anniversary", repeatsYearly: false }]);
      await upsertRecords(userId, records, updatedAt);
    }
    return;
  }

  if (command.target === "reminder") {
    const match = command.content.match(/^(\d{2}:\d{2})(?:\s+([\s\S]+))?$/);
    if (match && Number(match[1].slice(0, 2)) < 24 && Number(match[1].slice(3)) < 60) {
      const key = "daily-space:feishu-reminders";
      const current = readArray<{ id: string; time: string; message: string; enabled: boolean }>(records, key);
      writeArray(records, key, [...current, { id: crypto.randomUUID(), time: match[1], message: match[2]?.trim() || "\u8bb0\u5f55\u4eca\u5929\u7684\u751f\u6d3b\u4e0e\u53cd\u601d", enabled: true }]);
      await upsertRecords(userId, records, updatedAt);
    }
    return;
  }

  if (command.target === "journal") {
    const key = "daily-space:journals";
    const current = readArray<{ date: string; content: string; mood: string; images?: string[]; updatedAt: string }>(records, key);
    const date = beijingDate();
    const old = current.find((entry) => entry.date === date);
    const next = {
      date,
      content: [old?.content, command.content].filter(Boolean).join(old?.content ? "\n" : ""),
      mood: old?.mood || "\u5e73\u9759",
      images: [...(old?.images || []), ...images],
      updatedAt,
    };
    writeArray(records, key, [next, ...current.filter((entry) => entry.date !== date)]);
  } else if (command.target === "plan") {
    const key = `daily-space:plan:${beijingDate()}`;
    const existing = parseJson(records[key]) as { tasks?: Array<{ id: number; text: string; priority: number; done: boolean }> };
    const tasks = Array.isArray(existing.tasks) ? existing.tasks : [];
    records[key] = JSON.stringify({ ...existing, tasks: [...tasks, { id: Date.now(), text: command.content || "\u6765\u81ea\u98de\u4e66\u7684\u5f85\u529e", priority: tasks.length + 1, done: false }] });
  } else {
    const key = "daily-space:notes";
    const current = readArray<{ id: number; category: string; title: string; content: string; images: string[]; updatedAt: string }>(records, key);
    writeArray(records, key, [{ id: Date.now(), category: command.target, title: noteTitle(command.content), content: command.content, images, updatedAt }, ...current]);
  }

  await upsertRecords(userId, records, updatedAt);
}

async function bindOpenId(openId: string, code: string) {
  const serviceSupabase = await getServiceSupabase();
  if (!serviceSupabase) throw new Error("missing_supabase_service_key");
  const { data, error } = await serviceSupabase.from("feishu_binding_codes").select("user_id, expires_at").eq("code", code).maybeSingle();
  if (error || !data || Date.parse(data.expires_at) < Date.now()) return false;
  const { error: bindingError } = await serviceSupabase.from("feishu_bindings").upsert({ open_id: openId, user_id: data.user_id });
  if (bindingError) throw bindingError;
  await serviceSupabase.from("feishu_binding_codes").delete().eq("code", code);
  return true;
}

type CallbackPayload = { type?: string; token?: string; challenge?: string; header?: { token?: string; event_type?: string }; event?: FeishuEvent };

async function processCallback(payload: CallbackPayload) {
  if (payload.header?.event_type !== "im.message.receive_v1") return NextResponse.json({ ok: true });
  if (payload.event?.sender?.sender_type === "app") return NextResponse.json({ ok: true });

  const openId = payload.event?.sender?.sender_id?.open_id;
  const message = payload.event?.message;
  if (!openId || !message?.message_id) return NextResponse.json({ ok: true });

  const content = parseJson(message.content);
  const text = typeof content.text === "string" ? content.text.trim() : "";
  const bindingMatch = text.match(/^\u7ed1\u5b9a\s+([A-Z0-9]{8})$/i);
  if (bindingMatch) {
    const bound = await bindOpenId(openId, bindingMatch[1].toUpperCase());
    await replyToMessage(
      message.message_id,
      bound
        ? "\u7ed1\u5b9a\u6210\u529f\u3002\u73b0\u5728\u53d1\u6587\u5b57\u6216\u56fe\u7247\u5373\u53ef\u4fdd\u5b58\u5230\u65e5\u5e38\u7559\u767d\u3002"
        : "\u7ed1\u5b9a\u7801\u65e0\u6548\u6216\u5df2\u8fc7\u671f\uff0c\u8bf7\u5728\u7f51\u7ad9\u8bbe\u7f6e\u9875\u91cd\u65b0\u751f\u6210\u3002",
    );
    return NextResponse.json({ ok: true, bound });
  }

  if (/^\/?\u5e2e\u52a9\s*$/i.test(text)) {
    await replyToMessage(message.message_id, "\u6307\u4ee4\uff1a/\u65e5\u8bb0\u3001/\u5b89\u6392\u3001/\u6210\u529f\u65e5\u8bb0\u3001/\u957f\u671f\u76ee\u6807\u3001/\u77ed\u671f\u76ee\u6807\u3001/\u4e60\u60ef\u3001/\u6253\u5361 \u4e60\u60ef\u540d\u3001/\u7eaa\u5ff5\u65e5 2026-12-31 \u6807\u9898\u3001/\u63d0\u9192 21:50 \u6d88\u606f\uff0c\u4ee5\u53ca /ai\u3001/\u5de5\u4f5c\u3001/\u751f\u6d3b\u3002");
    return NextResponse.json({ ok: true, help: true });
  }

  const serviceSupabase = await getServiceSupabase();
  if (!serviceSupabase) throw new Error("missing_supabase_service_key");
  const { data: binding } = await serviceSupabase.from("feishu_bindings").select("user_id").eq("open_id", openId).maybeSingle();
  if (!binding) return;

  const { error: seenError } = await serviceSupabase.from("feishu_processed_messages").insert({ message_id: message.message_id });
  if (seenError?.code === "23505") return;
  if (seenError) throw new Error("unable_to_reserve_message");

  try {
    await writeIncomingMessage(binding.user_id, message);
    await replyToMessage(message.message_id, "\u5df2\u4fdd\u5b58\u5230\u65e5\u5e38\u7559\u767d\u3002");
  } catch (error) {
    await serviceSupabase.from("feishu_processed_messages").delete().eq("message_id", message.message_id);
    console.error("Failed to import Feishu message", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const receivedPayload = (await request.json().catch(() => null)) as CallbackPayload | FeishuEvent | null;
  const ingestSecret = process.env.FEISHU_INGEST_SECRET;
  const isTrustedLongConnection = Boolean(
    ingestSecret && request.headers.get("x-feishu-ingest-secret") === ingestSecret,
  );
  const payload = isTrustedLongConnection
    ? { header: { event_type: "im.message.receive_v1" }, event: receivedPayload as FeishuEvent }
    : (receivedPayload as CallbackPayload | null);
  if (!payload) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });

  // This is called by Feishu while saving the callback URL. Do not load any
  // database or external service before returning the required challenge.
  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!isTrustedLongConnection && (!verificationToken || (payload.token !== verificationToken && payload.header?.token !== verificationToken))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Feishu only needs an acknowledgement. The import and optional bot reply
  // run after the response so slow database or image work cannot trigger retries.
  after(async () => {
    try {
      await processCallback(payload);
    } catch (error) {
      console.error("Failed to process Feishu callback", error);
    }
  });
  return NextResponse.json({ ok: true });
}

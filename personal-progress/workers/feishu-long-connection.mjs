import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import * as Lark from "@larksuiteoapi/node-sdk";
import { createClient } from "@supabase/supabase-js";

const required = ["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_INGEST_SECRET", "DAILY_SPACE_INGEST_URL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
const ingestSecret = process.env.FEISHU_INGEST_SECRET;
const ingestUrl = process.env.DAILY_SPACE_INGEST_URL;
const port = Number(process.env.PORT || 3000);
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reminderWebhook = process.env.FEISHU_WEBHOOK_URL;
const reminderWebhookSecret = process.env.FEISHU_WEBHOOK_SECRET;

function beijingNow() {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

async function sendReminder(text) {
  if (!reminderWebhook) return false;
  const payload = { msg_type: "text", content: { text } };
  if (reminderWebhookSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = createHmac("sha256", `${timestamp}\n${reminderWebhookSecret}`).update("").digest("base64");
  }
  const response = await fetch(reminderWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  return response.ok && (!result || (result.StatusCode ?? result.code ?? 0) === 0);
}

function readReminders(records) {
  try {
    const reminders = JSON.parse(records?.["daily-space:feishu-reminders"] || "[]");
    return Array.isArray(reminders) ? reminders : [];
  } catch {
    return [];
  }
}

// This lives beside the Feishu long connection so reminders continue even when
// the website is closed. The last send date is stored with each user's record,
// making restarts safe and preventing duplicate messages.
async function runReminderScheduler() {
  if (!supabaseUrl || !supabaseServiceRoleKey || !reminderWebhook) return;
  const { date, time } = beijingNow();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
  const { data: rows, error } = await supabase.from("user_records").select("user_id, records");
  if (error || !rows) {
    if (error) console.error("Failed to load Feishu reminders", error.message);
    return;
  }
  for (const row of rows) {
    const records = row.records && typeof row.records === "object" ? row.records : {};
    const reminders = readReminders(records);
    let changed = false;
    for (const reminder of reminders) {
      if (!reminder.enabled || !/^\d{2}:\d{2}$/.test(reminder.time) || reminder.lastNotifiedDate === date || time < reminder.time) continue;
      const sent = await sendReminder(`日常留白提醒 ${reminder.time}\n${String(reminder.message || "记录今天的生活与反思")}`);
      if (sent) {
        reminder.lastNotifiedDate = date;
        changed = true;
      }
    }
    if (changed) {
      records["daily-space:feishu-reminders"] = JSON.stringify(reminders);
      const { error: saveError } = await supabase.from("user_records").upsert({
        user_id: row.user_id,
        records,
        updated_at: new Date().toISOString(),
      });
      if (saveError) console.error("Failed to record delivered Feishu reminder", saveError.message);
    }
  }
}

async function forwardToDailySpace(event) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-feishu-ingest-secret": ingestSecret,
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Daily Space returned HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

const eventDispatcher = new Lark.EventDispatcher({}).register({
  "im.message.receive_v1": async (event) => {
    await forwardToDailySpace(event);
  },
});

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(port, () => {
  console.info(`Feishu long-connection worker health endpoint listening on ${port}`);
});

void runReminderScheduler();
setInterval(() => {
  void runReminderScheduler().catch((error) => console.error("Feishu reminder scheduler failed", error));
}, 30_000);

const wsClient = new Lark.WSClient({
  appId,
  appSecret,
  loggerLevel: Lark.LoggerLevel.info,
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled long-connection error", error);
});

try {
  wsClient.start({ eventDispatcher });
} catch (error) {
  console.error("Unable to start the Feishu long connection", error);
  process.exitCode = 1;
}

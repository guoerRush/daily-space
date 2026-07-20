import { createServer } from "node:http";
import * as Lark from "@larksuiteoapi/node-sdk";

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

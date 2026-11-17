import { type NewsBrief } from "@/lib/news-brief";
import { getServiceSupabaseClient } from "@/lib/supabase-server";

const bucketName = "daily-news-editions";

export async function readPublishedNews(date: string): Promise<NewsBrief | null> {
  const client = getServiceSupabaseClient();
  if (!client) return null;
  const { data } = await client.storage.from(bucketName).download(`issues/${date}.json`);
  if (!data) return null;
  const brief = JSON.parse(await data.text()) as NewsBrief;
  return brief.date === date && brief.items ? brief : null;
}

function isDuplicate(error: { message: string; statusCode?: string }) {
  return error.statusCode === "409" || /already exists|duplicate/i.test(error.message);
}

export async function publishNews(brief: NewsBrief) {
  const client = getServiceSupabaseClient();
  if (!client) throw new Error("缺少简报存储配置");
  const bucket = client.storage.from(bucketName);
  const path = `issues/${brief.date}.json`;
  const options = { contentType: "application/json", upsert: false };
  const body = JSON.stringify(brief);
  let { error } = await bucket.upload(path, body, options);
  if (error && /bucket not found/i.test(error.message)) {
    const { error: createError } = await client.storage.createBucket(bucketName, {
      public: false, fileSizeLimit: 64 * 1024, allowedMimeTypes: ["application/json"],
    });
    if (createError && !isDuplicate(createError)) throw createError;
    ({ error } = await bucket.upload(path, body, options));
  }
  if (error && !isDuplicate(error)) throw error;
  const published = error ? await readPublishedNews(brief.date) : brief;
  if (!published) throw new Error("无法读取已发布简报");
  return published;
}

export async function claimNewsDelivery(date: string) {
  const client = getServiceSupabaseClient();
  if (!client) throw new Error("缺少简报存储配置");
  const bucket = client.storage.from(bucketName);
  const path = `deliveries/${date}.json`;
  const { error } = await bucket.upload(path, JSON.stringify({ startedAt: new Date().toISOString() }), {
    contentType: "application/json", upsert: false,
  });
  if (error && isDuplicate(error)) return null;
  if (error) throw error;
  return async () => {
    const { error: releaseError } = await bucket.remove([path]);
    if (releaseError) throw releaseError;
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseClient, getServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function createBindingCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

type StoredRecord = Record<string, string>;
const bindingCodeKey = "daily-space:feishu-binding-code";

function recordsFrom(value: unknown): StoredRecord {
  return value && typeof value === "object" ? value as StoredRecord : {};
}

export async function POST(request: NextRequest) {
  const serviceSupabase = getServiceSupabaseClient();
  const publicSupabase = getPublicSupabaseClient();
  if (!serviceSupabase || !publicSupabase) {
    return NextResponse.json({ message: "\u8d26\u53f7\u540c\u6b65\u670d\u52a1\u5c1a\u672a\u914d\u7f6e\u5b8c\u6210\u3002" }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ message: "\u8bf7\u5148\u767b\u5f55\u8d26\u53f7\u540e\u518d\u751f\u6210\u7ed1\u5b9a\u7801\u3002" }, { status: 401 });

  const { data: userData, error: userError } = await publicSupabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ message: "\u767b\u5f55\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002" }, { status: 401 });

  const userId = userData.user.id;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const code = createBindingCode();
  const { data, error } = await serviceSupabase.from("user_records").select("records").eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ message: "\u6682\u65f6\u65e0\u6cd5\u8bbf\u95ee\u4e91\u7aef\u8bb0\u5f55\u3002" }, { status: 503 });
  const records = recordsFrom(data?.records);
  records[bindingCodeKey] = JSON.stringify({ code, expiresAt });
  const { error: saveError } = await serviceSupabase.from("user_records").upsert({ user_id: userId, records, updated_at: new Date().toISOString() });
  if (saveError) return NextResponse.json({ message: "\u6682\u65f6\u65e0\u6cd5\u4fdd\u5b58\u7ed1\u5b9a\u7801\u3002" }, { status: 503 });
  return NextResponse.json({ code, expiresAt });
}

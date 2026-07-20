import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseClient, getServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function createBindingCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
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
  await serviceSupabase.from("feishu_binding_codes").delete().eq("user_id", userId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createBindingCode();
    const { error } = await serviceSupabase.from("feishu_binding_codes").insert({ code, user_id: userId, expires_at: expiresAt });
    if (!error) return NextResponse.json({ code, expiresAt });
  }

  return NextResponse.json({ message: "\u6682\u65f6\u65e0\u6cd5\u751f\u6210\u7ed1\u5b9a\u7801\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002" }, { status: 500 });
}

export const maxDuration = 20;

const accountFilter = /^eq\.[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const versionFilter = /^(?:is\.null|eq\.\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))$/;

async function proxyRecords(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return Response.json({ code: "SYNC_UNAVAILABLE" }, { status: 503 });
  const authorization = request.headers.get("authorization");
  // PostgREST validates the user token and applies the existing per-account RLS.
  if (!authorization?.startsWith("Bearer ") || authorization === `Bearer ${publicKey}`) {
    return Response.json({ code: "PGRST301" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams;
  const isRead = request.method === "GET";
  const isUpdate = request.method === "PATCH";
  const user = query.get("user_id") ?? "";
  const version = query.get("updated_at") ?? "";
  const upstream = new URL("/rest/v1/user_records", url);
  upstream.searchParams.set("select", isRead && query.get("select") !== "updated_at" ? "records,updated_at" : "updated_at");
  if (isRead || isUpdate) {
    if (!accountFilter.test(user)) return Response.json({ code: "SYNC_BAD_FILTER" }, { status: 400 });
    upstream.searchParams.set("user_id", user);
  }
  if (isUpdate) {
    if (!versionFilter.test(version)) return Response.json({ code: "SYNC_BAD_FILTER" }, { status: 400 });
    upstream.searchParams.set("updated_at", version);
  }

  const headers = new Headers({ authorization, apikey: publicKey, accept: "application/json" });
  if (!isRead) {
    headers.set("content-type", "application/json");
    headers.set("prefer", "return=representation");
  }

  try {
    const response = await fetch(upstream, {
      method: request.method, headers,
      body: isRead ? undefined : await request.text(),
      cache: "no-store", signal: AbortSignal.timeout(14_000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "private, no-store" },
    });
  } catch {
    return Response.json({ code: "SYNC_UPSTREAM", message: "云端数据库暂时无法连接。" }, { status: 503 });
  }
}

export { proxyRecords as GET, proxyRecords as POST, proxyRecords as PATCH };

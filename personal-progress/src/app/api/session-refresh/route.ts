// Refresh tokens rotate. Forward a single request to the project's token
// endpoint and let the Auth SDK handle token replacement and retry timing.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = { "cache-control": "private, no-store" };
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ message: "Origin mismatch" }, { status: 403, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ message: "Auth service unavailable" }, { status: 503, headers });
  const payload = await request.json().catch(() => null);
  const token = payload?.refresh_token;
  if (typeof token !== "string" || !token || token.length > 8192) {
    return Response.json({ message: "Missing refresh token" }, { status: 400, headers });
  }
  try {
    const upstream = await fetch(new URL("/auth/v1/token?grant_type=refresh_token", url), {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
      headers: { apikey: key, "content-type": "application/json", "x-supabase-api-version": "2024-01-01" },
      body: JSON.stringify({ refresh_token: token }),
    });
    const responseHeaders = new Headers(headers);
    for (const name of ["content-type", "x-supabase-api-version"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Temporary project restrictions must not make Auth discard a valid session.
    const status = upstream.status === 402 || upstream.status === 429 ? 503 : upstream.status;
    return new Response(upstream.body, { status, headers: responseHeaders });
  } catch {
    return Response.json({ message: "Unable to reach authentication service" }, { status: 503, headers });
  }
}

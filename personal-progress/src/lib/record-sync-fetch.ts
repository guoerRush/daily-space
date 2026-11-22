/** Use the site's connection while the browser's direct record route is down. */
export function createRecordSyncFetch(supabaseUrl: string): typeof fetch {
  let preferProxyUntil = 0;
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (typeof window !== "undefined" && url.origin === new URL(supabaseUrl).origin
      && request.method === "POST" && url.pathname === "/auth/v1/token"
      && url.searchParams.get("grant_type") === "refresh_token") {
      return fetch("/api/session-refresh", {
        method: "POST", headers: { "content-type": "application/json" },
        body: await request.text(), cache: "no-store", credentials: "omit", signal: request.signal,
      });
    }
    const supported = url.origin === new URL(supabaseUrl).origin
      && ["/rest/v1/user_records", "/rest/v1/rpc/daily_space_read_changes", "/rest/v1/rpc/daily_space_write_changes"].includes(url.pathname)
      && ["GET", "POST", "PATCH"].includes(request.method);
    if (!supported || typeof window === "undefined") return fetch(request);

    // Clone the request before fetch consumes its body. A retried write is
    // guarded by the original expected row timestamp or unique account key.
    const retry = request.clone();
    const throughSite = async () => {
      const headers = new Headers(retry.headers);
      headers.delete("apikey");
      const body = retry.method === "GET" ? undefined : await retry.text();
      const suffix = url.pathname.startsWith("/rest/v1/rpc/") ? `?rpc=${url.pathname.split("/").pop()}` : url.search;
      return fetch(`/api/record-sync${suffix}`, { method: retry.method, headers, body, signal: retry.signal });
    };
    if (Date.now() < preferProxyUntil) {
      try {
        const response = await throughSite();
        if (!response.ok) preferProxyUntil = 0;
        return response;
      } catch (error) {
        preferProxyUntil = 0;
        throw error;
      }
    }
    const direct = new AbortController();
    const abort = () => direct.abort(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = window.setTimeout(() => direct.abort(), 8_000);
    try {
      const response = await fetch(request, { signal: direct.signal });
      if (![502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      if (request.signal.aborted) throw error;
    } finally {
      window.clearTimeout(timeout);
      request.signal.removeEventListener("abort", abort);
    }
    const response = await throughSite();
    if (response.ok) preferProxyUntil = Date.now() + 10 * 60_000;
    return response;
  };
}

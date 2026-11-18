/** Retry only account record requests when a browser cannot reach Supabase. */
export function createRecordSyncFetch(supabaseUrl: string): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const supported = url.origin === new URL(supabaseUrl).origin
      && url.pathname === "/rest/v1/user_records"
      && ["GET", "POST", "PATCH"].includes(request.method);
    if (!supported || typeof window === "undefined") return fetch(request);

    // Clone the request before fetch consumes its body. A retried write is
    // guarded by the original expected row timestamp or unique account key.
    const retry = request.clone();
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
    const headers = new Headers(retry.headers);
    headers.delete("apikey");
    const body = retry.method === "GET" ? undefined : await retry.text();
    return fetch(`/api/record-sync${url.search}`, { method: retry.method, headers, body, signal: retry.signal });
  };
}

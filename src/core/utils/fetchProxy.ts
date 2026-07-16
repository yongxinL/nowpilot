export interface ProxyFetchResult {
  ok: boolean;
  status: number;
  body: string;
}

/**
 * Attempt fetch through the background script proxy first (bypasses CORS),
 * falling back to direct fetch only if the background proxy is unavailable.
 *
 * Non-serializable properties like AbortSignal are stripped for the proxy;
 * the background script applies its own timeout instead.
 */
export async function fetchWithFallback(url: string, options: RequestInit): Promise<ProxyFetchResult> {
  // Try background proxy first — no CORS restrictions in service worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const proxyOptions: Record<string, unknown> = {};
      if (options.headers) proxyOptions.headers = options.headers;
      if (options.method) proxyOptions.method = options.method;
      if (options.body) proxyOptions.body = options.body;

      return await new Promise<ProxyFetchResult>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_PROXY', url, options: proxyOptions },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response as ProxyFetchResult);
            }
          },
        );
      });
    } catch {
      // Background proxy unavailable — fall through to direct fetch
    }
  }

  // Fall back to direct fetch (may have CORS issues but works for local/dev endpoints)
  try {
    const directResponse = await fetch(url, options);
    const body = await directResponse.text();
    return { ok: directResponse.ok, status: directResponse.status, body };
  } catch {
    return { ok: false, status: 0, body: 'Connection failed' };
  }
}

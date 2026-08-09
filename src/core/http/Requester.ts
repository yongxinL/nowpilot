// src/core/http/Requester.ts — §10.7 proxy flow client (panel side). The
// Requester wraps PROXY_FETCH: the panel sends a ProxyFetchRequest over
// chrome.runtime.sendMessage and the background SW executes the real fetch
// (R-3 boundary — AI + fetch live in panels/SW respectively; the SW is the only
// context that talks to target hosts). Timeout/retry defaults are pinned
// constants (CONTEXT 'the agent's Discretion', A-21). Every failure routes
// through debugLog with a canonical code (Golden Rule 9) and returns a
// ProxyFetchResponse-shaped failure — NEVER throws to the caller. Request and
// response bodies are never logged (T-2-10-03, R-10). Dependency-free
// primitive (R-4-safe): imports only @/core/error + @/types — no zustand/storage.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { ProxyFetchRequest, ProxyFetchResponse } from '@/types/messages';

export const DEFAULT_TIMEOUT_MS = 25_000;
export const DEFAULT_RETRIES = 1;

const PROXY_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export interface RequestOptions {
  /** Override the default timeout (test seam + Phase-8 tuning). */
  timeoutMs?: number;
}

/** Runtime validation before the payload crosses to the SW (T-2-10-01). */
function validatePayload(payload: ProxyFetchRequest): string | null {
  if (typeof payload.addonId !== 'string' || payload.addonId.length === 0) {
    return 'addonId must be a non-empty string';
  }
  if (typeof payload.url !== 'string' || payload.url.length === 0) {
    return 'url must be a non-empty string';
  }
  if (!PROXY_METHODS.has(payload.method)) {
    return `unsupported method '${String(payload.method)}'`;
  }
  return null;
}

/**
 * One bounded send attempt — never throws. On rejection/timeout it debugLogs a
 * canonical code and resolves a ProxyFetchResponse-shaped failure (Golden Rule 9).
 */
async function sendOnce(
  payload: ProxyFetchRequest,
  timeoutMs: number,
): Promise<ProxyFetchResponse> {
  const message: ProxyFetchRequest = { ...payload, type: 'PROXY_FETCH' };
  const timeout = new Promise<ProxyFetchResponse>((resolve) => {
    setTimeout(() => {
      debugLog(ERROR_CODES.NETWORK_STATUS, 'PROXY_FETCH timed out', {
        module: 'Requester',
        extra: { addonId: payload.addonId },
      });
      resolve({ ok: false, status: 0, body: '', error: 'PROXY_FETCH_TIMEOUT' });
    }, timeoutMs);
  });
  const send = new Promise<ProxyFetchResponse>((resolve) => {
    void browser.runtime.sendMessage(message).then(
      (response) => resolve(response as ProxyFetchResponse),
      (err: unknown) => {
        debugLog(ERROR_CODES.CONNECT_FAILED, 'PROXY_FETCH sendMessage rejected', {
          error: err instanceof Error ? err : undefined,
          module: 'Requester',
          extra: { addonId: payload.addonId },
        });
        resolve({
          ok: false,
          status: 0,
          body: '',
          error: err instanceof Error ? err.message : 'PROXY_FETCH_FAILED',
        });
      },
    );
  });
  return Promise.race([send, timeout]);
}

/**
 * PROXY_FETCH client wrapper. Validates the payload (addonId, url, method in
 * the locked set), sends over the runtime channel with a timeout, and applies
 * ONE bounded retry — only when the caller opted in via `retrySafe` (Appendix C:
 * "Never retried unless caller marks request retry-safe", T-2-10-02). Resolves a
 * ProxyFetchResponse on success and a failure-shaped response on any error;
 * never throws.
 */
export async function request(
  payload: ProxyFetchRequest,
  options: RequestOptions = {},
): Promise<ProxyFetchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const validationError = validatePayload(payload);
  if (validationError !== null) {
    debugLog(ERROR_CODES.CONNECT_FAILED, 'PROXY_FETCH payload validation failed', {
      module: 'Requester',
      extra: { error: validationError },
    });
    return { ok: false, status: 0, body: '', error: validationError };
  }
  const maxAttempts = payload.retrySafe ? DEFAULT_RETRIES + 1 : 1;
  let lastFailure: ProxyFetchResponse = {
    ok: false,
    status: 0,
    body: '',
    error: 'PROXY_FETCH_FAILED',
  };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await sendOnce(payload, timeoutMs);
    if (response.ok) return response;
    lastFailure = response;
  }
  return lastFailure;
}

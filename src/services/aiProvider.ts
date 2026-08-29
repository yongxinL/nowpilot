import { CustomProviderId, CustomModelItem } from '../types';

/**
 * Outcome of a connection test. Either the endpoint returned a usable
 * (non-empty) model list (`ok: true`) or it did not (`ok: false`, with a
 * real error message — never a silent fallback).
 *
 * D-12 / T-01-10: the `error` string is built from the provider's own
 * response (HTTP status + server-provided error body). The raw `apiKey`
 * parameter is NEVER interpolated into this string.
 */
export type ProviderConnectionResult =
  | { ok: true; models: CustomModelItem[] }
  | { ok: false; error: string };

/**
 * Provider model-list fetch helper.
 *
 * Used by both `fetchProviderModels` (the Options "Update list" / registry
 * D-52 discovery path) and `testProviderConnection` (the connection-test
 * path). Returns:
 *   - `{ ok: true, models }` — endpoint reachable, returned a non-empty list
 *   - `{ ok: false, error }` — fetch threw OR the response was non-ok OR
 *     the endpoint returned an empty list. `error` is built from the
 *     provider's own status / error body; the apiKey is never logged.
 *
 * Exported for ProviderRegistry (03-05 D-52): live model discovery reuses
 * these exact fetch semantics, passing the registry's merged endpoint
 * (D-50 np_endpoint_overrides over §10.6 defaults) as `proxyUrl`.
 *
 * D-11: no predefined model-name fallback here. On a real failure the
 * caller receives an empty array (`fetchProviderModels`) or a surfaced
 * error (`testProviderConnection`) — never a hardcoded model name.
 */
export async function fetchModelsOrError(
  providerId: CustomProviderId,
  apiKey?: string,
  proxyUrl?: string
): Promise<ProviderConnectionResult> {
  const url = proxyUrl ? proxyUrl.replace(/\/+$/, '') : (
    providerId === 'openai' ? 'https://api.openai.com/v1' :
    providerId === 'claude' ? 'https://api.anthropic.com' :
    providerId === 'gemini' ? 'https://generativelanguage.googleapis.com' :
    'http://localhost:11434'
  );

  let fetchedNames: string[] = [];

  try {
    if (providerId === 'gemini') {
      const resp = await fetch(`${url}/v1beta/models?key=${apiKey || ''}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.models && Array.isArray(data.models)) {
          fetchedNames = data.models
            .map((m: any) => m.name?.replace('models/', ''))
            .filter((n: string) => n);
        }
      } else {
        const errorData = await resp.json().catch(() => ({}));
        const serverMsg = errorData?.error?.message || errorData?.error;
        const errMsg = serverMsg ? String(serverMsg) : `HTTP error ${resp.status}`;
        return { ok: false, error: `HTTP ${resp.status}: ${errMsg}` };
      }
    } else if (providerId === 'ollama') {
      const resp = await fetch(`${url}/api/tags`).catch(() => fetch(`${url}/v1/models`));
      if (resp?.ok) {
        const data = await resp.json();
        const list = data.models || data.data || [];
        fetchedNames = list.map((m: any) => m.name || m.id);
      } else {
        const status = resp?.status ?? 'unknown';
        return { ok: false, error: `HTTP ${status}: Connection failed` };
      }
    } else {
      const headers: Record<string, string> = {};
      if (apiKey) {
        if (providerId === 'claude') {
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }
      const resp = await fetch(`${url}/models`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const list = data.data || data.models || [];
        fetchedNames = list.map((m: any) => m.id || m.name);
      } else {
        const errorData = await resp.json().catch(() => ({}));
        const serverMsg = errorData?.error?.message || errorData?.error;
        const errMsg = serverMsg ? String(serverMsg) : `HTTP error ${resp.status}`;
        return { ok: false, error: `HTTP ${resp.status}: ${errMsg}` };
      }
    }
  } catch (err) {
    // Network-level failure (DNS, offline, CORS, etc.). `err` cannot contain
    // the apiKey — fetch errors carry network metadata only.
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error: ${message}` };
  }

  if (fetchedNames.length > 0) {
    return {
      ok: true,
      models: fetchedNames.map((name) => ({ id: name, name, enabled: true })),
    };
  }

  return { ok: false, error: 'Provider returned no models' };
}

/**
 * "Refresh Models" convenience path. Same underlying fetch as
 * `testProviderConnection`; on failure (network throw, non-ok HTTP, or an
 * empty list) returns an empty array. D-11: no predefined model-name
 * fallback — the modal's empty state guides the operator to retry, fix
 * the endpoint, or add models manually via the "+" button.
 *
 * Kept distinct from `testProviderConnection` so the connection-test
 * semantics (D-12 / D-03) are not silently masked.
 */
export async function fetchProviderModels(
  providerId: CustomProviderId,
  apiKey?: string,
  proxyUrl?: string
): Promise<CustomModelItem[]> {
  const result = await fetchModelsOrError(providerId, apiKey, proxyUrl);
  return result.ok ? result.models : [];
}

/**
 * Real, error-surfacing connection test (D-12 / D-03 / T-01-10).
 *
 * Replaces the always-success 1s `setTimeout` previously used in
 * OptionsPage and the (Phase-1-08) OnboardingModal. Issues the same fetch
 * as `fetchProviderModels` but DOES NOT swallow the failure: a non-ok
 * response, network throw, or empty model list returns
 * `{ ok: false, error }` so the calling UI can render the real reason.
 *
 * Privacy (T-01-10): `error` strings are built from `resp.status` and
 * server-provided error body fields only. The raw `apiKey` parameter is
 * NEVER interpolated into the `error` string, never logged, and never
 * echoed back to the user.
 */
export async function testProviderConnection(
  providerId: CustomProviderId,
  apiKey?: string,
  proxyUrl?: string
): Promise<ProviderConnectionResult> {
  return fetchModelsOrError(providerId, apiKey, proxyUrl);
}

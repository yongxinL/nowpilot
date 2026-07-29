// Regex-based patterns for secret redaction.
// Patterns are ordered from most-specific to least-specific to avoid collisions.

// JWTs always start with "eyJ" followed by at least 20 base64url chars
const JWT_PATTERN = /eyJ[a-zA-Z0-9._-]{20,}/g;

// Bare OpenAI-style API keys: sk-abc123...
const BARE_SK_PATTERN = /\bsk-[a-zA-Z0-9_-]+/g;

// api_key=xxx or api-key:xxx patterns
const API_KEY_VALUE_PATTERN = /(?:api[_-]?key)[=:]\s*[a-zA-Z0-9_-]+/gi;

// Bearer tokens in Authorization headers
const BEARER_PATTERN = /bearer\s+[a-zA-Z0-9._-]+/gi;

// ServiceNow JSESSIONID and sysparm_ck token patterns
const JSESSIONID_PATTERN = /(?:JSESSIONID|jsessionid)=[a-zA-Z0-9]+/gi;
const SYSPARM_CK_PATTERN = /(?:sysparm_ck|g_ck)=[a-zA-Z0-9]+/gi;

/**
 * Redacts sensitive information (API keys, Bearer tokens, JWTs, ServiceNow session tokens)
 * from a string. Preserves the surrounding context (key names, parameter names) for readability.
 *
 * @param input - The string potentially containing secrets
 * @returns The string with secrets replaced by ***REDACTED*** placeholders
 */
export function redactSensitive(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return '';
  }

  return input
    .replace(JWT_PATTERN, '***REDACTED_JWT***')
    .replace(BARE_SK_PATTERN, '***REDACTED***')
    .replace(API_KEY_VALUE_PATTERN, 'api_key=***REDACTED***')
    .replace(BEARER_PATTERN, 'Bearer ***REDACTED***')
    .replace(JSESSIONID_PATTERN, 'JSESSIONID=***REDACTED***')
    .replace(SYSPARM_CK_PATTERN, 'sysparm_ck=***REDACTED***');
}

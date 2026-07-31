/**
 * Operation ID generation (WR-01).
 *
 * crypto.randomUUID is SecureContext-only — content scripts running on
 * <all_urls> http:// origins have no crypto.randomUUID. The fallback below
 * keeps the RFC-4122 v4 UUID shape so correlation IDs stay consistent across
 * secure and insecure origins.
 *
 * NOTE: the Math.random fallback is a CORRELATION ID only — it is NOT
 * cryptographically secure and must never be used as a security token.
 */
export function generateOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for insecure origins: UUID-v4-shaped string from Math.random.
  const nibble = (): number => (Math.random() * 16) | 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = nibble();
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type OperationId = ReturnType<typeof generateOperationId>;

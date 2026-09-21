/**
 * Canonical operation-id helper.
 *
 * The operation id is the correlation token every `RuntimeEnvelope` carries
 * (Appendix E / §20.1). It is generated once at creation and never rewritten,
 * so validation only needs to prove the field is a bounded non-empty string.
 *
 * `OPERATION_ID_MAX_CHARS` bounds the field at the trust boundary: a UUID is
 * 36 characters, so anything longer is not an operation id this runtime
 * produced.
 */
export const OPERATION_ID_MAX_CHARS = 128;

export function generateOperationId(): string {
  return crypto.randomUUID();
}

export type OperationId = ReturnType<typeof generateOperationId>;

export function isOperationId(value: unknown): value is OperationId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= OPERATION_ID_MAX_CHARS
  );
}

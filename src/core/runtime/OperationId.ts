export function generateOperationId(): string {
  return crypto.randomUUID();
}

export type OperationId = ReturnType<typeof generateOperationId>;
